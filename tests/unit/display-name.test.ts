import { describe, expect, it } from 'vitest'
import { formatStationDisplayName } from '@/lib/displayName'

describe('formatStationDisplayName (화면 표시용 역명)', () => {
  it('일반 역명은 "역" 접미사를 뗀다', () => {
    expect(formatStationDisplayName('방학역')).toBe('방학')
    expect(formatStationDisplayName('오금역')).toBe('오금')
  })

  it('서울역·부산역·대구역·동대구역·대전역·서대구역은 예외로 접미사를 유지한다', () => {
    expect(formatStationDisplayName('서울역')).toBe('서울역')
    expect(formatStationDisplayName('부산역')).toBe('부산역')
    expect(formatStationDisplayName('대구역')).toBe('대구역')
    expect(formatStationDisplayName('동대구역')).toBe('동대구역')
    expect(formatStationDisplayName('대전역')).toBe('대전역')
    expect(formatStationDisplayName('서대구역')).toBe('서대구역')
  })

  it('그 외에는 "역"이 붙어 있어도 뗀다 (예: 광주송정역)', () => {
    expect(formatStationDisplayName('광주송정역')).toBe('광주송정')
  })

  it('괄호 안 부역명은 화면 표시에서도 뗀다 (예: 봉황(김해여객터미널)역 → 봉황)', () => {
    expect(formatStationDisplayName('봉황(김해여객터미널)역')).toBe('봉황')
    expect(formatStationDisplayName('경성대.부경대(동명대학교)역')).toBe('경성대.부경대')
    expect(formatStationDisplayName('성신여대입구(돈암)역')).toBe('성신여대입구')
  })

  it('쌍용(나사렛대)·총신대입구(이수)는 예외로 부역명까지 유지한다', () => {
    expect(formatStationDisplayName('쌍용(나사렛대)역')).toBe('쌍용(나사렛대)')
    expect(formatStationDisplayName('총신대입구(이수)역')).toBe('총신대입구(이수)')
  })

  it('7호선 원본 표기인 "이수(총신대입구)"도 예외로 부역명까지 유지한다(2026-09-14)', () => {
    expect(formatStationDisplayName('이수(총신대입구)역')).toBe('이수(총신대입구)')
  })

  it('김천(구미)·울산(통도사)는 예외로 부역명까지 유지한다 (사용자 확인)', () => {
    expect(formatStationDisplayName('김천(구미)역')).toBe('김천(구미)')
    expect(formatStationDisplayName('울산(통도사)역')).toBe('울산(통도사)')
  })
})
