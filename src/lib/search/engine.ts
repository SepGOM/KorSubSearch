/**
 * 검색 엔진 (규칙 8 전체). 순수 함수로 구현해 UI 프레임워크와 분리한다.
 *
 * 필터(운행 범위·노선 선택)는 이 함수를 호출하기 전에 candidate 배열을 좁히는
 * 방식으로 적용한다 — "필터 조건을 먼저 적용한 뒤 점수를 매긴다"(규칙 8.6)를
 * 그대로 반영한 구조다. 노선 번호 토큰("3", "3호선")은 여기서 추가 필터로
 * 처리하고 점수에는 반영하지 않는다.
 */

import { tokenizeQuery } from '../normalize/tokenize'
import { parseLineNumberToken } from '../normalize/line'
import { normalizeForCompare, stripStationSuffix } from '../normalize/text'
import { MATCH_CATEGORY_RANK, LINE_FILTER_ONLY_RANK, matchTextToken, type TokenMatch } from './score'
import type { LineRecord, StationLineRecord } from './types'
import { isSelfOrDescendantOf, rootLine } from './lineHierarchy'

interface Scored {
  record: StationLineRecord
  tokenMatches: TokenMatch[]
  bestRank: number
  bestMatchIndex: number
}

export const DEFAULT_RESULT_LIMIT = 10

export interface SearchOptions {
  /** 결과 최대 개수. 기본 10개 (규칙 8 자동완성 참고 패턴). */
  limit?: number
  /** 노선 선택 드롭다운에서 특정 노선만 볼 때 line_id 로 추가 필터링. */
  lineId?: string | null
  /** true 면 matchedFields/matchedTokens/scoreBreakdown 을 결과에 채워 반환한다. */
  debug?: boolean
}

export interface ScoreBreakdown {
  bestCategoryRank: number
  tokenMatches: TokenMatch[]
  lineNumberTokens: number[]
}

export interface SearchResultItem {
  record: StationLineRecord
  matchedTokens: string[]
  matchedFields: string[]
  scoreBreakdown?: ScoreBreakdown
}

function isActiveRecord(record: StationLineRecord): boolean {
  return record.isActive && record.stationIsActive && record.line.isActive
}

/**
 * 접두어 없는 숫자("1"~"9")만으로 가리킬 수 있는 수도권 1~9호선인지 — 인천
 * 1호선·부산 1호선·대구 1호선처럼 지역 이름이 붙은 노선은 해당하지 않는다
 * (사용자 확인: "1호선부터 9호선은 숫자로 명시... 비수도권은... 부1~4 등"). 이
 * 1~9호선은 전부 서울교통공사(SM) 또는 9호선 운영사(S9)가 운영한다는 구조적
 * 사실로 판정한다 — displayName은 2호선처럼 "을지로순환선"으로 커스터마이즈될
 * 수 있어(사용자 확인) 이름이 아니라 operatorCode로 판정해야 안정적이다.
 */
function isCanonicalNumberedLine(line: LineRecord): boolean {
  return line.operatorCode === 'SM' || line.operatorCode === 'S9'
}

/**
 * 레코드 하나가 토큰 전체를 만족하는지 확인한다 (AND 조건).
 * 통과하면 { tokenMatches, lineNumberTokens } 를, 아니면 null 을 반환한다.
 */
function evaluateRecord(
  record: StationLineRecord,
  lineNumberTokens: number[],
  textTokens: string[],
  ambiguousNumbers: Set<number>,
  lineById: Map<string, LineRecord>,
): { tokenMatches: TokenMatch[]; lineNumberTokens: number[] } | null {
  // 노선 번호·지역 모호성 판정은 최상위 본선 기준이다 — 병점기지선·경부고속선처럼
  // 지선의 지선은 lineNumber가 없지만 1호선의 일부이므로 "1"로 찾을 수 있어야 한다
  // (사용자 확인: "1 ㅂㅈ", "1 ㄱㅁ"으로 검색 불가 문제).
  const identityLine = rootLine(record.line, lineById)
  for (const number of lineNumberTokens) {
    if (identityLine.lineNumber !== number) return null
    // 같은 번호를 가진 노선이 지금 후보군 안에 여러 지역에 걸쳐 있으면(예:
    // "서울·수도권" 범위에서 1호선과 인천 1호선이 같이 있거나, "전체" 범위에서
    // 1~9호선에 부산·대구·광주·대전까지 겹치면) 접두어 없는 숫자만으로는 어느
    // 노선인지 알 수 없다 — 그럴 땐 "순수 N호선"(수도권)만 통과시키고, 나머지
    // 지역은 전용 키워드(부1·대구1·인1·광1·대전1 등)로만 찾게 한다. 반대로
    // 범위를 그 지역 하나로 좁혀서 겹칠 일이 없으면(후보군에 그 번호를 가진
    // 노선이 하나뿐이면) 평소처럼 숫자만으로 찾을 수 있다(사용자 확인: "운행
    // 범위를 부산으로 지정 시, 1만 적어도 부산 1호선이 검색되어야 한다").
    if (ambiguousNumbers.has(number) && !isCanonicalNumberedLine(identityLine)) return null
  }

  const tokenMatches: TokenMatch[] = []
  for (const token of textTokens) {
    const match = matchTextToken(token, record, lineById)
    if (!match) return null
    tokenMatches.push(match)
  }

  return { tokenMatches, lineNumberTokens }
}

function bestRankOf(tokenMatches: TokenMatch[]): number {
  if (tokenMatches.length === 0) return LINE_FILTER_ONLY_RANK
  return Math.min(...tokenMatches.map((m) => MATCH_CATEGORY_RANK[m.category]))
}

function bestMatchIndexOf(tokenMatches: TokenMatch[], bestRank: number): number {
  const atBestRank = tokenMatches.filter((m) => MATCH_CATEGORY_RANK[m.category] === bestRank)
  if (atBestRank.length === 0) return 0
  return Math.min(...atBestRank.map((m) => m.matchIndex))
}

/**
 * 동점일 때, 그 일치가 정말 "자기 자신의" 이름에서 온 것인지 가려낸다. 병합됐지만
 * 실제 이름이 서로 다른 역(예: 1호선 "아산" ↔ KTX/SRT "천안아산")은
 * station.normalized_name(그룹 대표 이름)과 station_alias가 둘 다 station_id
 * 단위로 붙어 병합 그룹의 모든 노선이 같이 공유한다 — 그래서 "아산"으로 검색해도
 * "천안아산"(KTX) 쪽 레코드가 대표 이름(정확일치, field='stationName')으로
 * 함께 걸리고, "천안아산"으로 검색해도 "아산"(1호선) 쪽이 공유 별칭(field='alias')
 * 으로 함께 걸린다 — 어느 쪽이든 실제로 자기 이름(displayStationName)에 검색어가
 * 들어있는 노선을 우선해야, 검색 결과 제목이 사용자가 실제로 입력한 이름과
 * 어긋나지 않는다(필드 종류와 무관하게 검사한다).
 */
function ownNameMatchesToken(record: StationLineRecord, tokenMatches: TokenMatch[]): boolean {
  const ownName = normalizeForCompare(stripStationSuffix(record.displayStationName))
  // 부분 포함(includes)이 아니라 완전히 같은지(===)를 본다 — "아산"으로 검색하면
  // "아산"(1호선 계열)의 짧은 이름은 "천안아산"(KTX)의 own name 안에도 부분
  // 문자열로 포함돼 있어, includes 기준으로는 둘 다 "자기 이름과 일치"로 잡혀
  // 다시 동점이 나 버린다. 정확히 같은 경우만 "진짜 자기 이름"으로 인정한다.
  return tokenMatches.some((m) => {
    const compareToken = normalizeForCompare(stripStationSuffix(m.token))
    return compareToken.length > 0 && ownName === compareToken
  })
}

/**
 * candidates 를 토큰 매칭·채점하고 정렬까지 마친 전체 목록을 반환한다(자르지 않음).
 * search()와 searchGrouped() 가 공유하는 내부 코어.
 */
function evaluateAndSort(
  candidates: StationLineRecord[],
  query: string,
  lineId: string | null | undefined,
): Scored[] {
  const tokens = tokenizeQuery(query)
  if (tokens.length === 0) return []

  const lineNumberTokens: number[] = []
  const textTokens: string[] = []
  for (const token of tokens) {
    const asNumber = parseLineNumberToken(token)
    if (asNumber !== null) {
      lineNumberTokens.push(asNumber)
    } else {
      textTokens.push(token)
    }
  }

  // "노선 선택"으로 본선을 고르면 그 지선(parentLineId가 이 노선을 가리키는 노선)
  // 소속 역도 함께 검색 대상에 넣는다 — 서울역처럼 물리적으로 지선(경의1선)에만
  // 속한 역은 본선(경의중앙선) 레코드 자체가 없어, 지선을 포함하지 않으면 본선을
  // 선택한 채로는 절대 찾을 수 없어진다(사용자 확인: "지선에있는 역들은 검색이
  // 안되네"). "이 노선의 역 보기" 패널에서 지선을 본선 아래 별도 패널로 보여주는
  // 것과 같은 원칙 — 지선은 본선 선택 범위에 포함된 것으로 취급한다.
  // 지선의 본선 정체성을 찾거나(키워드 매칭용), 노선 번호가 지금 후보군 안에서
  // 여러 노선에 겹쳐 있는지(지역 모호성 판정용) 확인하는 데 쓸 조회용 자료. 부모 노선
  // 레코드가 노선 선택 등으로 걸러져 없어도 계층을 따라 올라갈 수 있도록 candidates
  // 전체로 만든다.
  const lineById = new Map<string, LineRecord>()
  for (const r of candidates) lineById.set(r.line.lineId, r.line)

  // 지선은 몇 단계 아래든(1호선 → 경부/장항선 → 병점기지선) 본선 선택 범위에 포함된다.
  const scoped = lineId
    ? candidates.filter((record) => isSelfOrDescendantOf(record.line, lineId, lineById))
    : candidates

  const ambiguousNumbers = new Set<number>()
  for (const number of lineNumberTokens) {
    const linesForNumber = new Set<string>()
    for (const r of scoped) {
      const identity = rootLine(r.line, lineById)
      if (identity.lineNumber === number) linesForNumber.add(identity.lineId)
    }
    if (linesForNumber.size > 1) ambiguousNumbers.add(number)
  }

  const scoredResults: Scored[] = []
  for (const record of scoped) {
    const evaluation = evaluateRecord(record, lineNumberTokens, textTokens, ambiguousNumbers, lineById)
    if (!evaluation) continue
    const bestRank = bestRankOf(evaluation.tokenMatches)
    const bestMatchIndex = bestMatchIndexOf(evaluation.tokenMatches, bestRank)
    scoredResults.push({ record, tokenMatches: evaluation.tokenMatches, bestRank, bestMatchIndex })
  }

  scoredResults.sort((a, b) => {
    if (a.bestRank !== b.bestRank) return a.bestRank - b.bestRank

    const activeA = isActiveRecord(a.record) ? 0 : 1
    const activeB = isActiveRecord(b.record) ? 0 : 1
    if (activeA !== activeB) return activeA - activeB

    if (a.bestMatchIndex !== b.bestMatchIndex) return a.bestMatchIndex - b.bestMatchIndex

    const ownMatchA = ownNameMatchesToken(a.record, a.tokenMatches) ? 0 : 1
    const ownMatchB = ownNameMatchesToken(b.record, b.tokenMatches) ? 0 : 1
    if (ownMatchA !== ownMatchB) return ownMatchA - ownMatchB

    const sourceA = a.record.sourcePriority ?? Number.MAX_SAFE_INTEGER
    const sourceB = b.record.sourcePriority ?? Number.MAX_SAFE_INTEGER
    if (sourceA !== sourceB) return sourceA - sourceB

    const nameCompare = a.record.officialStationName.localeCompare(b.record.officialStationName, 'ko')
    if (nameCompare !== 0) return nameCompare

    return a.record.line.sortOrder - b.record.line.sortOrder
  })

  return scoredResults
}

export function search(
  candidates: StationLineRecord[],
  query: string,
  options: SearchOptions = {},
): SearchResultItem[] {
  const limit = options.limit ?? DEFAULT_RESULT_LIMIT
  const scoredResults = evaluateAndSort(candidates, query, options.lineId)
  const lineNumberTokens = tokenizeQuery(query)
    .map(parseLineNumberToken)
    .filter((n): n is number => n !== null)

  return scoredResults.slice(0, limit).map((scored) => {
    const item: SearchResultItem = {
      record: scored.record,
      matchedTokens: scored.tokenMatches.map((m) => m.token),
      matchedFields: Array.from(new Set(scored.tokenMatches.map((m) => m.field))),
    }
    if (options.debug) {
      item.scoreBreakdown = {
        bestCategoryRank: scored.bestRank,
        tokenMatches: scored.tokenMatches,
        lineNumberTokens,
      }
    }
    return item
  })
}

// ---------------------------------------------------------------------------
// 역 단위로 묶은 자동완성 표시 (환승역은 한 행에 노선 배지 여러 개)
// ---------------------------------------------------------------------------
//
// StationLine 은 여전히 검색·채점의 기본 단위지만(동명이역과 환승역을 정확히
// 구분하려면 그래야 한다), 자동완성 화면은 같은 station_id 를 가진 결과를
// 한 행으로 모아 보여준다 — 실제로 병합된(환승) 역만 한 행에 여러 노선
// 배지가 붙고, station_id 가 다른 동명이역(예: 신촌 2호선 vs 신촌 경의중앙선)은
// 여전히 별도 행으로 남는다. station_id 병합 여부 자체는 가져오기 단계의
// 자동/수동 판정(규칙 7.2, data/overrides/station-resolution.csv)이 결정한다.

export const DEFAULT_GROUP_RESULT_LIMIT = 10

export interface StationSearchGroupLine {
  stationLineId: string
  line: LineRecord
  isActive: boolean
}

export interface StationSearchGroup {
  stationId: string
  officialStationName: string
  /**
   * 화면에 보여줄 이름 — 이 그룹에서 가장 잘 맞은(순위가 가장 높은) 결과가
   * 속한 노선 자신의 이름이다. 보통 officialStationName과 같지만, 병합은
   * 됐어도 실제로는 서로 다른 정식 역명을 쓰는 역(예: 1호선 "아산" ↔ KTX/SRT
   * "천안아산")은 검색어에 따라 달라진다 — "아산"으로 찾으면 "아산", "천안아산"
   * 으로 찾으면 "천안아산"이 나온다(사용자 확인: "역명은 동기화하지 말고
   * 환승 정보만 공유").
   */
  displayStationName: string
  normalizedStationName: string
  subName: string | null
  regionCode: string
  stationIsActive: boolean
  /** 노선 정렬 순서(line.sortOrder)로 정렬됨. 환승역이면 2개 이상. */
  lines: StationSearchGroupLine[]
  matchedTokens: string[]
  matchedFields: string[]
}

export interface SearchGroupedOptions extends SearchOptions {
  /**
   * 환승 배지 계산에 쓸 전체(비범위) station_line. 검색 자체(어떤 역이
   * 결과에 포함되는가, 순서·점수)는 항상 candidates(운행 범위·노선 선택으로
   * 좁힌 배열)만 본다 — 이 옵션은 결과로 뽑힌 역 각각에 "이 역에서 갈아탈 수
   * 있는 다른 노선" 배지를 붙일 때만 쓰인다. 지정하면 지금 고른 범위/노선과
   * 무관하게 이 역과 실제로 병합된 모든 노선이 함께 나온다 — "이 노선의 역
   * 보기"(LineStationsPanel)에 적용한 것과 같은 원칙(사용자 확인). 지정하지
   * 않으면 기존처럼 candidates 안에 있는 노선만 모은다.
   */
  allStationLines?: StationLineRecord[]
}

export function searchGrouped(
  candidates: StationLineRecord[],
  query: string,
  options: SearchGroupedOptions = {},
): StationSearchGroup[] {
  const limit = options.limit ?? DEFAULT_GROUP_RESULT_LIMIT
  // 그룹 단위로 개수를 제한해야 하므로, 먼저 전체를 채점·정렬한 뒤 station_id로
  // 묶고 나서 그룹 개수를 자른다 (StationLine 개수로 먼저 자르면 환승역의
  // 나머지 노선이 잘려나갈 수 있다).
  const scoredResults = evaluateAndSort(candidates, query, options.lineId)

  // 지선 소속 노선을 그 본선의 정체성으로 치환하기 위한 조회용 맵 — candidates와
  // (있다면) allStationLines 양쪽에서 노선 정보를 모은다.
  const lineById = new Map<string, LineRecord>()
  for (const r of candidates) lineById.set(r.line.lineId, r.line)
  if (options.allStationLines) {
    for (const r of options.allStationLines) lineById.set(r.line.lineId, r.line)
  }

  const groupsInOrder: StationSearchGroup[] = []
  const groupByStationId = new Map<string, StationSearchGroup>()

  // 지선은 배지에서 항상 본선 이름으로 나온다(사용자 확인: "전체 노선에서도...
  // 큰 노선만 하나만 표기") — 그래서 중복 판정도 원래 station_line_id가 아니라
  // 치환된 노선의 line_id로 한다(같은 역이 본선·지선 두 레코드를 다 가져도
  // 배지는 하나만 남는다).
  function addLine(group: StationSearchGroup, record: StationLineRecord): void {
    const displayLine = resolveDisplayLine(record.line, lineById)
    if (!group.lines.some((l) => l.line.lineId === displayLine.lineId)) {
      group.lines.push({ stationLineId: record.stationLineId, line: displayLine, isActive: record.isActive })
    }
  }

  for (const scored of scoredResults) {
    const { record } = scored
    let group = groupByStationId.get(record.stationId)
    if (!group) {
      group = {
        stationId: record.stationId,
        officialStationName: record.officialStationName,
        displayStationName: record.displayStationName,
        normalizedStationName: record.normalizedStationName,
        subName: record.subName,
        regionCode: record.regionCode,
        stationIsActive: record.stationIsActive,
        lines: [],
        matchedTokens: [],
        matchedFields: [],
      }
      groupByStationId.set(record.stationId, group)
      groupsInOrder.push(group)
    }
    addLine(group, record)
    for (const t of scored.tokenMatches) {
      if (!group.matchedTokens.includes(t.token)) group.matchedTokens.push(t.token)
      if (!group.matchedFields.includes(t.field)) group.matchedFields.push(t.field)
    }
  }

  if (options.allStationLines) {
    const activeLinesByStation = new Map<string, StationLineRecord[]>()
    for (const r of options.allStationLines) {
      if (!isActiveRecord(r)) continue
      const list = activeLinesByStation.get(r.stationId) ?? []
      list.push(r)
      activeLinesByStation.set(r.stationId, list)
    }
    for (const group of groupsInOrder) {
      for (const r of activeLinesByStation.get(group.stationId) ?? []) {
        addLine(group, r)
      }
    }
  }

  for (const group of groupsInOrder) {
    group.lines.sort((a, b) => a.line.sortOrder - b.line.sortOrder)
  }

  return groupsInOrder.slice(0, limit)
}

// ---------------------------------------------------------------------------
// 특정 노선의 전체 역 목록 (범위 + 노선 선택 후 "이 노선의 역 보기")
// ---------------------------------------------------------------------------
//
// 검색어 없이, 선택된 노선(line_id) 하나에 속한 역 전체를 물리적 순서
// (station_line.sequence — 원본 STIN_CD 자연 정렬 기준)로 나열한다. 환승역이면
// 그 역에서 갈아탈 수 있는 다른 노선도 함께 보여준다.

export interface LineStationEntry {
  stationId: string
  stationLineId: string
  officialStationName: string
  /**
   * 화면에 보여줄 이름 — 이 노선 자신이 부르는 이름이다. 보통 officialStationName과
   * 같지만, 병합은 됐어도 실제로는 서로 다른 정식 역명을 쓰는 역(예: 1호선
   * "아산" ↔ KTX/SRT "천안아산")은 노선마다 다르다 — 1호선 목록엔 "아산", KTX
   * 목록엔 "천안아산"이 나온다(사용자 확인: "역명은 동기화하지 말고 환승 정보만
   * 공유").
   */
  displayStationName: string
  subName: string | null
  /** 1부터 시작하는 노선 안에서의 순서. 원본에 순서 정보가 없으면 null(맨 뒤로 정렬). */
  sequence: number | null
  isExpressStop: boolean
  /**
   * 이 역에서 갈아탈 수 있는, 이 노선을 제외한 다른 노선들(정렬 순서대로).
   * 지선은 여기 안 나온다 — 본선/지선 관계인 노선끼리는 서로 배지로 보여주지
   * 않는다(사용자 확인: "지선간 분리되는 부분에 있어서 환승 알을 표기할 필요
   * 없어"). 지선 소속 노선은 항상 그 본선의 정체성으로 치환해 보여준다("전체
   * 노선에서도... 큰 노선만 하나만 표기") — 예: 오금역을 3호선 목록에서 보면
   * "마천지선"이 아니라 "5호선" 배지가 붙는다.
   */
  transferLines: LineRecord[]
  /**
   * 지선이 갈라지는 분기역이면, 여기서 갈라지는 지선들(정렬 순서대로) — 환승
   * 배지가 아니라 화면에서 별도 표시(구분선 등)로 보여주기 위한 용도다
   * (사용자 확인: "지선 분기에 대해서는 본선에서 표기하는 게 있었으면").
   * 지선이 아닌 노선을 보고 있거나 분기역이 아니면 빈 배열.
   */
  branchLines: LineRecord[]
}

/**
 * 지선 소속 노선을 최상위 본선의 정체성으로 치환한다. 본선이면 그대로 둔다.
 * "지선의 지선"(병점기지선·경부고속선)도 한 단계 위(경부/장항선)가 아니라 맨 위(1호선)로
 * 올라간다 — 안 그러면 병점·금천구청처럼 지선이 갈라지는 역에 같은 "1" 아이콘 배지가
 * 두 개 붙는다(사용자 확인: "지선일 뿐, 환승정보가 아님").
 */
function resolveDisplayLine(line: LineRecord, lineById: Map<string, LineRecord>): LineRecord {
  return rootLine(line, lineById)
}

/**
 * 두 노선이 같은 본선-지선 계열인지(자기 자신 포함) 확인한다. 부모-자식뿐 아니라
 * 형제(같은 부모를 공유하는 자식끼리)도 같은 계열로 본다 — 무궁화호처럼 한
 * 그룹 안에 운행계통(패턴)이 셋 이상이면(예: 호남선의 "용산-목포"·"광주-목포")
 * 대표가 아닌 두 자식끼리도 구간이 겹칠 수 있는데, 그 사이에도 서로 환승
 * 배지를 보여주면 안 되기 때문이다(사용자 확인: "운행방식에 대한 환승 알은
 * 표기하지 않아").
 */
function isSameLineFamily(a: LineRecord, b: LineRecord, lineById: Map<string, LineRecord>): boolean {
  // 최상위 본선이 같으면 같은 계열이다(부모-자식·형제뿐 아니라 지선의 지선까지).
  return rootLine(a, lineById).lineId === rootLine(b, lineById).lineId
}

/**
 * candidates 중 특정 노선(lineId)에 속한 역을 sequence 순으로 나열한다.
 * 검색 점수와는 무관하며, 비활성 역/노선은 제외한다.
 */
export function listStationsOnLine(candidates: StationLineRecord[], lineId: string): LineStationEntry[] {
  const onLine = candidates.filter(
    (r) => r.line.lineId === lineId && r.isActive && r.stationIsActive && r.line.isActive,
  )
  const viewedLine = onLine[0]?.line ?? null

  const lineById = new Map<string, LineRecord>()
  for (const r of candidates) lineById.set(r.line.lineId, r.line)

  const stationIdsOnLine = new Set(onLine.map((r) => r.stationId))
  const otherLinesByStation = new Map<string, LineRecord[]>()
  const branchLinesByStation = new Map<string, LineRecord[]>()
  for (const r of candidates) {
    if (!stationIdsOnLine.has(r.stationId)) continue
    if (viewedLine && isSameLineFamily(r.line, viewedLine, lineById)) {
      // 본선-지선 관계는 서로 환승 배지로 보여주지 않는다. 대신 "지금 보는
      // 노선"의 지선이 바로 이 역에서 갈라지는 것이면(자기 자신은 제외) 분기
      // 표시용으로 따로 기록해 둔다 — 다만 물리적 분기가 아니라 같은 노선의
      // 운행계통 변형(suppressBranchTag)이면 이 표시를 붙이지 않는다(구간이
      // 대부분 그대로 겹쳐서 거의 모든 역에 붙어 버리기 때문).
      if (r.line.lineId !== lineId && r.line.parentLineId === lineId && !r.line.suppressBranchTag) {
        const list = branchLinesByStation.get(r.stationId) ?? []
        if (!list.some((l) => l.lineId === r.line.lineId)) list.push(r.line)
        branchLinesByStation.set(r.stationId, list)
      }
      continue
    }
    if (r.line.lineId === lineId) continue
    const displayLine = resolveDisplayLine(r.line, lineById)
    const list = otherLinesByStation.get(r.stationId) ?? []
    if (!list.some((l) => l.lineId === displayLine.lineId)) list.push(displayLine)
    otherLinesByStation.set(r.stationId, list)
  }
  for (const list of otherLinesByStation.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder)
  }
  for (const list of branchLinesByStation.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder)
  }

  const sorted = [...onLine].sort((a, b) => {
    const seqA = a.sequence ?? Number.MAX_SAFE_INTEGER
    const seqB = b.sequence ?? Number.MAX_SAFE_INTEGER
    if (seqA !== seqB) return seqA - seqB
    return a.officialStationName.localeCompare(b.officialStationName, 'ko')
  })

  return sorted.map((r) => ({
    stationId: r.stationId,
    stationLineId: r.stationLineId,
    officialStationName: r.officialStationName,
    displayStationName: r.displayStationName,
    subName: r.subName,
    sequence: r.sequence,
    isExpressStop: r.isExpressStop,
    transferLines: otherLinesByStation.get(r.stationId) ?? [],
    branchLines: branchLinesByStation.get(r.stationId) ?? [],
  }))
}
