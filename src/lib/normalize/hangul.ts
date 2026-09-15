/**
 * 한글 초성 추출 및 초성 검색 판별 순수 함수 모음.
 *
 * 완성형 한글 음절(가~힣, U+AC00~U+D7A3)에서 초성만 뽑아내고,
 * 이미 초성 자모(ㄱ~ㅎ, 호환 자모 U+3131~U+314E)로 입력된 검색어를 판별한다.
 */

const HANGUL_SYLLABLE_BASE = 0xac00
const HANGUL_SYLLABLE_LAST = 0xd7a3
const JUNGSEONG_COUNT = 21
const JONGSEONG_COUNT = 28

// 완성형 한글 음절의 초성 19개 (유니코드 조합 순서)
const CHOSEONG_LIST = [
  'ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ',
  'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ',
] as const

// 호환 자모로 입력될 수 있는 초성 문자 집합 (검색어에 직접 등장)
const CHOSEONG_JAMO_SET: ReadonlySet<string> = new Set<string>(CHOSEONG_LIST)

/** 완성형 한글 음절 하나에서 초성을 추출한다. 음절이 아니면 null. */
export function getChoseongOfSyllable(char: string): string | null {
  const code = char.codePointAt(0)
  if (code === undefined) return null
  if (code < HANGUL_SYLLABLE_BASE || code > HANGUL_SYLLABLE_LAST) return null
  const offset = code - HANGUL_SYLLABLE_BASE
  const choseongIndex = Math.floor(offset / (JUNGSEONG_COUNT * JONGSEONG_COUNT))
  return CHOSEONG_LIST[choseongIndex]
}

/**
 * 문자열의 한글 초성열을 만든다.
 * - 완성형 한글 음절 → 초성으로 치환
 * - 이미 초성 자모인 문자 → 그대로 유지 (검색어가 초성으로 들어오는 경우 대비)
 * - 그 외 문자(공백, 숫자, 영문, 기호 등) → 초성열에서 제외
 *
 * 예: "을지로입구" → "ㅇㅈㄹㅇㄱ"
 */
export function extractInitials(text: string): string {
  const normalized = text.normalize('NFC')
  let result = ''
  for (const char of normalized) {
    const choseong = getChoseongOfSyllable(char)
    if (choseong) {
      result += choseong
    } else if (CHOSEONG_JAMO_SET.has(char)) {
      result += char
    }
  }
  return result
}

/**
 * 검색어가 "초성 입력"인지 판별한다.
 * 공백을 제거했을 때 문자가 하나 이상이고, 모든 문자가 초성 자모 집합에 속하면 true.
 */
export function isInitialsQuery(text: string): boolean {
  const stripped = text.replace(/\s+/g, '')
  if (stripped.length === 0) return false
  for (const char of stripped) {
    if (!CHOSEONG_JAMO_SET.has(char)) return false
  }
  return true
}

/**
 * haystack 초성열 안에 needle 초성열이 "연속 부분 문자열"로 포함되는지 확인한다.
 * 문자 순서만 같고 중간이 떨어진 비연속 부분수열은 일치로 보지 않는다.
 *
 * 예: haystack "ㅇㅈㄹㅇㄱ" (을지로입구), needle "ㅇㄱ" → true (인덱스 3~4 연속 일치)
 */
export function includesConsecutiveInitials(haystack: string, needle: string): boolean {
  if (needle.length === 0) return false
  return haystack.includes(needle)
}

export function initialsExactMatch(haystack: string, needle: string): boolean {
  return haystack.length > 0 && haystack === needle
}

export function initialsStartsWith(haystack: string, needle: string): boolean {
  return needle.length > 0 && haystack.startsWith(needle)
}
