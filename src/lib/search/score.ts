/**
 * 검색 점수 산정 (규칙 8.6 / data-integration-rules.md 8.6).
 *
 * 1. 역명 완전일치      2. 역명 시작일치       3. 역명 일반 부분일치
 * 4. 초성열 완전일치    5. 초성열 시작일치     6. 초성열 연속 부분일치
 * 7. 별칭 일치 (노선명·노선 별칭·역 별칭을 포함)
 * 8. 오타 유사일치
 *
 * 숫자가 낮을수록 더 좋은 일치다. 노선 번호 토큰("3", "3호선")은 점수가 아니라
 * 통과/탈락을 가르는 필수 조건으로 별도 처리한다 (score 하지 않음).
 */

import { includesConsecutiveInitials, initialsExactMatch, initialsStartsWith, isInitialsQuery } from '../normalize/hangul'
import { normalizeForCompare, stripStationSuffix } from '../normalize/text'
import { fuzzyIncludes } from '../normalize/fuzzy'
import type { LineRecord, StationLineRecord } from './types'

export type MatchCategory =
  | 'STATION_EXACT'
  | 'STATION_PREFIX'
  | 'STATION_SUBSTRING'
  | 'INITIALS_EXACT'
  | 'INITIALS_PREFIX'
  | 'INITIALS_SUBSTRING'
  | 'ALIAS_MATCH'
  | 'FUZZY_MATCH'

/** 낮을수록 우선순위가 높다 (1위 = 역명 완전일치). */
export const MATCH_CATEGORY_RANK: Record<MatchCategory, number> = {
  STATION_EXACT: 1,
  STATION_PREFIX: 2,
  STATION_SUBSTRING: 3,
  INITIALS_EXACT: 4,
  INITIALS_PREFIX: 5,
  INITIALS_SUBSTRING: 6,
  ALIAS_MATCH: 7,
  FUZZY_MATCH: 8,
}

/** 필터 전용 토큰 (노선 번호). 점수 랭크에는 포함되지 않는다. */
export const LINE_FILTER_ONLY_RANK = 9

export interface TokenMatch {
  token: string
  category: MatchCategory
  field: 'stationName' | 'initials' | 'alias'
  /** 일치 위치 (일반 부분일치일 때 앞쪽일수록 우선). 알 수 없으면 0. */
  matchIndex: number
}

/**
 * 하나의 텍스트 토큰(노선 번호가 아닌 토큰)을 레코드에 대해 채점한다.
 * 초성 입력이면 역 초성열만 대상으로, 아니면 역명 → 별칭(노선명·별칭 포함) →
 * 오타 유사 순으로 시도한다. 어느 것도 맞지 않으면 null (AND 조건 탈락).
 */
export function matchTextToken(
  rawToken: string,
  record: StationLineRecord,
  lineById?: Map<string, LineRecord>,
): TokenMatch | null {
  if (isInitialsQuery(rawToken)) {
    const needle = rawToken.replace(/\s+/g, '')
    const haystack = record.stationInitials
    if (initialsExactMatch(haystack, needle)) {
      return { token: rawToken, category: 'INITIALS_EXACT', field: 'initials', matchIndex: 0 }
    }
    if (initialsStartsWith(haystack, needle)) {
      return { token: rawToken, category: 'INITIALS_PREFIX', field: 'initials', matchIndex: 0 }
    }
    if (includesConsecutiveInitials(haystack, needle)) {
      return {
        token: rawToken,
        category: 'INITIALS_SUBSTRING',
        field: 'initials',
        matchIndex: haystack.indexOf(needle),
      }
    }
    return null
  }

  const compareToken = normalizeForCompare(stripStationSuffix(rawToken))
  if (compareToken.length === 0) return null

  const stationName = record.normalizedStationName
  if (stationName === compareToken) {
    return { token: rawToken, category: 'STATION_EXACT', field: 'stationName', matchIndex: 0 }
  }
  if (stationName.startsWith(compareToken)) {
    return { token: rawToken, category: 'STATION_PREFIX', field: 'stationName', matchIndex: 0 }
  }
  const substringIndex = stationName.indexOf(compareToken)
  if (substringIndex >= 0) {
    return { token: rawToken, category: 'STATION_SUBSTRING', field: 'stationName', matchIndex: substringIndex }
  }

  // 별칭 일치: 역 별칭 + 노선 공식명/표시명/별칭을 한데 묶어 검사한다.
  // 지선(parentLineId가 있는 노선) 소속 레코드는 지선 자신의 이름이 아니라
  // 본선(parent) 쪽 이름·별칭만 노선 키워드로 매칭되게 한다(사용자 확인:
  // "필터링 되는 노선 명 키워드는 본선명 즉 parents 명만 검색하는걸로. 마천지선
  // 또는 경의1선과 같은걸로는 필터링 되지 않게") — lineById가 없거나 본선 정보를
  // 못 찾으면(예: 단위 테스트에서 부모 레코드를 안 넘긴 경우) 안전하게 자기
  // 자신의 이름으로 대체한다.
  const keywordLine = (record.line.parentLineId && lineById?.get(record.line.parentLineId)) || record.line
  const aliasHaystacks = [
    ...record.aliases,
    keywordLine.normalizedName,
    ...keywordLine.aliases,
  ]
  for (const alias of aliasHaystacks) {
    const idx = alias.indexOf(compareToken)
    if (idx >= 0) {
      return { token: rawToken, category: 'ALIAS_MATCH', field: 'alias', matchIndex: idx }
    }
  }

  // 오타 유사일치: 역명 먼저, 그다음 별칭/노선명. 단, 검색어에 숫자가 섞여 있으면
  // 오타 유사일치를 적용하지 않는다 — 숫자는 "1"과 "2"처럼 실제로 다른 대상을
  // 가리키는 정확한 식별자이지 오타가 아니고, 짧은 지역 키워드("대구1"·"대전1")는
  // 길이가 3자뿐이라 편집 거리 1 허용 폭 안에서 서로("대구1"↔"대구2호선"의 부분
  // 문자열, "대구1"↔"대전...") 뒤섞여 버린다 — 이 코드들을 도입한 목적(지역
  // 구분)과 정반대가 된다.
  if (!/\d/.test(compareToken)) {
    if (fuzzyIncludes(stationName, compareToken)) {
      return { token: rawToken, category: 'FUZZY_MATCH', field: 'stationName', matchIndex: 0 }
    }
    for (const alias of aliasHaystacks) {
      if (fuzzyIncludes(alias, compareToken)) {
        return { token: rawToken, category: 'FUZZY_MATCH', field: 'alias', matchIndex: 0 }
      }
    }
  }

  return null
}
