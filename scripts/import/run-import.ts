/**
 * data/raw (여러 출처) → data/generated/korsub.sqlite3 를 만드는 메인 가져오기 파이프라인.
 *
 * 순서 (docs/data-integration-rules.md 2장):
 * 원본 수집 → 출처별 변환 → 정규화 → 중복 후보 생성 → 자동 판정
 * → 수동 예외 적용 → 검증 → 최종 데이터 및 검색 인덱스 생성
 *
 * 이 스크립트는 "검증"은 하지 않는다 (scripts/validate/run-validate.ts 가 담당).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'csv-parse/sync'
import { normalizeStationName, normalizeForCompare, normalizeForeignAlias, stripStationSuffix } from '../../src/lib/normalize/text'
import { compareStationCode } from '../../src/lib/normalize/stationCode'
import { decideMerge, isSameOrAdjacentRegion } from '../../src/lib/merge/resolveDuplicates'
import { parseLineColorsCsv, findLineColor } from '../../src/lib/data/loadLineColors'
import { SUB_NAME_DISPLAY_EXCEPTIONS } from '../../src/lib/displayName'
import { writeCsv } from '../db/csv'
import type { LineDefinition, RawStationInput, SourceAdapterResult } from './sources/types'
import {
  loadSeoulMetroNationalSource,
  loadBusanNationalSource,
  loadDaeguNationalSource,
  loadGwangjuNationalSource,
  loadDaejeonNationalSource,
} from './sources/nationalRegionSource'
import { loadKtxGameLineSource } from './sources/ktxGameLineSource'
import { loadMugunghwaSource } from './sources/mugunghwaSource'
import { exportSearchIndex } from './export-search-index'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')

const SCHEMA_PATH = resolve(ROOT, 'scripts/db/schema.sql')
const OVERRIDES_PATH = resolve(ROOT, 'data/overrides/station-resolution.csv')
const DISPLAY_NAME_OVERRIDES_PATH = resolve(ROOT, 'data/overrides/station-display-name.csv')
const SEQUENCE_OVERRIDES_PATH = resolve(ROOT, 'data/overrides/station-line-sequence.csv')
const LINE_COLORS_PATH = resolve(ROOT, 'data/reference/rail-line-colors.csv')
const OUTPUT_DB_PATH = resolve(ROOT, 'data/generated/korsub.sqlite3')
const REVIEW_REPORT_PATH = resolve(ROOT, 'data/generated/station-resolution-review.csv')
const IMPORT_SUMMARY_PATH = resolve(ROOT, 'data/generated/import-summary.json')

const IMPORT_BATCH_ID = `BATCH-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}`

// 지원 예정 범위가 늘어나면 이 배열에 어댑터만 추가하면 된다 — 나머지 파이프라인은
// 출처 개수/지역과 무관하게 동작한다.
const SOURCE_LOADERS = [
  loadSeoulMetroNationalSource,
  loadBusanNationalSource,
  loadDaeguNationalSource,
  loadGwangjuNationalSource,
  loadDaejeonNationalSource,
  loadKtxGameLineSource,
  loadMugunghwaSource,
]

interface OverrideRow {
  action: 'MERGE' | 'KEEP_SEPARATE' | 'REVIEW'
  left_source_id: string
  right_source_id: string
  canonical_station_id: string
  reason: string
  verified_by: string
  verified_at: string
}

interface DisplayNameOverrideRow {
  source_record_id: string
  display_name: string
  reason: string
  verified_by: string
  verified_at: string
}

interface SequenceOverrideRow {
  source_record_id: string
  sort_key: string
  reason: string
  verified_by: string
  verified_at: string
}

/** 병합 판정의 근거. OFFICIAL_TRANSFER/COORDINATE 가 NAME_ONLY_PROVISIONAL 보다 확실하다. */
type MergeBasis = 'OFFICIAL_TRANSFER' | 'COORDINATE' | 'NAME_ONLY_PROVISIONAL'
const MERGE_BASIS_CONFIDENCE: Record<MergeBasis, number> = {
  NAME_ONLY_PROVISIONAL: 0,
  COORDINATE: 1,
  OFFICIAL_TRANSFER: 2,
}

interface StationCandidate {
  sourceId: string
  sourceRecordId: string
  regionCode: string
  rawLineLabel: string
  englishName?: string
  sourceStationCode?: string
  officialTransferConfirmed?: boolean
  officialName: string
  normalizedName: string
  subName: string | null
  initials: string
}

// --- 1. 원본 읽기 ----------------------------------------------------------

function readOverrides(): OverrideRow[] {
  if (!existsSync(OVERRIDES_PATH)) return []
  const text = readFileSync(OVERRIDES_PATH, 'utf-8')
  const rows = parse(text, { columns: true, skip_empty_lines: true }) as OverrideRow[]
  return rows.filter((r) => r.action) // 헤더만 있는 빈 파일 대비
}

/**
 * 병합된 역의 표시명을 사람이 직접 지정하고 싶을 때 쓰는 파일
 * (예: 4호선 총신대입구역 + 7호선 이수역 → "총신대입구(이수)").
 * source_record_id 는 그 병합 그룹의 구성원 중 아무 원본 ID나 가리키면 된다.
 */
function readDisplayNameOverrides(): Map<string, DisplayNameOverrideRow> {
  const map = new Map<string, DisplayNameOverrideRow>()
  if (!existsSync(DISPLAY_NAME_OVERRIDES_PATH)) return map
  const text = readFileSync(DISPLAY_NAME_OVERRIDES_PATH, 'utf-8')
  const rows = parse(text, { columns: true, skip_empty_lines: true }) as DisplayNameOverrideRow[]
  for (const row of rows) {
    if (!row.source_record_id || !row.display_name) continue
    map.set(row.source_record_id, row)
  }
  return map
}

/**
 * 노선 안 역 순서(station_line.sequence)는 기본적으로 원본 STIN_CD를 자연 정렬한
 * 값이다(사용자 확인: "정렬 기준은 로우데이터의 STIN_CD 기준으로"). 다만 같은
 * line_id로 합친 노선이 서로 다른 두 운영기관 코드 체계를 쓰면서 번호가 겹치는
 * 경우(예: 1호선 150~159, 3호선 309~318 — 서로 다른 두 실제 구간을 같은 숫자로
 * 각각 표기)는 자연 정렬만으로 실제 순서를 복원할 수 없다. 이 파일로 그 역들만
 * 정렬 전용 키(sort_key)를 사람이 직접 지정해 바로잡는다 — source_station_code
 * 원본 값 자체는 건드리지 않는다.
 */
function readSequenceOverrides(): Map<string, string> {
  const map = new Map<string, string>()
  if (!existsSync(SEQUENCE_OVERRIDES_PATH)) return map
  const text = readFileSync(SEQUENCE_OVERRIDES_PATH, 'utf-8')
  const rows = parse(text, { columns: true, skip_empty_lines: true }) as SequenceOverrideRow[]
  for (const row of rows) {
    if (!row.source_record_id || !row.sort_key) continue
    map.set(row.source_record_id, row.sort_key)
  }
  return map
}

function validateSequenceOverridesReferenceKnownRecords(
  candidates: Array<{ sourceRecordId: string }>,
  sequenceOverrides: Map<string, string>,
): void {
  const knownIds = new Set(candidates.map((c) => c.sourceRecordId))
  const missing = [...sequenceOverrides.keys()].filter((id) => !knownIds.has(id))
  if (missing.length > 0) {
    throw new Error(`data/overrides/station-line-sequence.csv 가 존재하지 않는 원본 ID를 참조합니다: ${missing.join(', ')}`)
  }
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join('::')
}

/** overrides가 참조하는 원본 ID가 실제로 원본에 존재하는지 확인한다 (규칙 11장). */
function validateOverridesReferenceKnownRecords(
  candidates: Array<{ sourceRecordId: string }>,
  overrides: OverrideRow[],
): void {
  const knownIds = new Set(candidates.map((c) => c.sourceRecordId))
  const missing: string[] = []
  for (const o of overrides) {
    if (o.left_source_id && !knownIds.has(o.left_source_id)) missing.push(o.left_source_id)
    if (o.right_source_id && !knownIds.has(o.right_source_id)) missing.push(o.right_source_id)
  }
  if (missing.length > 0) {
    throw new Error(
      `data/overrides/station-resolution.csv 가 존재하지 않는 원본 ID를 참조합니다: ${[...new Set(missing)].join(', ')}`,
    )
  }
}

function validateDisplayNameOverridesReferenceKnownRecords(
  candidates: Array<{ sourceRecordId: string }>,
  displayNameOverrides: Map<string, DisplayNameOverrideRow>,
): void {
  const knownIds = new Set(candidates.map((c) => c.sourceRecordId))
  const missing = [...displayNameOverrides.keys()].filter((id) => !knownIds.has(id))
  if (missing.length > 0) {
    throw new Error(`data/overrides/station-display-name.csv 가 존재하지 않는 원본 ID를 참조합니다: ${missing.join(', ')}`)
  }
}

/** 원본 역명 끝에 "역"이 없으면 붙인다 (원본 소스가 일관되지 않게 표기함 — 예: "서울역" vs "서울"). */
function ensureStationSuffix(name: string): string {
  const trimmed = name.trim()
  return trimmed.endsWith('역') && trimmed.length > 1 ? trimmed : `${trimmed}역`
}

/**
 * 원본 CP949 파일 일부 레코드에 인코딩이 깨져 '?' 문자가 섞여 들어온다
 * (예: 전철역코드 4703 "4.19민주묘지" → "4?19민주묘지"). 사용자가 공식 표기를
 * 확인해 준 대로("4.19민주묘지" — 마침표) 그 문자를 복원한다.
 */
function stripEncodingArtifacts(name: string): string {
  return name.replace(/\?/g, '.')
}

function buildCandidate(row: RawStationInput): StationCandidate {
  const cleaned = stripEncodingArtifacts(row.officialNameRaw)
  const suffixed = ensureStationSuffix(cleaned)
  const normalized = normalizeStationName(suffixed)
  return {
    sourceId: row.sourceId,
    sourceRecordId: row.sourceRecordId,
    regionCode: row.regionCode,
    rawLineLabel: row.rawLineLabel,
    englishName: row.englishName,
    sourceStationCode: row.sourceStationCode,
    officialTransferConfirmed: row.officialTransferConfirmed,
    officialName: normalized.officialName,
    normalizedName: normalized.normalizedName,
    subName: normalized.subName,
    initials: normalized.initials,
  }
}

// --- 2. 중복 후보 그룹핑 (union-find) --------------------------------------

class UnionFind {
  private parent = new Map<string, string>()

  find(x: string): string {
    if (!this.parent.has(x)) this.parent.set(x, x)
    let root = this.parent.get(x)!
    if (root !== x) {
      root = this.find(root)
      this.parent.set(x, root)
    }
    return root
  }

  union(a: string, b: string): void {
    const rootA = this.find(a)
    const rootB = this.find(b)
    if (rootA !== rootB) this.parent.set(rootA, rootB)
  }
}

interface GroupingResult {
  /** sourceRecordId → 그룹 대표 id */
  groupOf: Map<string, string>
  /** 사람이 검수해야 할 잠정 병합 쌍 (좌표 없음 등으로 규칙 7.2를 기계적으로 만족 못함) */
  reviewPairs: Array<{ left: string; right: string; reason: string }>
  /** 실제로 합쳐진 각 쌍의 병합 근거. station_group.merge_basis를 정할 때 쓴다. */
  pairBasis: Map<string, MergeBasis>
}

function resolveDuplicateGroups(
  candidates: StationCandidate[],
  overrides: OverrideRow[],
): GroupingResult {
  const overrideByPair = new Map<string, OverrideRow>()
  for (const o of overrides) {
    if (o.left_source_id && o.right_source_id) {
      overrideByPair.set(pairKey(o.left_source_id, o.right_source_id), o)
    }
  }

  const byName = new Map<string, StationCandidate[]>()
  const candidateById = new Map<string, StationCandidate>()
  for (const c of candidates) {
    candidateById.set(c.sourceRecordId, c)
    const list = byName.get(c.normalizedName) ?? []
    list.push(c)
    byName.set(c.normalizedName, list)
  }

  const uf = new UnionFind()
  const reviewPairs: GroupingResult['reviewPairs'] = []
  const pairBasis = new Map<string, MergeBasis>()
  const processedPairs = new Set<string>()

  function evaluatePair(a: StationCandidate, b: StationCandidate): void {
    const key = pairKey(a.sourceRecordId, b.sourceRecordId)
    if (processedPairs.has(key)) return
    processedPairs.add(key)

    const override = overrideByPair.get(key)

    if (override?.action === 'KEEP_SEPARATE') {
      return // 명시적으로 분리 확정 — 병합하지 않는다
    }
    if (override?.action === 'MERGE') {
      // 사람이 실제 환승역이라고 직접 확인한 경우다 — 정규화 역명이 서로 달라도
      // (예: "총신대입구" ↔ "이수") 병합할 수 있다.
      uf.union(a.sourceRecordId, b.sourceRecordId)
      pairBasis.set(key, 'OFFICIAL_TRANSFER')
      return
    }

    // 같은 지역/인접 행정구역이 아니면 애초에 같은 역일 수 없다 — 검수도 필요 없이
    // 확정적으로 분리 유지한다 (규칙 7.4: 다른 도시·생활권에 위치함).
    if (!isSameOrAdjacentRegion(a.regionCode, b.regionCode)) {
      return
    }

    // 자동 판정 규칙(7.2)을 실제로 적용해본다. 원본에 좌표가 없으므로 대부분
    // 자동 병합 조건을 기계적으로 만족하지 못하고 수동 검수로 빠진다. 단,
    // 두 레코드 모두 출처에서 환승역으로 명시했다면 공식 환승 근거로 인정한다.
    const decision = decideMerge({
      normalizedName: a.normalizedName,
      regionCode: a.regionCode,
      officialTransferConfirmed: a.officialTransferConfirmed,
    }, {
      normalizedName: b.normalizedName,
      regionCode: b.regionCode,
      officialTransferConfirmed: b.officialTransferConfirmed,
    })
    if (decision.shouldAutoMerge) {
      uf.union(a.sourceRecordId, b.sourceRecordId)
      pairBasis.set(key, decision.basis!)
    } else {
      // 사용자 확인 정책: 같은 지역 안에서 정규화 역명이 일치하면 잠정 병합하되
      // 검수 리포트에 남긴다.
      uf.union(a.sourceRecordId, b.sourceRecordId)
      pairBasis.set(key, 'NAME_ONLY_PROVISIONAL')
      reviewPairs.push({
        left: a.sourceRecordId,
        right: b.sourceRecordId,
        reason: `잠정 병합(역명 일치 "${a.normalizedName}", 지역 ${a.regionCode}) — ${decision.reason}`,
      })
    }
  }

  for (const group of byName.values()) {
    if (group.length < 2) continue
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        evaluatePair(group[i], group[j])
      }
    }
  }

  // 정규화 역명이 서로 달라도(동명이 아니어도) 사람이 명시적으로 MERGE 한 쌍은
  // 위 이름 그룹 순회에서 만나지 못했을 수 있으니 별도로 처리한다.
  for (const o of overrides) {
    if (o.action !== 'MERGE') continue
    const a = candidateById.get(o.left_source_id)
    const b = candidateById.get(o.right_source_id)
    if (!a || !b) continue // validateOverridesReferenceKnownRecords 가 이미 걸러낸다
    evaluatePair(a, b)
  }

  const groupOf = new Map<string, string>()
  for (const c of candidates) {
    groupOf.set(c.sourceRecordId, uf.find(c.sourceRecordId))
  }
  return { groupOf, reviewPairs, pairBasis }
}

// --- 3. DB 생성 -----------------------------------------------------------

function pad(n: number, width = 6): string {
  return String(n).padStart(width, '0')
}

/** 그룹 안의 모든 실제 병합 쌍 중 가장 신뢰도가 낮은 근거를 그룹 전체의 근거로 삼는다. */
function computeGroupMergeBasis(members: StationCandidate[], pairBasis: Map<string, MergeBasis>): MergeBasis {
  let worst: MergeBasis | null = null
  for (let i = 0; i < members.length; i += 1) {
    for (let j = i + 1; j < members.length; j += 1) {
      const basis = pairBasis.get(pairKey(members[i].sourceRecordId, members[j].sourceRecordId))
      if (!basis) continue
      if (worst === null || MERGE_BASIS_CONFIDENCE[basis] < MERGE_BASIS_CONFIDENCE[worst]) worst = basis
    }
  }
  return worst ?? 'NAME_ONLY_PROVISIONAL'
}

interface StationNaming {
  officialName: string
  normalizedName: string
  subName: string | null
  initials: string
}

/**
 * 병합된 역의 대표 이름을 정한다. data/overrides/station-display-name.csv 에
 * 구성원 중 하나라도 지정되어 있으면 그 이름을 쓰고(예: "총신대입구(이수)"),
 * 아니면 그룹의 첫 구성원 이름을 그대로 쓴다.
 */
function resolveStationNaming(
  members: StationCandidate[],
  displayNameOverrides: Map<string, DisplayNameOverrideRow>,
): StationNaming {
  for (const m of members) {
    const override = displayNameOverrides.get(m.sourceRecordId)
    if (!override) continue
    const normalized = normalizeStationName(ensureStationSuffix(override.display_name))
    return {
      officialName: normalized.officialName,
      normalizedName: normalized.normalizedName,
      subName: normalized.subName,
      initials: normalized.initials,
    }
  }
  const representative = members[0]
  return {
    officialName: representative.officialName,
    normalizedName: representative.normalizedName,
    subName: representative.subName,
    initials: representative.initials,
  }
}

function main(): void {
  mkdirSync(dirname(OUTPUT_DB_PATH), { recursive: true })
  if (existsSync(OUTPUT_DB_PATH)) rmSync(OUTPUT_DB_PATH)

  const sources: SourceAdapterResult[] = SOURCE_LOADERS.map((load) => load())
  const overrides = readOverrides()
  const displayNameOverrides = readDisplayNameOverrides()
  const sequenceOverrides = readSequenceOverrides()
  const lineColorRows = parseLineColorsCsv(readFileSync(LINE_COLORS_PATH, 'utf-8'))

  const allLineDefinitions: Array<LineDefinition & { sourceId: string }> = sources.flatMap((s) =>
    s.lineDefinitions.map((def) => ({ ...def, sourceId: s.sourceId })),
  )

  const candidates: StationCandidate[] = sources.flatMap((s) => s.rows.map(buildCandidate))

  // 규칙 11장: "수동 예외가 참조하는 원본 ID 누락"은 여기서 확인해야 한다 — 병합되고
  // 나면 station 테이블에는 그룹당 대표 sourceRecordId 하나만 남으므로, 최종 DB를
  // 놓고 검사하면 병합된(대표가 아닌) id를 오탐으로 잡아낸다.
  validateOverridesReferenceKnownRecords(candidates, overrides)
  validateDisplayNameOverridesReferenceKnownRecords(candidates, displayNameOverrides)
  validateSequenceOverridesReferenceKnownRecords(candidates, sequenceOverrides)

  const { groupOf, reviewPairs, pairBasis } = resolveDuplicateGroups(candidates, overrides)

  // 그룹 대표 id → 그룹 구성원
  const membersByGroup = new Map<string, StationCandidate[]>()
  for (const c of candidates) {
    const groupId = groupOf.get(c.sourceRecordId)!
    const list = membersByGroup.get(groupId) ?? []
    list.push(c)
    membersByGroup.set(groupId, list)
  }

  const db = new DatabaseSync(OUTPUT_DB_PATH)
  db.exec(readFileSync(SCHEMA_PATH, 'utf-8'))
  db.exec('BEGIN')

  try {
    const now = new Date().toISOString()
    db.prepare(
      'INSERT INTO import_batch (import_batch_id, started_at, finished_at, description) VALUES (?, ?, ?, ?)',
    ).run(IMPORT_BATCH_ID, now, now, '전국(서울·수도권/부산/대구/광주/대전) 역명 + KTX/무궁화호 노선별 역정보 가져오기')

    const dataSourceStmt = db.prepare(
      `INSERT INTO data_source
        (source_id, provider_name, dataset_name, source_url, source_revision, reference_date, retrieved_at, license, import_batch_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const s of sources) {
      dataSourceStmt.run(
        s.sourceId,
        s.provider.providerName,
        s.provider.datasetName,
        s.provider.sourceUrl,
        s.provider.sourceRevision,
        s.provider.referenceDate,
        s.provider.retrievedAt,
        s.provider.license,
        IMPORT_BATCH_ID,
      )
    }

    // region — 5개 도시 지역은 실제 데이터가 있어 AVAILABLE. "KTX"는 도시 지역이
    // 아니라 열차 종류지만, 특정 지역에 묶이지 않고 전국을 가로지르는 노선을
    // 다루기 위해 지역과 같은 메커니즘(station/line의 region_code 기반 필터링·
    // 병합 판정)을 그대로 재사용하는 pseudo-region이다(ktxGameLineDefinitions.ts 참고).
    // "MUGUNGHWA"도 같은 이유의 pseudo-region이지만 "KTX"와는 별도로 둔다 —
    // 무궁화호가 KTX/SRT나 도시 지역과 실제로 같은 역을 써도 확실하지 않은 한
    // 자동으로 환승역 처리하지 않기 위해서다(사용자 확인, mugunghwaSource.ts 참고).
    const regionStmt = db.prepare(
      'INSERT INTO region (region_code, name_ko, status, sort_order) VALUES (?, ?, ?, ?)',
    )
    regionStmt.run('SEOUL_METRO', '서울·수도권', 'AVAILABLE', 1)
    regionStmt.run('BUSAN', '부산', 'AVAILABLE', 2)
    regionStmt.run('DAEGU', '대구', 'AVAILABLE', 3)
    regionStmt.run('GWANGJU', '광주', 'AVAILABLE', 4)
    regionStmt.run('DAEJEON', '대전', 'AVAILABLE', 5)
    regionStmt.run('KTX', 'KTX', 'AVAILABLE', 6)
    regionStmt.run('MUGUNGHWA', '무궁화호', 'AVAILABLE', 7)

    // train_service — KTX/무궁화호는 실제 정차역 데이터가 들어와 AVAILABLE이다.
    // ITX는 아직 데이터가 없어 COMING_SOON을 유지한다.
    // SRT는 2026-09-16(2차) 사용자 확인("KTX 노선 SRT 노선 병합... SRT 명도
    // KTX로 통합")에 따라 별도 train_service/scope_option을 두지 않는다 —
    // 옛 SRT(수서발) 노선들은 이제 line.train_service_code="KTX"로 합류하고,
    // "수서착발" 여부는 노선 이름 자체(예: "KTX-경부-수서착발")로 구분한다
    // (ktxGameLineDefinitions.ts 참고).
    const trainServiceStmt = db.prepare(
      'INSERT INTO train_service (train_service_code, name_ko, status, sort_order) VALUES (?, ?, ?, ?)',
    )
    trainServiceStmt.run('KTX', 'KTX', 'AVAILABLE', 1)
    trainServiceStmt.run('ITX', 'ITX', 'COMING_SOON', 2)
    trainServiceStmt.run('MUGUNGHWA', '무궁화호', 'AVAILABLE', 3)

    // scope_option — 화면 상단 "운행 범위 선택" 그리드. KTX는 kind가
    // TRAIN_SERVICE지만 region_code도 함께 "KTX"로 채운다(같은 pseudo-region을
    // 쓰는 노선이므로) — 다만 실제 화면 필터링은 region_code가 아니라
    // train_service_code로 한다(App.tsx의 candidatesForScope 참고). 무궁화호도
    // 같은 이유로 region_code를 자신의 pseudo-region("MUGUNGHWA")으로 채운다.
    const scopeStmt = db.prepare(
      `INSERT INTO scope_option (scope_code, kind, name_ko, status, sort_order, region_code, train_service_code)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    scopeStmt.run('ALL', 'ALL', '전체', 'AVAILABLE', 0, null, null)
    scopeStmt.run('SEOUL_METRO', 'REGION', '서울·수도권', 'AVAILABLE', 1, 'SEOUL_METRO', null)
    scopeStmt.run('BUSAN', 'REGION', '부산', 'AVAILABLE', 2, 'BUSAN', null)
    scopeStmt.run('DAEGU', 'REGION', '대구', 'AVAILABLE', 3, 'DAEGU', null)
    scopeStmt.run('GWANGJU', 'REGION', '광주', 'AVAILABLE', 4, 'GWANGJU', null)
    scopeStmt.run('DAEJEON', 'REGION', '대전', 'AVAILABLE', 5, 'DAEJEON', null)
    scopeStmt.run('KTX', 'TRAIN_SERVICE', 'KTX', 'AVAILABLE', 6, 'KTX', 'KTX')
    scopeStmt.run('ITX', 'TRAIN_SERVICE', 'ITX', 'COMING_SOON', 7, null, 'ITX')
    scopeStmt.run('MUGUNGHWA', 'TRAIN_SERVICE', '무궁화호', 'AVAILABLE', 8, 'MUGUNGHWA', 'MUGUNGHWA')

    // line + line_alias
    const lineStmt = db.prepare(
      `INSERT INTO line
        (line_id, line_code, official_name, display_name, icon_label, line_number, operator_code, region_code, train_service_code, color_hex, text_color_hex, parent_line_id, station_list_label, suppress_branch_tag, is_active, sort_order, source_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
    )
    const lineAliasStmt = db.prepare(
      'INSERT INTO line_alias (line_id, alias, normalized_alias) VALUES (?, ?, ?)',
    )
    // (regionCode, rawLineLabel) 로 조회해야 서로 다른 출처의 같은 문자열 라벨이 섞이지 않는다.
    const lineIdByRegionAndRawLabel = new Map<string, string>()
    const lineCodeSet = new Set(allLineDefinitions.map((def) => def.lineCode))
    const lineDefByCode = new Map(allLineDefinitions.map((def) => [def.lineCode, def]))
    // 지선은 대개 자기만의 공식 노선색이 따로 없다 — 색상 CSV에 없으면 부모 쪽
    // 색을 물려받는다(사용자 확인: 망우선은 경춘선과 같은 브랜드). "지선의 지선"
    // (예: 1호선 경부/장항선 안의 경부고속선·병점기지선, 확장 24)처럼 바로 위
    // 부모도 자기 색이 없을 수 있어, 색을 찾을 때까지 조상을 몇 단계든 거슬러
    // 올라간다.
    function findInheritedColor(lineCode: string): ReturnType<typeof findLineColor> {
      let current: string | undefined = lineCode
      const seen = new Set<string>()
      while (current && !seen.has(current)) {
        seen.add(current)
        const found = findLineColor(lineColorRows, current)
        if (found) return found
        current = lineDefByCode.get(current)?.parentLineCode
      }
      return undefined
    }
    for (const def of allLineDefinitions) {
      const lineId = `LN-${def.lineCode}`
      lineIdByRegionAndRawLabel.set(`${def.regionCode}::${def.rawLabel}`, lineId)
      const color = findLineColor(lineColorRows, def.lineCode)
      const parentColor = def.parentLineCode ? findInheritedColor(def.parentLineCode) : undefined
      if (def.parentLineCode && !lineCodeSet.has(def.parentLineCode)) {
        throw new Error(`LineDefinition "${def.lineCode}"의 parentLineCode "${def.parentLineCode}"를 찾을 수 없습니다.`)
      }
      lineStmt.run(
        lineId,
        def.lineCode,
        def.officialName,
        def.displayName,
        def.iconLabel,
        def.lineNumber,
        def.operatorCode,
        def.regionCode,
        def.trainServiceCode ?? null,
        color?.color_hex ?? parentColor?.color_hex ?? null,
        color?.text_color_hex ?? parentColor?.text_color_hex ?? null,
        def.parentLineCode ? `LN-${def.parentLineCode}` : null,
        def.stationListLabel ?? null,
        def.suppressBranchTag ? 1 : 0,
        def.sortOrder,
        def.sourceId,
      )
      for (const alias of def.aliases) {
        lineAliasStmt.run(lineId, alias, normalizeForCompare(alias))
      }
    }

    // station + station_group
    const stationStmt = db.prepare(
      `INSERT INTO station
        (station_id, official_name, normalized_name, sub_name, initials, region_code, latitude, longitude, station_group_id, is_active, opened_at, closed_at, source_id, source_record_id)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL, ?, 1, NULL, NULL, ?, ?)`,
    )
    const stationGroupStmt = db.prepare(
      'INSERT INTO station_group (station_group_id, normalized_name, merge_basis, notes) VALUES (?, ?, ?, ?)',
    )
    const stationAliasStmt = db.prepare(
      'INSERT INTO station_alias (station_id, alias, normalized_alias, alias_type) VALUES (?, ?, ?, ?)',
    )

    const stationIdByGroup = new Map<string, string>()
    const namingByGroup = new Map<string, StationNaming>()
    const hasDisplayOverrideByGroup = new Map<string, boolean>()
    let stationSeq = 0
    for (const [groupId, members] of membersByGroup) {
      stationSeq += 1
      const stationId = `STN-${pad(stationSeq)}`
      stationIdByGroup.set(groupId, stationId)
      const representative = members[0]
      const naming = resolveStationNaming(members, displayNameOverrides)
      namingByGroup.set(groupId, naming)
      hasDisplayOverrideByGroup.set(groupId, members.some((m) => displayNameOverrides.has(m.sourceRecordId)))

      const hasConfirmedTransfer = members.some((m) => m.officialTransferConfirmed)
      let stationGroupId: string | null = null
      if (members.length > 1) {
        stationGroupId = `SG-${pad(stationSeq)}`
        const memberIds = members.map((m) => `${m.sourceId}:${m.sourceRecordId}`).join(', ')
        const basis = computeGroupMergeBasis(members, pairBasis)
        const basisNote =
          basis === 'OFFICIAL_TRANSFER'
            ? '사람이 실제 환승역으로 확인함(공식 환승 근거).'
            : basis === 'COORDINATE'
              ? '좌표 500m 이내로 자동 병합됨.'
              : '잠정 병합 (좌표 데이터 없음) — 사람 검수 필요, data/generated/station-resolution-review.csv 참고.'
        stationGroupStmt.run(
          stationGroupId,
          naming.normalizedName,
          basis,
          `원본 레코드: ${memberIds}. ${basisNote}` +
            (hasConfirmedTransfer
              ? ' 출처 중 하나 이상이 환승역으로 표시함(참고 신호).'
              : ''),
        )
      }

      stationStmt.run(
        stationId,
        naming.officialName,
        naming.normalizedName,
        naming.subName,
        naming.initials,
        representative.regionCode,
        stationGroupId,
        representative.sourceId,
        representative.sourceRecordId,
      )

      // 괄호 안 부역명(station.sub_name)은 저장은 하되, 기본적으로는 별칭으로
      // 넣지 않는다 — 사용자 확인에 따라 검색에는 걸리지 않는다("봉황"으로는
      // 찾아도 "김해여객터미널" 단독으로는 찾지 않는다). 다만 화면에서 부역명까지
      // 함께 표시하기로 정한 역(SUB_NAME_DISPLAY_EXCEPTIONS, src/lib/displayName.ts —
      // "김천(구미)"·"울산(통도사)"·"쌍용(나사렛대)"·"총신대입구(이수)")은 그
      // 부역명만으로도 검색되어야 한다(사용자 확인: "부역명을 존치하기로 한 역은
      // 그 부역명으로도 검색이 가능하게 하자"). 공식 표시명(official_name)에는
      // 어느 쪽이든 부역명이 그대로 남아 있다.
      if (naming.subName && SUB_NAME_DISPLAY_EXCEPTIONS.has(naming.officialName)) {
        stationAliasStmt.run(stationId, naming.subName, normalizeForCompare(naming.subName), 'SUB_NAME')
      }

      // 병합됐지만 실제로는 서로 다른 정식 역명을 쓰는 역도 있다 — 예: 수도권
      // 1호선 "아산역"과 KTX/SRT "천안아산역"은 같은 역사를 공용하는 환승역이지만
      // 철도·전철 간 정식 명칭이 다르다(사용자 확인: "역명은 동기화하지 말고
      // 환승 정보만 공유"). 이런 경우 대표 이름(station.official_name)과 다른
      // 원래 이름을 가진 구성원이 있으면, 그 이름도 검색되도록 별칭으로 남긴다 —
      // 표시명 override(station-display-name.csv)로 이미 한 이름에 통일하기로
      // 확정된 역(예: 총신대입구(이수))은 애초에 원본부터 같은 이름이라 해당하지
      // 않는다.
      const seenOwnNames = new Set<string>([naming.normalizedName])
      for (const m of members) {
        if (seenOwnNames.has(m.normalizedName)) continue
        seenOwnNames.add(m.normalizedName)
        stationAliasStmt.run(stationId, m.officialName, normalizeForCompare(stripStationSuffix(m.officialName)), 'MISC')
      }

      // 영문 역명을 별칭으로 저장한다 (규칙 5.8: 영문은 소문자로 변환).
      const seenEnglish = new Set<string>()
      for (const m of members) {
        if (!m.englishName) continue
        const normalizedAlias = normalizeForeignAlias(m.englishName)
        if (normalizedAlias.length === 0 || seenEnglish.has(normalizedAlias)) continue
        seenEnglish.add(normalizedAlias)
        stationAliasStmt.run(stationId, m.englishName, normalizedAlias, 'FOREIGN_NAME')
      }
    }

    // station_line 안에서 물리적 순서를 매긴다 — 원본 STIN_CD(source_station_code)를
    // 노선(line_id) 단위로 자연 정렬한 순번이다(사용자 확인: "정렬 기준은 로우데이터의
    // STIN_CD 기준으로"). 같은 노선이 여러 운영기관 구간으로 나뉘어 있어도(예:
    // 1호선 = 한국철도공사+서울교통공사) line_id가 하나로 합쳐져 있으므로 그 안에서
    // 함께 정렬된다 — 원본 코드 자체가 구간을 이어 붙인 값이 아니라면 그 한계는
    // 원본 데이터의 한계다.
    const candidatesByLineId = new Map<string, StationCandidate[]>()
    for (const c of candidates) {
      const lineId = lineIdByRegionAndRawLabel.get(`${c.regionCode}::${c.rawLineLabel}`)!
      const list = candidatesByLineId.get(lineId) ?? []
      list.push(c)
      candidatesByLineId.set(lineId, list)
    }
    const sequenceBySourceRecordId = new Map<string, number>()
    for (const list of candidatesByLineId.values()) {
      const sortKeyOf = (c: StationCandidate): string =>
        sequenceOverrides.get(c.sourceRecordId) ?? c.sourceStationCode ?? ''
      const ordered = [...list].sort((a, b) => compareStationCode(sortKeyOf(a), sortKeyOf(b)))
      ordered.forEach((c, index) => sequenceBySourceRecordId.set(c.sourceRecordId, index + 1))
    }

    // station_line
    const stationLineStmt = db.prepare(
      `INSERT INTO station_line
        (station_line_id, station_id, line_id, source_station_code, display_station_name, sequence, is_express_stop, is_active)
       VALUES (?, ?, ?, ?, ?, ?, 0, 1)`,
    )
    let stationLineSeq = 0
    for (const c of candidates) {
      stationLineSeq += 1
      const groupId = groupOf.get(c.sourceRecordId)!
      const stationId = stationIdByGroup.get(groupId)!
      const lineId = lineIdByRegionAndRawLabel.get(`${c.regionCode}::${c.rawLineLabel}`)!
      // 사람이 이 병합 그룹 전체의 표시명을 명시적으로 정했다면(station-display-name.csv)
      // 그 이름을 모든 소속 노선에 똑같이 적용한다(예: 울산(통도사) — KTX/SRT 두
      // 노선 모두 같은 이름으로 보여야 한다). 그런 override가 없으면 각 노선은
      // 원본이 원래 부르던 자기 이름을 그대로 쓴다 — 그래야 같은 역으로 병합했어도
      // 실제로 이름이 다른 역(예: 1호선 "아산" ↔ KTX/SRT "천안아산")이 서로의
      // 이름을 강제로 덮어쓰지 않는다(사용자 확인: "역명은 동기화하지 말고 환승
      // 정보만 공유").
      const displayStationName = hasDisplayOverrideByGroup.get(groupId)
        ? namingByGroup.get(groupId)!.officialName
        : c.officialName
      stationLineStmt.run(
        `SL-${pad(stationLineSeq)}`,
        stationId,
        lineId,
        c.sourceStationCode ?? null,
        displayStationName,
        sequenceBySourceRecordId.get(c.sourceRecordId) ?? null,
      )
    }

    // manual_resolution — 리뷰 대상 + 기존 override 모두 기록
    const manualResolutionStmt = db.prepare(
      `INSERT INTO manual_resolution
        (action, left_source_id, right_source_id, canonical_station_id, reason, verified_by, verified_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const o of overrides) {
      manualResolutionStmt.run(
        o.action,
        o.left_source_id,
        o.right_source_id,
        o.canonical_station_id || null,
        o.reason || null,
        o.verified_by || null,
        o.verified_at || null,
      )
    }
    for (const pair of reviewPairs) {
      manualResolutionStmt.run('REVIEW', pair.left, pair.right, null, pair.reason, null, null)
    }

    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  } finally {
    db.close()
  }

  // 검수 리포트 CSV
  mkdirSync(dirname(REVIEW_REPORT_PATH), { recursive: true })
  writeFileSync(
    REVIEW_REPORT_PATH,
    writeCsv(
      ['action', 'left_source_id', 'right_source_id', 'canonical_station_id', 'reason', 'verified_by', 'verified_at'],
      reviewPairs.map((p) => ['REVIEW', p.left, p.right, '', p.reason, '', '']),
    ),
    'utf-8',
  )

  // 요약
  const summary = {
    importBatchId: IMPORT_BATCH_ID,
    sources: sources.map((s) => ({ sourceId: s.sourceId, rowCount: s.rows.length })),
    rawRowCount: candidates.length,
    importedStationLineCount: candidates.length,
    stationCount: membersByGroup.size,
    mergedGroupCount: [...membersByGroup.values()].filter((m) => m.length > 1).length,
    reviewPairCount: reviewPairs.length,
    lineCount: allLineDefinitions.length,
    regionCounts: Object.fromEntries(
      [...new Set(candidates.map((c) => c.regionCode))].map((region) => [
        region,
        candidates.filter((c) => c.regionCode === region).length,
      ]),
    ),
  }
  writeFileSync(IMPORT_SUMMARY_PATH, JSON.stringify(summary, null, 2) + '\n', 'utf-8')

  const exported = exportSearchIndex()
  console.log('✅ 가져오기 완료')
  console.table(summary)
  console.log(`✅ 검색 인덱스 내보내기 완료: ${exported.stationLineCount}건 → ${exported.outputPath}`)
}

main()
