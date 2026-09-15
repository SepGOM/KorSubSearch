import { describe, expect, it } from 'vitest'
import { matchTextToken, MATCH_CATEGORY_RANK } from '@/lib/search/score'
import { makeLine, makeStationLine } from '../fixtures/stationLines'

describe('matchTextToken (검색 점수 산정)', () => {
  const line3 = makeLine({ officialName: '수도권 전철 3호선', displayName: '3호선', lineNumber: 3 })
  const ogeum = makeStationLine('오금역', line3)

  it('역명 완전일치가 가장 높은 우선순위(랭크 1)를 받는다', () => {
    const match = matchTextToken('오금', ogeum)
    expect(match?.category).toBe('STATION_EXACT')
    expect(MATCH_CATEGORY_RANK[match!.category]).toBe(1)
  })

  it('"역" 접미사가 붙어도 완전일치로 처리한다', () => {
    const match = matchTextToken('오금역', ogeum)
    expect(match?.category).toBe('STATION_EXACT')
  })

  it('부분일치(악재 → 무악재)는 STATION_SUBSTRING', () => {
    const muakjae = makeStationLine('무악재역', line3)
    const match = matchTextToken('악재', muakjae)
    expect(match?.category).toBe('STATION_SUBSTRING')
  })

  it('초성 입력은 역명이 아니라 초성열을 기준으로 채점한다', () => {
    const muakjae = makeStationLine('무악재역', line3)
    const match = matchTextToken('ㅁㅇㅈ', muakjae)
    expect(match?.category).toBe('INITIALS_EXACT')
  })

  it('노선명에 포함된 별칭성 텍스트는 ALIAS_MATCH', () => {
    const gyeongjeoncheolLine = makeLine({ officialName: '용인 경전철', displayName: '용인경전철' })
    const stop = makeStationLine('기흥역', gyeongjeoncheolLine)
    const match = matchTextToken('경전철', stop)
    expect(match?.category).toBe('ALIAS_MATCH')
  })

  it('오타(경천철)는 FUZZY_MATCH로 잡힌다', () => {
    const gyeongjeoncheolLine = makeLine({ officialName: '용인 경전철', displayName: '용인경전철' })
    const stop = makeStationLine('기흥역', gyeongjeoncheolLine)
    const match = matchTextToken('경천철', stop)
    expect(match?.category).toBe('FUZZY_MATCH')
  })

  it('아무 것도 일치하지 않으면 null (AND 조건 탈락)', () => {
    expect(matchTextToken('부산', ogeum)).toBeNull()
  })

  describe('지선(parentLineId) 소속 레코드는 lineById로 넘겨준 본선 이름·별칭으로만 ALIAS_MATCH된다', () => {
    const mainLine = makeLine({ officialName: '수도권 전철 경춘선', displayName: '경춘선', sortOrder: 12 })
    const branchLine = makeLine({
      officialName: '경춘선 망우선',
      displayName: '망우선',
      sortOrder: 1200,
      parentLineId: mainLine.lineId,
    })
    const gwangwoondae = makeStationLine('광운대역', branchLine)
    const lineById = new Map([[mainLine.lineId, mainLine]])

    it('lineById를 넘기면 지선 자신의 이름("망우선")으로는 매칭되지 않는다', () => {
      expect(matchTextToken('망우선', gwangwoondae, lineById)).toBeNull()
    })

    it('lineById를 넘기면 본선 이름("경춘")으로는 매칭된다', () => {
      const match = matchTextToken('경춘', gwangwoondae, lineById)
      expect(match?.category).toBe('ALIAS_MATCH')
    })

    it('lineById를 넘기지 않으면(하위 호환) 지선 자신의 이름으로도 매칭된다', () => {
      const match = matchTextToken('망우선', gwangwoondae)
      expect(match?.category).toBe('ALIAS_MATCH')
    })
  })
})
