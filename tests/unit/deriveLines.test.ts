import { describe, expect, it } from 'vitest'
import { deriveLines, deriveSelectableLines, deriveChildLines } from '@/lib/data/deriveLines'
import { makeLine, makeStationLine } from '../fixtures/stationLines'

describe('deriveLines() 계열 — 지선(parentLineId)이 있는 노선의 취급', () => {
  const mainLine = makeLine({ officialName: '수도권 전철 경춘선', displayName: '경춘선', sortOrder: 12 })
  const branchLine = makeLine({
    officialName: '경춘선 망우선',
    displayName: '망우선',
    sortOrder: 1200,
    parentLineId: mainLine.lineId,
  })
  const unrelatedLine = makeLine({ officialName: '수도권 전철 1호선', displayName: '1호선', sortOrder: 1 })

  const records = [
    makeStationLine('청량리역', mainLine),
    makeStationLine('상봉역', mainLine, { stationId: 'STN-SANGBONG' }),
    makeStationLine('상봉역', branchLine, { stationId: 'STN-SANGBONG' }),
    makeStationLine('광운대역', branchLine, { stationId: 'STN-GWANGWOONDAE' }),
    makeStationLine('광운대역', unrelatedLine, { stationId: 'STN-GWANGWOONDAE' }),
  ]

  it('deriveLines()는 지선도 포함해 전부 반환한다', () => {
    const lines = deriveLines(records)
    expect(lines.map((l) => l.displayName).sort()).toEqual(['1호선', '경춘선', '망우선'])
  })

  it('deriveSelectableLines()는 parentLineId가 있는 지선을 뺀다', () => {
    const lines = deriveSelectableLines(records)
    expect(lines.map((l) => l.displayName).sort()).toEqual(['1호선', '경춘선'])
  })

  it('deriveChildLines()는 특정 노선의 지선만 정렬 순서대로 반환한다', () => {
    const children = deriveChildLines(records, mainLine.lineId)
    expect(children).toHaveLength(1)
    expect(children[0].displayName).toBe('망우선')
  })

  it('deriveChildLines()는 지선이 없는 노선에는 빈 배열을 반환한다', () => {
    expect(deriveChildLines(records, unrelatedLine.lineId)).toEqual([])
  })
})
