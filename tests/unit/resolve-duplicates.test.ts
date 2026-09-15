import { describe, expect, it } from 'vitest'
import { decideMerge } from '@/lib/merge/resolveDuplicates'

describe('decideMerge (역 자동 병합 및 수동 분리 규칙 7.2/7.3)', () => {
  it('정규화 역명이 다르면 병합하지 않는다', () => {
    const decision = decideMerge(
      { normalizedName: '오금', regionCode: 'SEOUL_METRO' },
      { normalizedName: '오류동', regionCode: 'SEOUL_METRO' },
    )
    expect(decision.shouldAutoMerge).toBe(false)
  })

  it('좌표가 500m 이내면 자동 병합한다', () => {
    const decision = decideMerge(
      { normalizedName: '서울', regionCode: 'SEOUL_METRO', latitude: 37.5547, longitude: 126.9707 },
      { normalizedName: '서울', regionCode: 'SEOUL_METRO', latitude: 37.5555, longitude: 126.9707 },
    )
    expect(decision.shouldAutoMerge).toBe(true)
    expect(decision.basis).toBe('COORDINATE')
  })

  it('좌표가 500m를 넘으면 자동 병합하지 않는다 (수동 분리 대상)', () => {
    const decision = decideMerge(
      { normalizedName: '서울', regionCode: 'SEOUL_METRO', latitude: 37.5547, longitude: 126.9707 },
      { normalizedName: '서울', regionCode: 'SEOUL_METRO', latitude: 37.6, longitude: 127.05 },
    )
    expect(decision.shouldAutoMerge).toBe(false)
  })

  it('공식 환승 관계가 확인되면 좌표 없이도 자동 병합한다', () => {
    const decision = decideMerge(
      { normalizedName: '오금', regionCode: 'SEOUL_METRO', officialTransferConfirmed: true },
      { normalizedName: '오금', regionCode: 'SEOUL_METRO', officialTransferConfirmed: true },
    )
    expect(decision.shouldAutoMerge).toBe(true)
    expect(decision.basis).toBe('OFFICIAL_TRANSFER')
  })

  it('좌표도 없고 공식 환승도 불명이면 자동 병합하지 않는다 (수동 검수)', () => {
    const decision = decideMerge(
      { normalizedName: '서울', regionCode: 'SEOUL_METRO' },
      { normalizedName: '서울', regionCode: 'SEOUL_METRO' },
    )
    expect(decision.shouldAutoMerge).toBe(false)
    expect(decision.basis).toBeNull()
  })

  it('반대 증거가 있으면 다른 조건과 무관하게 병합하지 않는다', () => {
    const decision = decideMerge(
      {
        normalizedName: '서울',
        regionCode: 'SEOUL_METRO',
        latitude: 37.5547,
        longitude: 126.9707,
        hasConflictingEvidence: true,
      },
      { normalizedName: '서울', regionCode: 'SEOUL_METRO', latitude: 37.5548, longitude: 126.9708 },
    )
    expect(decision.shouldAutoMerge).toBe(false)
  })

  it('같은 지역이 아니면(인접 판정 함수가 false) 병합하지 않는다', () => {
    const decision = decideMerge(
      { normalizedName: '서울', regionCode: 'SEOUL_METRO', latitude: 37.5547, longitude: 126.9707 },
      { normalizedName: '서울', regionCode: 'BUSAN', latitude: 37.5548, longitude: 126.9708 },
      () => false,
    )
    expect(decision.shouldAutoMerge).toBe(false)
  })
})
