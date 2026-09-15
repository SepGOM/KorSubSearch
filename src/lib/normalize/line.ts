/**
 * 노선명 정규화 및 노선 번호 인식 순수 함수 모음.
 *
 * 기관마다 "01호선", "1호선", "서울 1호선", "수도권1호선"처럼 다르게 표기해도
 * 같은 line_number 로 인식할 수 있어야 한다. 서울 2호선과 인천 2호선처럼
 * 번호가 같아도 실제로는 다른 노선일 수 있으므로, 번호 인식은 어디까지나
 * "숫자 토큰 검색"을 위한 보조 정보이고 최종 동일성 판정은 line_id 로 한다.
 */

import { normalizeForCompare } from './text'

// 노선명 앞에 흔히 붙는 지역/체계 접두어. 번호 추출 전에 제거한다.
const REGION_PREFIXES = ['수도권', '서울', '인천', '경기']

/** 노선명을 비교용으로 정규화한다 (공백 제거, NFC, 가운데점 통일은 text.ts 재사용). */
export function normalizeLineName(name: string): string {
  return normalizeForCompare(name)
}

/**
 * 노선 표시명에서 지역 접두어를 제거한다.
 * 예: "수도권1호선" → "1호선", "서울 2호선" → "2호선"
 */
function stripRegionPrefix(normalized: string): string {
  for (const prefix of REGION_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      return normalized.slice(prefix.length)
    }
  }
  return normalized
}

/**
 * 노선명에서 숫자 노선 번호를 추출한다. "01호선", "1호선", "서울 1호선" 모두 1을 반환.
 * 숫자 노선이 아니면(경의선, 수인분당선 등) null.
 */
export function extractLineNumber(lineName: string): number | null {
  const normalized = normalizeLineName(lineName)
  const withoutPrefix = stripRegionPrefix(normalized)
  const match = withoutPrefix.match(/^0*(\d{1,2})호선$/)
  if (!match) return null
  return Number.parseInt(match[1], 10)
}

/**
 * 검색어 토큰이 "노선 번호 토큰" 형태인지 판별하고 번호를 반환한다.
 * 순수한 숫자("3")이거나 "3호선"/"03호선" 형태만 인정한다.
 * 실제로 그 번호의 노선이 현재 범위에 존재하는지는 검색 엔진에서 line 목록과
 * 대조해 판단한다 (이 함수는 어휘적 판별만 담당).
 */
export function parseLineNumberToken(token: string): number | null {
  const trimmed = token.trim()
  if (trimmed.length === 0) return null
  if (/^\d{1,2}$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10)
  }
  const withLineSuffix = trimmed.match(/^0*(\d{1,2})호선$/)
  if (withLineSuffix) {
    return Number.parseInt(withLineSuffix[1], 10)
  }
  return null
}
