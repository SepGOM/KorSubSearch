/**
 * data/normalized/*.csv (split-national-source.ts 가 만든 지역별 파일)를 읽어
 * 표준 SourceAdapterResult로 변환한다. 다섯 지역 모두 같은 로더를 재사용한다.
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'csv-parse/sync'
import type { LineDefinition, RawStationInput, SourceAdapterResult } from './types'
import { findLineDefinition } from './types'
import {
  NATIONAL_SOURCE_ID,
  SEOUL_METRO_LINE_DEFINITIONS,
  BUSAN_LINE_DEFINITIONS,
  DAEGU_LINE_DEFINITIONS,
  GWANGJU_LINE_DEFINITIONS,
  DAEJEON_LINE_DEFINITIONS,
  RECLASSIFIED_LINE_CODE_BY_SOURCE_RECORD_ID,
  SEOUL_METRO_BRANCH_SYNTHETIC_ROWS,
} from './nationalLineDefinitions'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..', '..')

interface NormalizedRow {
  region_code: string
  line_code: string
  source_record_id: string
  operator_code_raw: string
  operator_name_raw: string
  line_code_raw: string
  line_name_raw: string
  station_code_raw: string
  station_name_raw: string
}

const PROVIDER = {
  providerName: '국가철도공단 (역사고유번호 표준 코드)',
  datasetName: '운영기관_역사_코드정보',
  sourceUrl: null,
  sourceRevision: null,
  referenceDate: '2026-07-11',
  retrievedAt: '2026-09-07',
  license: '공공데이터포털 표준 이용약관 추정 (원문 확인 필요)',
  notes: [
    '사용자가 프로젝트 데이터 디렉터리에 직접 추가한 파일. 파일명("운영기관_역사_코드정보_2026.07.11_일반.xlsx")의 날짜를 기준일로 썼다. 정확한 원본 URL·제공기관·리비전은 미상.',
    '전국 도시철도·광역철도 역을 다루며, 서울·수도권/부산/대구/광주/대전 5개 지역으로 분류해 data/normalized/*.csv 로 나눴다(scripts/import/split-national-source.ts).',
    '인천국제공항 자기부상철도(자기부상, 6개 역)는 사용자 확인에 따라 이번 버전에서 제외했다.',
    '같은 노선이 구간별로 운영기관이 달라 원본에서 여러 (운영기관,노선코드) 조합으로 나뉜 경우(예: 1호선 = 서울교통공사+한국철도공사, 4호선 = +남양주도시공사, 8호선 = +구리도시공사, 7호선 = +인천교통공사, 서해선 = 한국철도공사+서해철도) 사용자 확인에 따라 하나의 노선으로 합쳤다(scripts/import/sources/nationalLineDefinitions.ts).',
    '이 파일에는 영문 역명·주소·환승역여부 컬럼이 없어, 이전 버전에 있던 부산 역들의 영문 별칭은 이번 재가져오기에서 빠졌다(사용자 확인).',
  ],
}

function loadRegionCsv(fileName: string): NormalizedRow[] {
  const path = resolve(ROOT, 'data/normalized', fileName)
  const text = readFileSync(path, 'utf-8')
  return parse(text, { columns: true, skip_empty_lines: true }) as NormalizedRow[]
}

export function loadNationalRegionSource(
  regionCode: string,
  fileName: string,
  lineDefinitions: LineDefinition[],
): SourceAdapterResult {
  // data_source 테이블은 source_id가 PK라 지역마다 별도 id를 쓴다 — 물리적으로는
  // 같은 원본 xlsx 하나에서 나왔지만, 지역별 정규화 파일(재생성 1단계 산출물)
  // 단위로 출처를 추적한다.
  const sourceId = `${NATIONAL_SOURCE_ID}-${regionCode}`
  const rows = loadRegionCsv(fileName)
  const result: RawStationInput[] = []

  for (const row of rows) {
    // 지선(branch line) 보정: 원본이 본선과 같은 line_code로 묶어놓은 특정
    // 레코드만 사람이 확인해 다른 line_code로 재분류한다(nationalLineDefinitions.ts
    // 참고 — 예: 경춘선 광운대는 실제로 망우선 소속).
    const effectiveLineCode = RECLASSIFIED_LINE_CODE_BY_SOURCE_RECORD_ID[row.source_record_id] ?? row.line_code
    const def = findLineDefinition(lineDefinitions, effectiveLineCode)
    if (!def) continue // 매핑 단계에서 이미 검증했으므로 원칙적으로 발생하지 않는다.
    result.push({
      sourceId,
      sourceRecordId: row.source_record_id,
      regionCode,
      rawLineLabel: effectiveLineCode,
      officialNameRaw: row.station_name_raw,
      // 노선 내 역 순서 계산(station_line.sequence)의 정렬 기준. 원본 STIN_CD를
      // 그대로 둔다 — 표시하지 않고 정렬에만 쓴다.
      sourceStationCode: row.station_code_raw,
    })
  }

  return {
    sourceId,
    provider: PROVIDER,
    lineDefinitions,
    rows: result,
  }
}

export const loadSeoulMetroNationalSource = (): SourceAdapterResult => {
  const result = loadNationalRegionSource('SEOUL_METRO', 'seoul-metro-stations.csv', SEOUL_METRO_LINE_DEFINITIONS)
  // 지선 보정용 합성 레코드(원본 표에는 없음, nationalLineDefinitions.ts 참고)를
  // 덧붙인다 — 같은 출처(sourceId)로 기록해 별도 data_source 등록 없이 처리한다.
  const syntheticRows: RawStationInput[] = SEOUL_METRO_BRANCH_SYNTHETIC_ROWS.map((row) => ({
    ...row,
    sourceId: result.sourceId,
  }))
  return { ...result, rows: [...result.rows, ...syntheticRows] }
}

export const loadBusanNationalSource = (): SourceAdapterResult =>
  loadNationalRegionSource('BUSAN', 'busan-stations.csv', BUSAN_LINE_DEFINITIONS)

export const loadDaeguNationalSource = (): SourceAdapterResult =>
  loadNationalRegionSource('DAEGU', 'daegu-stations.csv', DAEGU_LINE_DEFINITIONS)

export const loadGwangjuNationalSource = (): SourceAdapterResult =>
  loadNationalRegionSource('GWANGJU', 'gwangju-stations.csv', GWANGJU_LINE_DEFINITIONS)

export const loadDaejeonNationalSource = (): SourceAdapterResult =>
  loadNationalRegionSource('DAEJEON', 'daejeon-stations.csv', DAEJEON_LINE_DEFINITIONS)
