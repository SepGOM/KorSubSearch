/**
 * 역명·일반 문자열 정규화 순수 함수 모음.
 * 공식 원문은 항상 보존하고, 이 모듈은 비교·검색용 파생 필드를 만드는 데만 쓴다.
 */

import { extractInitials } from './hangul'

/** 유니코드 NFC 정규화. */
export function toNfc(text: string): string {
  return text.normalize('NFC')
}

/** 앞뒤 공백 제거 + 연속 공백을 하나로 축소. 가운데점 계열 문장부호도 통일한다. */
export function normalizeWhitespace(text: string): string {
  return toNfc(text)
    .replace(/[ㆍ・∙•]/g, '·')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * 비교용 문자열 — 공백을 완전히 제거하고 영문은 소문자로 통일한다
 * (규칙 5, 4·8번 항목). 한글은 대소문자 개념이 없어 영향받지 않는다.
 *
 * "경성대·부경대", "전대.에버랜드"처럼 두 역명을 가운데점·마침표로 이어붙인
 * 표기는 그 문장부호까지 비교용 문자열에서 완전히 뺀다 — 검색어에 문장부호가
 * 있든 없든("경성대부경대") 같은 역으로 찾을 수 있어야 한다. 초성열은 애초에
 * 한글 음절만 뽑으므로 이 문장부호에 영향받지 않는다.
 */
export function normalizeForCompare(text: string): string {
  return normalizeWhitespace(text)
    .replace(/[·.]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

/** 영문 별칭 비교용 정규화. normalizeForCompare가 이미 소문자화까지 하므로 별칭. */
export const normalizeForeignAlias = normalizeForCompare

/**
 * 역명 마지막의 "역" 접미사를 제거한다.
 * "역"으로 끝나되 전체가 "역" 한 글자뿐인 경우는 그대로 둔다.
 */
export function stripStationSuffix(name: string): string {
  const trimmed = normalizeWhitespace(name)
  if (trimmed.length > 1 && trimmed.endsWith('역')) {
    return trimmed.slice(0, -1)
  }
  return trimmed
}

export interface SplitStationName {
  /** 괄호 밖 본 역명 */
  main: string
  /** 괄호 안 부역명. 없으면 null */
  sub: string | null
}

/**
 * 괄호 안 부역명을 분리한다.
 * 예: "총신대입구(이수)역" → { main: "총신대입구역", sub: "이수" }
 */
export function splitParenthetical(name: string): SplitStationName {
  const trimmed = normalizeWhitespace(name)
  const match = trimmed.match(/^(.*?)\s*[(（]([^)）]+)[)）]\s*(.*)$/)
  if (!match) {
    return { main: trimmed, sub: null }
  }
  const [, before, inside, after] = match
  const main = normalizeWhitespace(`${before}${after}`)
  return { main, sub: inside.trim() }
}

export interface NormalizedStationName {
  /** 공식 원문 그대로 (보존용) */
  officialName: string
  /** 비교·검색용 정규화 역명 ("역" 접미사·부역명 제거, 공백 제거) */
  normalizedName: string
  /** 괄호 안 부역명 (없으면 null) */
  subName: string | null
  /** 한글 초성열 */
  initials: string
}

/**
 * 역명 정규화 파이프라인 전체를 실행한다.
 * 순서: NFC → 공백 정리 → 괄호 안 부역명 분리 → "역" 접미사 제거 → 비교용 공백 제거 → 초성 생성
 */
export function normalizeStationName(officialName: string): NormalizedStationName {
  const whitespaceNormalized = normalizeWhitespace(officialName)
  const { main, sub } = splitParenthetical(whitespaceNormalized)
  const withoutSuffix = stripStationSuffix(main)
  const normalizedName = normalizeForCompare(withoutSuffix)
  return {
    officialName: whitespaceNormalized,
    normalizedName,
    subName: sub,
    initials: extractInitials(normalizedName),
  }
}
