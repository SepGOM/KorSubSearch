import { describe, expect, it } from 'vitest'
import { listStationsOnLine } from '@/lib/search/engine'
import { makeLine, makeStationLine } from '../fixtures/stationLines'

const line1 = makeLine({ officialName: '수도권 전철 1호선', displayName: '1호선', lineNumber: 1, sortOrder: 1 })
const line4 = makeLine({ officialName: '수도권 전철 4호선', displayName: '4호선', lineNumber: 4, sortOrder: 4 })

describe('listStationsOnLine()', () => {
  it('sequence 순서대로 정렬해서 반환한다', () => {
    // 부러 뒤죽박죽 순서로 만든다 — 결과는 sequence 기준으로 다시 정렬돼야 한다.
    const stationId = (n: number) => `STN-L1-${n}`
    const candidates = [
      makeStationLine('회룡역', line1, { stationId: stationId(3), sequence: 3 }),
      makeStationLine('소요산역', line1, { stationId: stationId(1), sequence: 1 }),
      makeStationLine('의정부역', line1, { stationId: stationId(2), sequence: 2 }),
    ]
    const result = listStationsOnLine(candidates, line1.lineId)
    expect(result.map((s) => s.officialStationName)).toEqual(['소요산역', '의정부역', '회룡역'])
    expect(result.map((s) => s.sequence)).toEqual([1, 2, 3])
  })

  it('sequence가 없는(null) 역은 맨 뒤로, 그 안에서는 가나다순으로 정렬된다', () => {
    const candidates = [
      makeStationLine('다역', line1, { sequence: null }),
      makeStationLine('가역', line1, { sequence: null }),
      makeStationLine('나역', line1, { sequence: 1 }),
    ]
    const result = listStationsOnLine(candidates, line1.lineId)
    expect(result.map((s) => s.officialStationName)).toEqual(['나역', '가역', '다역'])
  })

  it('다른 노선의 역은 제외한다', () => {
    const candidates = [
      makeStationLine('회룡역', line1, { sequence: 1 }),
      makeStationLine('숙대입구역', line4, { sequence: 1 }),
    ]
    const result = listStationsOnLine(candidates, line1.lineId)
    expect(result).toHaveLength(1)
    expect(result[0].officialStationName).toBe('회룡역')
  })

  it('환승역은 이 노선을 제외한 다른 노선을 transferLines로 갖는다', () => {
    const sharedStationId = 'STN-SHARED'
    const line7 = makeLine({ officialName: '수도권 전철 7호선', displayName: '7호선', lineNumber: 7, sortOrder: 7 })
    const candidates = [
      makeStationLine('총신대입구(이수)역', line4, { stationId: sharedStationId, sequence: 1 }),
      makeStationLine('총신대입구(이수)역', line7, { stationId: sharedStationId, sequence: 1 }),
      makeStationLine('숙대입구역', line4, { sequence: 2 }),
    ]
    const result = listStationsOnLine(candidates, line4.lineId)
    const merged = result.find((s) => s.stationId === sharedStationId)
    expect(merged).toBeDefined()
    expect(merged!.transferLines.map((l) => l.lineId)).toEqual([line7.lineId])

    const soleStation = result.find((s) => s.officialStationName === '숙대입구역')
    expect(soleStation!.transferLines).toHaveLength(0)
  })

  it('지선 자기 목록에서는 본선(parentLineId) 배지를 빼되, 그 외 환승은 그대로 보여준다', () => {
    const mainLine = makeLine({ officialName: '수도권 전철 경춘선', displayName: '경춘선', sortOrder: 12 })
    const branchLine = makeLine({
      officialName: '경춘선 망우선',
      displayName: '망우선',
      sortOrder: 1200,
      parentLineId: mainLine.lineId,
    })
    const line7 = makeLine({ officialName: '서울 지하철 7호선', displayName: '7호선', lineNumber: 7, sortOrder: 7 })
    const sangbongId = 'STN-SANGBONG'
    const candidates = [
      makeStationLine('상봉역', mainLine, { stationId: sangbongId, sequence: 4 }),
      makeStationLine('상봉역', branchLine, { stationId: sangbongId, sequence: 2 }),
      makeStationLine('상봉역', line7, { stationId: sangbongId, sequence: 1 }),
      makeStationLine('광운대역', branchLine, { sequence: 1 }),
    ]
    const result = listStationsOnLine(candidates, branchLine.lineId)
    const sangbong = result.find((s) => s.stationId === sangbongId)!
    const transferLineNames = sangbong.transferLines.map((l) => l.displayName)
    expect(transferLineNames).not.toContain('경춘선') // 본선 배지는 빠진다
    expect(transferLineNames).toContain('7호선') // 본선이 아닌 다른 환승은 그대로
  })

  it('본선 자기 목록에서도 지선 배지는 안 보이고, 대신 분기 표시용 branchLines에 잡힌다(사용자 확인: "환승 알을 표기할 필요 없어")', () => {
    const mainLine = makeLine({ officialName: '수도권 전철 경춘선', displayName: '경춘선', sortOrder: 12 })
    const branchLine = makeLine({
      officialName: '경춘선 망우선',
      displayName: '망우선',
      sortOrder: 1200,
      parentLineId: mainLine.lineId,
    })
    const sangbongId = 'STN-SANGBONG'
    const candidates = [
      makeStationLine('상봉역', mainLine, { stationId: sangbongId, sequence: 4 }),
      makeStationLine('상봉역', branchLine, { stationId: sangbongId, sequence: 2 }),
    ]
    const result = listStationsOnLine(candidates, mainLine.lineId)
    const sangbong = result.find((s) => s.stationId === sangbongId)!
    expect(sangbong.transferLines.map((l) => l.displayName)).not.toContain('망우선')
    expect(sangbong.branchLines.map((l) => l.displayName)).toEqual(['망우선'])
  })

  it('지선이 아닌 다른 노선에서 지선 소속 역을 보면, 지선이 아니라 그 본선의 정체성으로 배지가 붙는다(사용자 확인: "큰 노선만 하나만 표기")', () => {
    const mainLine = makeLine({ officialName: '수도권 전철 경춘선', displayName: '경춘선', iconLabel: '경춘', sortOrder: 12 })
    const branchLine = makeLine({
      officialName: '경춘선 망우선',
      displayName: '망우선',
      iconLabel: '경춘',
      sortOrder: 1200,
      parentLineId: mainLine.lineId,
    })
    const line1 = makeLine({ officialName: '수도권 전철 1호선', displayName: '1호선', sortOrder: 1 })
    const gwangwoondaeId = 'STN-GWANGWOONDAE'
    const candidates = [
      makeStationLine('광운대역', line1, { stationId: gwangwoondaeId, sequence: 1 }),
      makeStationLine('광운대역', branchLine, { stationId: gwangwoondaeId, sequence: 1 }),
      // 본선(경춘선) 정체성을 조회하려면 후보 배열 안에 그 노선의 레코드가
      // 하나라도 있어야 한다 — 실제 DB에서는 항상 그렇다(경춘선 자체 역이
      // 많으니까). 여기선 청량리역 하나로 흉내낸다.
      makeStationLine('청량리역', mainLine, { sequence: 1 }),
    ]
    const result = listStationsOnLine(candidates, line1.lineId)
    const gwangwoondae = result.find((s) => s.stationId === gwangwoondaeId)!
    expect(gwangwoondae.transferLines.map((l) => l.displayName)).toEqual(['경춘선']) // "망우선"이 아니다
  })

  it('비활성 station_line/역/노선은 제외한다', () => {
    const candidates = [
      makeStationLine('회룡역', line1, { sequence: 1, isActive: false }),
      makeStationLine('의정부역', line1, { sequence: 2, stationIsActive: false }),
      makeStationLine('도봉산역', line1, { sequence: 3 }),
    ]
    const result = listStationsOnLine(candidates, line1.lineId)
    expect(result.map((s) => s.officialStationName)).toEqual(['도봉산역'])
  })
})
