import { describe, expect, it } from 'vitest'
import { compareStationCode } from '@/lib/normalize/stationCode'

function sorted(codes: string[]): string[] {
  return [...codes].sort(compareStationCode)
}

describe('compareStationCode (역사고유번호 자연 정렬)', () => {
  it('순수 숫자 코드는 숫자 크기로 정렬된다', () => {
    expect(sorted(['203', '201', '202'])).toEqual(['201', '202', '203'])
  })

  it('두 자리와 세 자리가 섞여도 숫자값 기준으로 정렬된다 ("99" < "100")', () => {
    expect(sorted(['100', '99'])).toEqual(['99', '100'])
  })

  it('앞자리 0으로 채운 코드도 숫자값 기준으로 정렬된다', () => {
    expect(sorted(['0116', '0115', '0117'])).toEqual(['0115', '0116', '0117'])
  })

  it('알파벳 접두사 + 숫자 코드는 접두사가 같으면 숫자로 정렬된다', () => {
    expect(sorted(['S10', 'S07', 'S08'])).toEqual(['S07', 'S08', 'S10'])
  })

  it('지선을 나타내는 하이픈 표기는 본선 코드 바로 뒤, 다음 본선 코드보다 앞에 온다', () => {
    // 실제 1호선 원본 순서: 100(소요산) → 100-1(청산) → 100-2(전곡) → 100-3(연천) → 101(동두천)
    expect(sorted(['101', '100-2', '100', '100-3', '100-1'])).toEqual([
      '100',
      '100-1',
      '100-2',
      '100-3',
      '101',
    ])
  })

  it('완전히 같은 코드는 0을 반환한다', () => {
    expect(compareStationCode('751', '751')).toBe(0)
  })
})
