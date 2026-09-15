import { describe, expect, it } from 'vitest'
import { contrastRatio, isValidHexColor, normalizeHexColor, pickReadableTextColor } from '@/lib/color'

describe('HEX 색상 검증', () => {
  it('#RRGGBB 형식만 유효하다고 판단한다', () => {
    expect(isValidHexColor('#0052A4')).toBe(true)
    expect(isValidHexColor('0052A4')).toBe(false)
    expect(isValidHexColor('#052A4')).toBe(false)
    expect(isValidHexColor('#GGGGGG')).toBe(false)
  })

  it('대소문자·# 유무를 정규화해 대문자 #RRGGBB로 만든다', () => {
    expect(normalizeHexColor('0052a4')).toBe('#0052A4')
    expect(normalizeHexColor('#0052a4')).toBe('#0052A4')
    expect(normalizeHexColor('not-a-color')).toBeNull()
  })
})

describe('글자색 대비 계산 (WCAG)', () => {
  it('검정과 흰색의 명암비는 21:1이다', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 0)
  })

  it('밝은 배경에는 검정, 어두운 배경에는 흰색을 고른다', () => {
    expect(pickReadableTextColor('#FFFFFF')).toBe('#000000')
    expect(pickReadableTextColor('#000000')).toBe('#FFFFFF')
    expect(pickReadableTextColor('#003DA5')).toBe('#FFFFFF') // 어두운 파랑
    expect(pickReadableTextColor('#FDA600')).toBe('#000000') // 밝은 주황
  })
})
