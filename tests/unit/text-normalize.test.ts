import { describe, expect, it } from 'vitest'
import {
  normalizeForCompare,
  normalizeStationName,
  normalizeWhitespace,
  splitParenthetical,
  stripStationSuffix,
  toNfc,
} from '@/lib/normalize/text'

describe('stripStationSuffix ("역" 접미사 제거)', () => {
  it('마지막의 역을 제거한다', () => {
    expect(stripStationSuffix('무악재역')).toBe('무악재')
    expect(stripStationSuffix('오금역')).toBe('오금')
  })

  it('역으로 끝나지 않으면 그대로 둔다', () => {
    expect(stripStationSuffix('디지털미디어시티')).toBe('디지털미디어시티')
  })

  it('전체가 "역" 한 글자뿐이면 그대로 둔다', () => {
    expect(stripStationSuffix('역')).toBe('역')
  })
})

describe('splitParenthetical (괄호 안 부역명 분리)', () => {
  it('괄호 안 이름을 부역명으로 분리한다', () => {
    expect(splitParenthetical('총신대입구(이수)역')).toEqual({ main: '총신대입구역', sub: '이수' })
  })

  it('괄호가 없으면 그대로 둔다', () => {
    expect(splitParenthetical('디지털미디어시티역')).toEqual({ main: '디지털미디어시티역', sub: null })
  })
})

describe('normalizeWhitespace / normalizeForCompare', () => {
  it('연속 공백을 하나로 줄이고 앞뒤 공백을 없앤다', () => {
    expect(normalizeWhitespace('  서울   역  ')).toBe('서울 역')
  })

  it('비교용 문자열은 공백을 완전히 제거한다', () => {
    expect(normalizeForCompare('서울 역')).toBe('서울역')
  })

  it('NFC로 정규화한다 (분해형 입력도 완성형과 같게 비교된다)', () => {
    const decomposed = '스울' // ㅅ+ㅡ+ㅇ+ㅜ+ㄹ 분해형 "서울"과 유사 조합
    // 분해형/완성형 모두 NFC 이후 동일한 형태가 되어야 한다.
    expect(toNfc(decomposed)).toBe(decomposed.normalize('NFC'))
  })

  it('두 역명을 잇는 가운데점·마침표는 비교용 문자열에서 완전히 뺀다', () => {
    // "경성대·부경대"처럼 문장부호가 있든("경성대·부경대") 없든("경성대부경대")
    // 같은 비교 결과가 나와야 검색어에 문장부호를 안 넣어도 찾을 수 있다.
    expect(normalizeForCompare('경성대·부경대')).toBe('경성대부경대')
    expect(normalizeForCompare('경성대부경대')).toBe('경성대부경대')
    expect(normalizeForCompare('4.19민주묘지')).toBe('419민주묘지')
  })
})

describe('normalizeStationName (역명 정규화 파이프라인 전체)', () => {
  it('무악재역 → 정규화 역명 "무악재", 초성 "ㅁㅇㅈ"', () => {
    const result = normalizeStationName('무악재역')
    expect(result.normalizedName).toBe('무악재')
    expect(result.initials).toBe('ㅁㅇㅈ')
    expect(result.subName).toBeNull()
  })

  it('총신대입구(이수)역 → 정규화 역명 "총신대입구", 부역명 "이수"', () => {
    const result = normalizeStationName('총신대입구(이수)역')
    expect(result.normalizedName).toBe('총신대입구')
    expect(result.subName).toBe('이수')
  })

  it('디지털미디어시티역 → 초성 ㄷㅈㅌㅁㄷㅇㅅㅌ', () => {
    const result = normalizeStationName('디지털미디어시티역')
    expect(result.initials).toBe('ㄷㅈㅌㅁㄷㅇㅅㅌ')
  })
})
