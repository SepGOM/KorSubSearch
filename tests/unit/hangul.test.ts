import { describe, expect, it } from 'vitest'
import {
  extractInitials,
  includesConsecutiveInitials,
  initialsExactMatch,
  initialsStartsWith,
  isInitialsQuery,
} from '@/lib/normalize/hangul'

describe('extractInitials (한글 초성 추출)', () => {
  it('음절마다 초성을 뽑아낸다', () => {
    expect(extractInitials('을지로입구')).toBe('ㅇㅈㄹㅇㄱ')
    expect(extractInitials('무악재')).toBe('ㅁㅇㅈ')
    expect(extractInitials('오금')).toBe('ㅇㄱ')
  })

  it('숫자·공백·영문은 초성열에서 제외한다', () => {
    expect(extractInitials('9호선')).toBe('ㅎㅅ')
    expect(extractInitials('GTX-A')).toBe('')
  })

  it('이미 초성 자모인 문자는 그대로 유지한다', () => {
    expect(extractInitials('ㅇㄱ')).toBe('ㅇㄱ')
  })
})

describe('isInitialsQuery (초성 입력 판별)', () => {
  it('초성 자모로만 구성된 문자열을 초성 입력으로 판별한다', () => {
    expect(isInitialsQuery('ㅇㄱ')).toBe(true)
    expect(isInitialsQuery('ㅁㅇㅈ')).toBe(true)
  })

  it('일반 한글·숫자·빈 문자열은 초성 입력이 아니다', () => {
    expect(isInitialsQuery('오금')).toBe(false)
    expect(isInitialsQuery('3')).toBe(false)
    expect(isInitialsQuery('')).toBe(false)
    expect(isInitialsQuery('   ')).toBe(false)
  })
})

describe('초성열 연속 부분일치', () => {
  it('을지로입구(ㅇㅈㄹㅇㄱ) 안에서 ㅇㄱ 이 연속으로 일치한다', () => {
    const haystack = extractInitials('을지로입구')
    expect(includesConsecutiveInitials(haystack, 'ㅇㄱ')).toBe(true)
  })

  it('비연속 부분수열은 일치로 보지 않는다', () => {
    // "을지로입구"의 초성열은 ㅇㅈㄹㅇㄱ. "ㅈㄱ"는 문자만 순서대로 있지만
    // 중간에 ㄹㅇ가 끼어 있어 연속이 아니므로 불일치해야 한다.
    const haystack = extractInitials('을지로입구')
    expect(includesConsecutiveInitials(haystack, 'ㅈㄱ')).toBe(false)
  })

  it('완전일치와 시작일치를 구분한다', () => {
    const haystack = extractInitials('무악재') // ㅁㅇㅈ
    expect(initialsExactMatch(haystack, 'ㅁㅇㅈ')).toBe(true)
    expect(initialsExactMatch(haystack, 'ㅁㅇ')).toBe(false)
    expect(initialsStartsWith(haystack, 'ㅁㅇ')).toBe(true)
    expect(initialsStartsWith(haystack, 'ㅇㅈ')).toBe(false)
  })

  it('안국·을지로입구·숙대입구·홍대입구·동대입구·압구정·월곡 모두 ㅇㄱ 을 연속으로 포함한다', () => {
    const names = ['안국', '을지로입구', '숙대입구', '홍대입구', '동대입구', '압구정', '월곡']
    for (const name of names) {
      expect(includesConsecutiveInitials(extractInitials(name), 'ㅇㄱ')).toBe(true)
    }
  })
})
