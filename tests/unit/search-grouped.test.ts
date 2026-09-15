import { describe, expect, it } from 'vitest'
import { searchGrouped } from '@/lib/search/engine'
import { makeLine, makeStationLine } from '../fixtures/stationLines'

describe('searchGrouped() — 역 단위 그룹핑 (환승역 한 행 + 동명이역은 분리)', () => {
  const line1 = makeLine({ officialName: '서울 지하철 1호선', displayName: '1호선', lineNumber: 1, sortOrder: 1 })
  const line2 = makeLine({ officialName: '서울 지하철 2호선', displayName: '2호선', lineNumber: 2, sortOrder: 2 })
  const line3 = makeLine({ officialName: '수도권 전철 3호선', displayName: '3호선', lineNumber: 3, sortOrder: 3 })
  const line5 = makeLine({ officialName: '수도권 전철 5호선', displayName: '5호선', lineNumber: 5, sortOrder: 5 })

  it('같은 station_id를 가진 두 StationLine은 한 그룹(환승역)으로 합쳐진다', () => {
    // 오금역처럼 실제 환승역인 경우: 같은 stationId를 부여한다(가져오기 단계에서 병합됨을 흉내).
    const sharedStationId = 'STN-OGEUM'
    const ogeum3 = makeStationLine('오금역', line3, { stationId: sharedStationId })
    const ogeum5 = makeStationLine('오금역', line5, { stationId: sharedStationId })

    const groups = searchGrouped([ogeum3, ogeum5], '오금')
    expect(groups).toHaveLength(1)
    expect(groups[0].officialStationName).toBe('오금역')
    expect(groups[0].lines.map((l) => l.line.displayName)).toEqual(['3호선', '5호선'])
  })

  it('station_id가 다른 동명이역은 별도 그룹으로 남는다 (예: 신촌 2호선 vs 신촌 경의중앙선)', () => {
    const gyeonguiLine = makeLine({ officialName: '수도권 전철 경의·중앙선', displayName: '경의중앙선', sortOrder: 11 })
    // 서로 다른 stationId — 가져오기 단계에서 KEEP_SEPARATE로 분리된 상황을 흉내.
    const sinchon2 = makeStationLine('신촌역', line2, { stationId: 'STN-SINCHON-2' })
    const sinchonGyeongui = makeStationLine('신촌역', gyeonguiLine, { stationId: 'STN-SINCHON-GYEONGUI' })

    const groups = searchGrouped([sinchon2, sinchonGyeongui], '신촌')
    expect(groups).toHaveLength(2)
    expect(groups.every((g) => g.officialStationName === '신촌역')).toBe(true)
    expect(groups.every((g) => g.lines.length === 1)).toBe(true)
    const lineNames = groups.map((g) => g.lines[0].line.displayName).sort()
    expect(lineNames).toEqual(['2호선', '경의중앙선'])
  })

  it('그룹 안의 노선은 line.sortOrder 순서로 정렬된다', () => {
    const sharedStationId = 'STN-GUNJA'
    const gunja7 = makeStationLine('군자역', makeLine({ officialName: '서울 지하철 7호선', displayName: '7호선', sortOrder: 7 }), {
      stationId: sharedStationId,
    })
    const gunja5 = makeStationLine('군자역', makeLine({ officialName: '수도권 전철 5호선', displayName: '5호선', sortOrder: 5 }), {
      stationId: sharedStationId,
    })

    // 7호선을 먼저 넣어도 결과는 5호선이 앞에 온다(정렬 순서 기준).
    const groups = searchGrouped([gunja7, gunja5], '군자')
    expect(groups).toHaveLength(1)
    expect(groups[0].lines.map((l) => l.line.displayName)).toEqual(['5호선', '7호선'])
  })

  it('lineId로 필터링하면 그룹 안에서도 해당 노선만 남는다', () => {
    const sharedStationId = 'STN-OGEUM'
    const ogeum3 = makeStationLine('오금역', line3, { stationId: sharedStationId })
    const ogeum5 = makeStationLine('오금역', line5, { stationId: sharedStationId })

    const groups = searchGrouped([ogeum3, ogeum5], '오금', { lineId: line3.lineId })
    expect(groups).toHaveLength(1)
    expect(groups[0].lines).toHaveLength(1)
    expect(groups[0].lines[0].line.lineId).toBe(line3.lineId)
  })

  it('그룹 개수는 limit 로 제한된다 (StationLine 개수가 아니라 역 개수 기준)', () => {
    // 환승역 하나(2개 노선) + 일반역 여러 개를 만들어, limit=1일 때도 환승역의
    // 두 노선이 함께 잘리지 않고 한 그룹으로 온전히 나오는지 확인한다.
    const sharedStationId = 'STN-TEST'
    const testA = makeStationLine('테스트역', line1, { stationId: sharedStationId })
    const testB = makeStationLine('테스트역', line2, { stationId: sharedStationId })
    const others = Array.from({ length: 5 }, () => makeStationLine('테스트역2', line1))

    const groups = searchGrouped([testA, testB, ...others], '테스트', { limit: 1 })
    expect(groups).toHaveLength(1)
    expect(groups[0].stationId).toBe(sharedStationId)
    expect(groups[0].lines).toHaveLength(2)
  })

  it('빈 검색어는 빈 배열을 반환한다', () => {
    expect(searchGrouped([makeStationLine('오금역', line3)], '')).toEqual([])
  })

  describe('allStationLines 옵션 (범위 밖 환승 노선 배지)', () => {
    it('지정하지 않으면 기존처럼 candidates 안의 노선만 모은다', () => {
      const sharedStationId = 'STN-OGEUM'
      const ogeum3 = makeStationLine('오금역', line3, { stationId: sharedStationId })
      const groups = searchGrouped([ogeum3], '오금')
      expect(groups[0].lines).toHaveLength(1)
    })

    it('지정하면 candidates에 없어도 같은 station_id를 가진 다른 노선을 배지에 추가한다', () => {
      const sharedStationId = 'STN-OGEUM'
      const ogeum3 = makeStationLine('오금역', line3, { stationId: sharedStationId })
      const ogeum5 = makeStationLine('오금역', line5, { stationId: sharedStationId }) // candidates엔 없음
      const groups = searchGrouped([ogeum3], '오금', { allStationLines: [ogeum3, ogeum5] })
      expect(groups).toHaveLength(1)
      expect(groups[0].lines.map((l) => l.line.displayName)).toEqual(['3호선', '5호선'])
    })

    it('lineId로 검색 대상은 좁혀도, allStationLines를 지정하면 배지는 범위와 무관하게 전체를 보여준다', () => {
      const sharedStationId = 'STN-OGEUM'
      const ogeum3 = makeStationLine('오금역', line3, { stationId: sharedStationId })
      const ogeum5 = makeStationLine('오금역', line5, { stationId: sharedStationId })
      // lineId로 3호선만 매칭 대상으로 좁혀도(검색은 3호선 안에서만),
      const groups = searchGrouped([ogeum3, ogeum5], '오금', {
        lineId: line3.lineId,
        allStationLines: [ogeum3, ogeum5],
      })
      expect(groups).toHaveLength(1)
      // 배지에는 5호선도 함께 나온다.
      expect(groups[0].lines.map((l) => l.line.displayName)).toEqual(['3호선', '5호선'])
    })
  })

  describe('지선(parentLineId)은 배지에서 항상 본선 이름으로 치환된다(사용자 확인: "큰 노선만 하나만 표기")', () => {
    const mainLine = makeLine({ officialName: '수도권 전철 경춘선', displayName: '경춘선', sortOrder: 12 })
    const branchLine = makeLine({
      officialName: '경춘선 망우선',
      displayName: '망우선',
      sortOrder: 1200,
      parentLineId: mainLine.lineId,
    })

    it('지선 소속 레코드로 매칭돼도 그룹 배지는 지선이 아니라 본선 이름으로 나온다', () => {
      const gwangwoondae = makeStationLine('광운대역', branchLine, { stationId: 'STN-GWANGWOONDAE' })
      // lineById 조회용으로 경춘선 자체 레코드도 함께 넘긴다(실제 DB에서는 항상 있다).
      const cheongnyangni = makeStationLine('청량리역', mainLine)
      const groups = searchGrouped([gwangwoondae, cheongnyangni], '광운대')
      expect(groups).toHaveLength(1)
      expect(groups[0].lines.map((l) => l.line.displayName)).toEqual(['경춘선'])
    })

    it('본선·지선 레코드가 같은 역에 둘 다 있어도(분기역) 배지는 하나로 합쳐진다', () => {
      const sharedStationId = 'STN-SANGBONG'
      const sangbongMain = makeStationLine('상봉역', mainLine, { stationId: sharedStationId })
      const sangbongBranch = makeStationLine('상봉역', branchLine, { stationId: sharedStationId })
      const groups = searchGrouped([sangbongMain, sangbongBranch], '상봉')
      expect(groups).toHaveLength(1)
      expect(groups[0].lines.map((l) => l.line.displayName)).toEqual(['경춘선']) // 중복 없이 하나만
    })
  })
})
