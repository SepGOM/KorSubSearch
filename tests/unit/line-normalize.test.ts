import { describe, expect, it } from 'vitest'
import { extractLineNumber, normalizeLineName, parseLineNumberToken } from '@/lib/normalize/line'

describe('extractLineNumber (노선 번호 인식)', () => {
  it('01호선, 1호선, 서울 1호선, 수도권1호선 모두 1을 반환한다', () => {
    expect(extractLineNumber('01호선')).toBe(1)
    expect(extractLineNumber('1호선')).toBe(1)
    expect(extractLineNumber('서울 1호선')).toBe(1)
    expect(extractLineNumber('수도권1호선')).toBe(1)
  })

  it('숫자 노선이 아니면 null', () => {
    expect(extractLineNumber('경의중앙선')).toBeNull()
    expect(extractLineNumber('수인분당선')).toBeNull()
  })
})

describe('parseLineNumberToken (검색어의 노선 번호 토큰 판별)', () => {
  it('순수 숫자와 "N호선" 형태를 인식한다', () => {
    expect(parseLineNumberToken('3')).toBe(3)
    expect(parseLineNumberToken('3호선')).toBe(3)
    expect(parseLineNumberToken('03호선')).toBe(3)
  })

  it('일반 텍스트는 노선 번호로 인식하지 않는다', () => {
    expect(parseLineNumberToken('오금')).toBeNull()
    expect(parseLineNumberToken('ㅇㄱ')).toBeNull()
  })
})

describe('normalizeLineName', () => {
  it('공백을 제거하고 NFC로 정규화한다', () => {
    expect(normalizeLineName('수도권 전철 1호선')).toBe('수도권전철1호선')
  })
})
