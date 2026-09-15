/**
 * 자동완성 목록에서 일치 부분을 강조하기 위한 순수 함수.
 * 초성 검색처럼 원문에 정확히 대응되는 부분문자열이 없는 경우는 강조하지 않는다.
 */

export interface HighlightSegment {
  text: string
  matched: boolean
}

export function highlightMatch(officialName: string, rawTokens: string[]): HighlightSegment[] {
  const compareBase = officialName.replace(/역$/, '')
  let bestStart = -1
  let bestLength = 0

  for (const token of rawTokens) {
    const needle = token.replace(/역$/, '').trim()
    if (needle.length === 0) continue
    const idx = compareBase.indexOf(needle)
    if (idx >= 0 && needle.length > bestLength) {
      bestStart = idx
      bestLength = needle.length
    }
  }

  if (bestStart < 0) {
    return [{ text: officialName, matched: false }]
  }

  const segments: HighlightSegment[] = []
  if (bestStart > 0) segments.push({ text: officialName.slice(0, bestStart), matched: false })
  segments.push({ text: officialName.slice(bestStart, bestStart + bestLength), matched: true })
  if (bestStart + bestLength < officialName.length) {
    segments.push({ text: officialName.slice(bestStart + bestLength), matched: false })
  }
  return segments
}
