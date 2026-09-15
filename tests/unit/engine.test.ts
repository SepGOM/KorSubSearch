import { describe, expect, it } from 'vitest'
import { search } from '@/lib/search/engine'
import { makeLine, makeStationLine } from '../fixtures/stationLines'

const line2 = makeLine({ officialName: '서울 지하철 2호선', displayName: '2호선', lineNumber: 2, sortOrder: 2 })
const line3 = makeLine({ officialName: '수도권 전철 3호선', displayName: '3호선', lineNumber: 3, sortOrder: 3 })
const line4 = makeLine({ officialName: '수도권 전철 4호선', displayName: '4호선', lineNumber: 4, sortOrder: 4 })
const line5 = makeLine({ officialName: '수도권 전철 5호선', displayName: '5호선', lineNumber: 5, sortOrder: 5 })
const gyeonguiLine = makeLine({ officialName: '수도권 전철 경의·중앙선', displayName: '경의중앙선', sortOrder: 11 })
const airportLine = makeLine({ officialName: '인천국제공항철도', displayName: '공항철도', sortOrder: 16 })

const candidates = [
  makeStationLine('오금역', line3),
  makeStationLine('오금역', line5),
  makeStationLine('무악재역', line3),
  makeStationLine('안국역', line3),
  makeStationLine('을지로입구역', line2),
  makeStationLine('홍대입구역', line2),
  makeStationLine('홍대입구역', gyeonguiLine),
  makeStationLine('홍대입구역', airportLine),
  makeStationLine('숙대입구역', line4),
  makeStationLine('동대입구역', line3),
  makeStationLine('압구정역', line3),
  makeStationLine('월곡역', line4),
  makeStationLine('오류동역', line3), // 오금과 무관 — 오탐 방지 확인용
]

describe('search() 통합: 오금 검색', () => {
  it('오금은 3호선·5호선 두 행으로 반환된다', () => {
    const results = search(candidates, '오금')
    expect(results).toHaveLength(2)
    const lineNames = results.map((r) => r.record.line.displayName).sort()
    expect(lineNames).toEqual(['3호선', '5호선'])
    for (const r of results) {
      expect(r.record.officialStationName).toBe('오금역')
    }
  })

  it('"오금역"으로 검색해도 동일하게 두 행이 나온다', () => {
    const results = search(candidates, '오금역')
    expect(results).toHaveLength(2)
  })
})

describe('search() 통합: 초성 검색', () => {
  it('ㅇㄱ 는 초성열에 ㅇㄱ가 연속으로 들어간 역들을 반환한다', () => {
    // limit을 넉넉히 줘서 이 fixture의 모든 후보(11건)가 잘리지 않게 한다.
    // 기본 10개 제한 자체는 별도 테스트("기본 결과 개수는 10개로 제한된다")에서 검증한다.
    const results = search(candidates, 'ㅇㄱ', { limit: 20 })
    const names = new Set(results.map((r) => r.record.officialStationName))
    expect(names.has('안국역')).toBe(true)
    expect(names.has('을지로입구역')).toBe(true)
    expect(names.has('홍대입구역')).toBe(true)
    expect(names.has('동대입구역')).toBe(true)
    expect(names.has('압구정역')).toBe(true)
    expect(names.has('월곡역')).toBe(true)
    // 숙대입구역도 ㅅㄷㅇㄱ 안에 ㅇㄱ를 포함한다
    expect(names.has('숙대입구역')).toBe(true)
    // 오금(ㅇㄱ 완전일치)도 당연히 포함된다
    expect(names.has('오금역')).toBe(true)
  })
})

describe('search() 통합: 노선 번호 + 초성 복합 검색', () => {
  it('"3 ㅇㄱ" 는 3호선 결과만 반환한다', () => {
    const results = search(candidates, '3 ㅇㄱ')
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) {
      expect(r.record.line.lineNumber).toBe(3)
    }
    const names = new Set(results.map((r) => r.record.officialStationName))
    expect(names.has('안국역')).toBe(true) // 3호선 + ㅇㄱ
    expect(names.has('을지로입구역')).toBe(false) // 2호선이라 제외
  })

  it('"3 ㅁㅇㅈ" 는 무악재역 3호선만 반환한다', () => {
    const results = search(candidates, '3 ㅁㅇㅈ')
    expect(results).toHaveLength(1)
    expect(results[0].record.officialStationName).toBe('무악재역')
    expect(results[0].record.line.lineNumber).toBe(3)
  })
})

describe('search() 옵션', () => {
  it('lineId 로 특정 노선만 필터링할 수 있다', () => {
    const results = search(candidates, '홍대입구', { lineId: airportLine.lineId })
    expect(results).toHaveLength(1)
    expect(results[0].record.line.lineId).toBe(airportLine.lineId)
  })

  it('기본 결과 개수는 10개로 제한된다', () => {
    const many = Array.from({ length: 15 }, () => makeStationLine('테스트역', line2))
    const results = search(many, '테스트')
    expect(results).toHaveLength(10)
  })

  it('빈 검색어는 빈 배열을 반환한다', () => {
    expect(search(candidates, '')).toEqual([])
    expect(search(candidates, '   ')).toEqual([])
  })

  it('debug 옵션을 주면 scoreBreakdown 을 포함한다', () => {
    const results = search(candidates, '오금', { debug: true })
    expect(results[0].scoreBreakdown).toBeDefined()
    expect(results[0].scoreBreakdown?.bestCategoryRank).toBe(1)
    expect(results[0].matchedTokens).toEqual(['오금'])
  })

  it('debug 옵션이 없으면 scoreBreakdown 을 포함하지 않는다', () => {
    const results = search(candidates, '오금')
    expect(results[0].scoreBreakdown).toBeUndefined()
  })

  it('lineId로 본선을 고르면 그 지선(parentLineId) 소속 역도 함께 검색된다(사용자 확인: "지선에있는 역들은 검색이 안되네" 버그 수정 — 서울역처럼 본선 레코드가 아예 없고 지선 레코드만 있는 역도 본선 선택 상태에서 찾을 수 있어야 한다)', () => {
    const mainLine = makeLine({ officialName: '수도권 전철 경의·중앙선', displayName: '경의중앙선', sortOrder: 11 })
    const branchLine = makeLine({
      officialName: '경의중앙선 경의1선',
      displayName: '경의1선',
      sortOrder: 1201,
      parentLineId: mainLine.lineId,
    })
    // 서울역은 본선(경의중앙선) 레코드가 없고 지선(경의1선) 레코드만 갖는다(실제 데이터와 동일한 상황).
    const seoulStation = makeStationLine('서울역', branchLine)
    const results = search([seoulStation], '서울역', { lineId: mainLine.lineId })
    expect(results).toHaveLength(1)
    expect(results[0].record.line.lineId).toBe(branchLine.lineId)
  })
})

describe('search() 통합: 병합됐지만 실제 이름이 다른 역의 별칭 동점 처리', () => {
  // 1호선 "아산"과 KTX "천안아산"처럼 병합(환승 공유)됐지만 실제 이름이 다른
  // 역은 station_alias가 station_id 단위로 붙어 두 레코드가 같은 별칭 목록을
  // 공유한다 — "천안아산"으로 검색해도 "아산" 쪽 레코드가 같은 별칭으로 함께
  // 걸린다. 이때 실제로 자기 이름에 검색어가 들어있는 레코드가 앞서야 한다.
  const sharedStationId = 'STN-ASAN'
  const line1 = makeLine({ officialName: '수도권 전철 1호선', displayName: '1호선', sortOrder: 1 })
  const ktxGyeongbu = makeLine({ officialName: 'KTX 경부선', displayName: 'KTX-경부', sortOrder: 500 })
  const asan = makeStationLine('아산역', line1, {
    stationId: sharedStationId,
    displayStationName: '아산역',
    aliases: ['천안아산'], // 병합 그룹 공유 별칭(실제로는 자기 이름이 아니다)
  })
  const cheonanAsan = makeStationLine('아산역', ktxGyeongbu, {
    stationId: sharedStationId,
    displayStationName: '천안아산역', // 자기 원래 이름
    aliases: ['천안아산'],
  })

  it('"천안아산"으로 검색하면 자기 이름이 실제로 "천안아산"인 레코드가 앞선다', () => {
    const results = search([asan, cheonanAsan], '천안아산')
    expect(results[0].record.displayStationName).toBe('천안아산역')
  })

  it('"아산"으로 검색하면(역명 자체가 일치) 순서에 영향 없이 둘 다 나온다', () => {
    const results = search([asan, cheonanAsan], '아산')
    expect(results).toHaveLength(2)
  })
})

describe(
  '노선 번호 토큰의 지역 모호성(사용자 확인: "1만 입력해도 인천, 부산, 대구, 광주 다 뜨기 때문에"' +
    ' — 접두어 없는 숫자는 "순수 N호선"(수도권)만, 다른 지역은 전용 키워드로)',
  () => {
    // operatorCode: 'SM' — isCanonicalNumberedLine()이 "접두어 없는 진짜 수도권
    // 1~9호선"인지를 displayName이 아니라 이 값으로 판정한다(displayName은
    // 2호선처럼 "을지로순환선"으로 커스터마이즈될 수 있어서다).
    const seoulLine1 = makeLine({
      officialName: '수도권 전철 1호선',
      displayName: '1호선',
      lineNumber: 1,
      operatorCode: 'SM',
      sortOrder: 1,
    })
    const incheonLine1 = makeLine({
      officialName: '인천 도시철도 1호선',
      displayName: '인천 1호선',
      lineNumber: 1,
      aliases: ['인1'],
      sortOrder: 17,
    })
    const busanLine1 = makeLine({
      officialName: '부산 도시철도 1호선',
      displayName: '부산 1호선',
      lineNumber: 1,
      regionCode: 'BUSAN',
      aliases: ['부1'],
      sortOrder: 100,
    })

    it('같은 번호를 가진 노선이 후보군에 여러 지역 걸쳐 있으면, 접두어 없는 숫자는 "순수 N호선"만 통과시킨다', () => {
      const candidates = [makeStationLine('서울역', seoulLine1), makeStationLine('부평역', incheonLine1)]
      const results = search(candidates, '1', { limit: 50 })
      expect(results).toHaveLength(1)
      expect(results[0].record.line.displayName).toBe('1호선')
    })

    it('지역이 붙은 노선은 전용 키워드로는 그대로 찾을 수 있다(예: "인1")', () => {
      const candidates = [makeStationLine('서울역', seoulLine1), makeStationLine('부평역', incheonLine1)]
      const results = search(candidates, '인1', { limit: 50 })
      expect(results).toHaveLength(1)
      expect(results[0].record.line.displayName).toBe('인천 1호선')
    })

    it('범위를 그 지역 하나로 좁혀서 후보군에 그 번호를 가진 노선이 하나뿐이면, 접두어 없는 숫자만으로도 찾아진다(사용자 확인: "운행 범위를 부산으로 지정 시, 1만 적어도 부산 1호선이 검색되어야 한다")', () => {
      const busanOnlyCandidates = [makeStationLine('서면역', busanLine1)]
      const results = search(busanOnlyCandidates, '1', { limit: 50 })
      expect(results).toHaveLength(1)
      expect(results[0].record.line.displayName).toBe('부산 1호선')
    })
  },
)

describe('지선(parentLineId) 소속 역은 지선 자신의 이름이 아니라 본선명으로만 키워드 검색된다(사용자 확인: "필터링 되는 노선 명 키워드는 본선명 즉 parents 명만... 마천지선 또는 경의1선과 같은걸로는 필터링 되지 않게")', () => {
  const mainLine = makeLine({ officialName: '수도권 전철 경춘선', displayName: '경춘선', sortOrder: 12 })
  const branchLine = makeLine({
    officialName: '경춘선 망우선',
    displayName: '망우선',
    sortOrder: 1200,
    parentLineId: mainLine.lineId,
  })

  it('본선명("경춘")으로는 지선 소속 역도 검색된다', () => {
    const candidates = [makeStationLine('청량리역', mainLine), makeStationLine('광운대역', branchLine)]
    const results = search(candidates, '경춘', { limit: 50 })
    expect(results.some((r) => r.record.officialStationName === '광운대역')).toBe(true)
  })

  it('지선 자신의 이름("망우선")으로는 지선 소속 역이 검색되지 않는다', () => {
    const candidates = [makeStationLine('청량리역', mainLine), makeStationLine('광운대역', branchLine)]
    const results = search(candidates, '망우선', { limit: 50 })
    expect(results).toHaveLength(0)
  })
})
