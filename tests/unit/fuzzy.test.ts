import { describe, expect, it } from 'vitest'
import { fuzzyIncludes, isTypoSimilar, levenshteinDistance } from '@/lib/normalize/fuzzy'

describe('levenshteinDistance', () => {
  it('동일 문자열은 거리 0', () => {
    expect(levenshteinDistance('경전철', '경전철')).toBe(0)
  })

  it('한 글자 치환은 거리 1', () => {
    expect(levenshteinDistance('경천철', '경전철')).toBe(1)
  })
})

describe('isTypoSimilar / fuzzyIncludes (오타 유사일치)', () => {
  it('경천철은 경전철의 오타로 유사 판정된다', () => {
    expect(isTypoSimilar('경천철', '경전철')).toBe(true)
  })

  it('전혀 다른 문자열은 유사하지 않다', () => {
    expect(isTypoSimilar('오금', '경전철')).toBe(false)
  })

  it('fuzzyIncludes는 노선명 안에 오타 부분문자열이 있어도 찾아낸다', () => {
    expect(fuzzyIncludes('용인경전철', '경천철')).toBe(true)
    expect(fuzzyIncludes('의정부경전철', '경천철')).toBe(true)
  })
})
