/**
 * 오타 유사일치를 위한 최소 편집 거리(레벤슈타인) 기반 순수 함수.
 * 예: "경천철" ↔ "경전철" (편집 거리 1) 을 유사 일치로 인정한다.
 */

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0
  const aLen = a.length
  const bLen = b.length
  if (aLen === 0) return bLen
  if (bLen === 0) return aLen

  let previousRow = Array.from({ length: bLen + 1 }, (_, i) => i)
  let currentRow = new Array<number>(bLen + 1).fill(0)

  for (let i = 1; i <= aLen; i += 1) {
    currentRow[0] = i
    const aChar = a[i - 1]
    for (let j = 1; j <= bLen; j += 1) {
      const cost = aChar === b[j - 1] ? 0 : 1
      currentRow[j] = Math.min(
        previousRow[j] + 1, // 삭제
        currentRow[j - 1] + 1, // 삽입
        previousRow[j - 1] + cost, // 치환
      )
    }
    ;[previousRow, currentRow] = [currentRow, previousRow]
  }
  return previousRow[bLen]
}

/** 두 문자열 전체를 비교해 오타 수준으로 유사한지 판단한다. */
export function isTypoSimilar(a: string, b: string): boolean {
  if (a.length === 0 || b.length === 0) return false
  const maxLen = Math.max(a.length, b.length)
  if (maxLen <= 2) return a === b
  const distance = levenshteinDistance(a, b)
  const allowedDistance = maxLen <= 4 ? 1 : Math.floor(maxLen / 4) + 1
  return distance <= allowedDistance
}

/**
 * needle 이 haystack 의 어느 부분 문자열과 오타 수준으로 유사한지 확인한다.
 * "용인 경천철" 의 "경천철" 이 "용인경전철" 노선명 안의 "경전철" 부분과
 * 유사 일치하는 경우를 지원하기 위함이다.
 */
export function fuzzyIncludes(haystack: string, needle: string): boolean {
  if (needle.length === 0 || haystack.length === 0) return false
  if (haystack.includes(needle)) return true
  const windowSizes = new Set([needle.length - 1, needle.length, needle.length + 1].filter((n) => n > 0))
  for (const size of windowSizes) {
    if (size > haystack.length) continue
    for (let start = 0; start + size <= haystack.length; start += 1) {
      const window = haystack.slice(start, start + size)
      if (isTypoSimilar(window, needle)) return true
    }
  }
  return false
}
