// @vitest-environment node
/**
 * 통합 테스트 — data/generated/korsub.sqlite3 (실제 서울·수도권 + 부산 데이터)를 그대로
 * 읽어 검색 엔진 전체 경로(가져오기 → DB → 매핑 → 검색)를 검증한다.
 *
 * 이 DB는 `pnpm db:import` 로 생성되며 저장소에 커밋되어 있다.
 * 원본이 바뀌면 다시 생성한 뒤 이 테스트를 재실행해야 한다.
 */

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'
import { openDatabase, loadAllStationLines, loadScopeOptions } from '../../scripts/db/nodeRepository'
import { search, searchGrouped, listStationsOnLine } from '@/lib/search/engine'
import { deriveSelectableLines, deriveChildLines, deriveDescendantLines } from '@/lib/data/deriveLines'
import type { StationLineRecord } from '@/lib/search/types'
import type { DatabaseSync } from 'node:sqlite'

const DB_PATH = resolve(__dirname, '../../data/generated/korsub.sqlite3')

let db: DatabaseSync
let records: StationLineRecord[]
// 서울/부산 station_line 은 line_number 가 겹칠 수 있으므로(예: 서울 3호선 vs 부산 3호선),
// 서울 전용 테스트는 반드시 이 배열로 미리 좁혀서 지역이 우연히 섞이지 않게 한다.
let seoulRecords: StationLineRecord[]
let busanRecords: StationLineRecord[]
let daeguRecords: StationLineRecord[]
let gwangjuRecords: StationLineRecord[]
let daejeonRecords: StationLineRecord[]
let ktxRecords: StationLineRecord[]
let srtRecords: StationLineRecord[]
let mugunghwaRecords: StationLineRecord[]

beforeAll(() => {
  if (!existsSync(DB_PATH)) {
    throw new Error(
      `${DB_PATH} 가 없습니다. 먼저 "pnpm db:import" 를 실행해 데이터베이스를 생성하세요.`,
    )
  }
  db = openDatabase(DB_PATH)
  records = loadAllStationLines(db)
  // line.regionCode(노선 자체의 범위)로 좁힌다 — station.regionCode(역의 대표
  // 지역)가 아니다. KTX처럼 도시 지역 역과 환승되는 노선은 station 자체는 그
  // 도시 지역 대표를 갖지만, 그 노선(station_line) 행은 자기 범위(KTX)를 그대로
  // 유지하므로 line.regionCode로 걸러야 실제 그 범위에 속한 노선만 남는다.
  // ITX-청춘은 경춘선과 같은 서울·수도권 region을 쓰지만(자동 병합용) 서울·수도권 범위에는
  // 뜨지 않는다 — App.tsx와 같이 열차 종류(trainServiceCode)가 있는 노선은 뺀다.
  seoulRecords = records.filter((r) => r.line.regionCode === 'SEOUL_METRO' && !r.line.trainServiceCode)
  busanRecords = records.filter((r) => r.line.regionCode === 'BUSAN')
  daeguRecords = records.filter((r) => r.line.regionCode === 'DAEGU')
  gwangjuRecords = records.filter((r) => r.line.regionCode === 'GWANGJU')
  daejeonRecords = records.filter((r) => r.line.regionCode === 'DAEJEON')
  // KTX/SRT는 같은 region("KTX")을 공유한다(물리적으로 같은 역을 쓰는 경우가
  // 많아 자동 병합되게 하려고 일부러 그렇다) — ktxRecords는 KTX 범위 전체(옛
  // SRT 포함, 2026-09-16 2차 확인: "SRT 명도 KTX로 통합"으로 line.trainServiceCode
  // 도 전부 "KTX"로 합쳐졌다). srtRecords는 옛 "수서착발" 쪽만 다시 좁힐 때 쓴다
  // — operatorCode는 여전히 "SRT"로 남겨 뒀다(색상·override 매핑 유지용).
  ktxRecords = records.filter((r) => r.line.trainServiceCode === 'KTX')
  srtRecords = records.filter((r) => r.line.operatorCode === 'SRT')
  mugunghwaRecords = records.filter((r) => r.line.trainServiceCode === 'MUGUNGHWA')
})

describe('실제 데이터: 오금역 (서울)', () => {
  it('오금은 3호선·마천지선(5호선의 지선) 두 행으로 반환된다', () => {
    // 2026-09-14: 오금은 5호선 본선이 아니라 지선(마천지선) 소속 코드(P552)로
    // 재분류됐다 — line.lineNumber는 지선이라 null이고, 대신 displayName으로
    // 확인한다(iconLabel="5"라 배지는 여전히 "5"로 보인다).
    const results = search(seoulRecords, '오금')
    expect(results).toHaveLength(2)
    const lineDisplayNames = results.map((r) => r.record.line.displayName).sort()
    expect(lineDisplayNames).toEqual(['3호선', '마천지선'])
  })
})

describe('실제 데이터: 초성 검색 (서울)', () => {
  it('ㅇㄱ 는 여러 역을 반환하고 모두 초성열에 ㅇㄱ를 연속으로 포함한다', () => {
    const results = search(seoulRecords, 'ㅇㄱ', { limit: 50 })
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) {
      expect(r.record.stationInitials.includes('ㅇㄱ')).toBe(true)
    }
    const names = new Set(results.map((r) => r.record.officialStationName))
    expect(names.has('안국역')).toBe(true)
  })

  it('"3 ㅇㄱ" 는 3호선 결과만 반환한다', () => {
    const results = search(seoulRecords, '3 ㅇㄱ', { limit: 50 })
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) {
      expect(r.record.line.lineNumber).toBe(3)
    }
  })

  it('"3 ㅁㅇㅈ" 는 무악재역 3호선을 반환한다', () => {
    const results = search(seoulRecords, '3 ㅁㅇㅈ')
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].record.officialStationName).toBe('무악재역')
    expect(results[0].record.line.lineNumber).toBe(3)
  })
})

describe('실제 데이터: 일반 부분일치 (서울)', () => {
  it('악재 → 무악재역', () => {
    const results = search(seoulRecords, '악재')
    expect(results.some((r) => r.record.officialStationName === '무악재역')).toBe(true)
  })

  it('무악재 → 무악재역 3호선', () => {
    const results = search(seoulRecords, '무악재')
    expect(results[0].record.officialStationName).toBe('무악재역')
    expect(results[0].record.line.lineNumber).toBe(3)
  })

  it('4.19민주묘지역은 공식 표기(마침표)로 복원되고, 마침표 없이도 검색된다', () => {
    const official = search(seoulRecords, '4.19민주묘지')
    const withoutDot = search(seoulRecords, '419민주묘지')
    expect(official).toHaveLength(1)
    expect(official[0].record.officialStationName).toBe('4.19민주묘지역')
    expect(withoutDot).toHaveLength(1)
    expect(withoutDot[0].record.officialStationName).toBe('4.19민주묘지역')
  })
})

describe('실제 데이터: 노선명/별칭 검색 — 경전철 (서울)', () => {
  it('경전철 → 이름 또는 별칭에 경전철이 포함된 노선 소속 역들', () => {
    const results = search(seoulRecords, '경전철', { limit: 50 })
    expect(results.length).toBeGreaterThan(0)
    const lineNames = new Set(results.map((r) => r.record.line.officialName))
    for (const name of lineNames) {
      expect(name.includes('경전철') || name.includes('경량전철')).toBe(true)
    }
  })

  it('경천철(오타)은 결과가 없다 — 오타 유사일치는 제거됐다(2026-09-19 사용자 요청)', () => {
    expect(search(seoulRecords, '경천철', { limit: 50 })).toHaveLength(0)
  })

  it('용인 경전철 → 용인경전철(에버라인) 노선 결과', () => {
    const results = search(seoulRecords, '용인 경전철', { limit: 50 })
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) {
      expect(r.record.line.displayName).toBe('용인경전철')
    }
  })

  it('용인 에버라인 "용인중앙시장"역을 찾을 수 있다(2026-09-14: 원본 자체가 "운동장.송담대"에서 갱신됨)', () => {
    // 처음엔 원본(STIN_NM)이 "운동장.송담대"로 남아 있어 display-name override로
    // 이름만 바꿔 보여줬지만(2026-09-07), 이후 사용자가 원본 엑셀 자체를 새 이름으로
    // 고쳐서(2026-09-14) override가 필요 없어졌다 — 원본을 직접 고친 경우라
    // "운동장.송담대"라는 옛 표기는 데이터 어디에도 더 안 남는다(엑셀 편집이라
    // 과거 값이 남는 이름 변경 override와 다르다).
    // 검증 대상은 완전일치 여부다.
    const renamed = search(seoulRecords, '용인중앙시장', { limit: 10 })
    expect(renamed[0].record.officialStationName).toBe('용인중앙시장역')
    expect(renamed[0].record.line.displayName).toBe('용인경전철')
  })
})

describe('실제 데이터: 동명이역 분리 (서울)', () => {
  it('홍대입구는 2호선·경의중앙선·공항철도 각각 별도 행으로 나온다', () => {
    const results = search(seoulRecords, '홍대입구', { limit: 50 })
    const lineIds = new Set(results.map((r) => r.record.line.lineId))
    expect(lineIds.size).toBeGreaterThanOrEqual(3)
  })
})

describe('실제 데이터: 총신대입구(이수) — 사람이 확인한 환승역 병합', () => {
  it('4호선 총신대입구역과 7호선 이수역이 하나의 station으로 합쳐진다', () => {
    // limit을 넉넉히 줘서 대상 역 두 행이 잘리지 않게 한다 — 검증 대상은 정확히 그 역이다.
    const results = search(seoulRecords, '총신대입구', { limit: 50 })
    const merged = results.filter((r) => r.record.officialStationName === '총신대입구(이수)역')
    expect(merged).toHaveLength(2)
    const stationIds = new Set(merged.map((r) => r.record.stationId))
    expect(stationIds.size).toBe(1)
    // 완전일치이므로 최상위 결과여야 한다.
    expect(results[0].record.officialStationName).toBe('총신대입구(이수)역')
    const lineNumbers = merged.map((r) => r.record.line.lineNumber).sort()
    expect(lineNumbers).toEqual([4, 7])
  })

  it('부역명 "이수"만으로도 검색된다(화면에 부역명을 남기기로 한 역은 그 부역명으로도 검색 가능, 사용자 확인)', () => {
    const results = search(seoulRecords, '이수', { limit: 50 })
    const merged = results.filter((r) => r.record.officialStationName === '총신대입구(이수)역')
    expect(merged.length).toBeGreaterThan(0)
    const stationIds = new Set(merged.map((r) => r.record.stationId))
    expect(stationIds.size).toBe(1)
  })

  it('searchGrouped()로는 한 행에 4호선·7호선 배지가 함께 나온다', () => {
    const groups = searchGrouped(seoulRecords, '총신대입구', { limit: 50 })
    const merged = groups.find((g) => g.officialStationName === '총신대입구(이수)역')
    expect(merged).toBeDefined()
    expect(merged!.lines.map((l) => l.line.lineNumber).sort()).toEqual([4, 7])
  })

  it('병합 대표 이름은 "총신대입구(이수)"로 고정되지만, 4호선·7호선 각자의 목록에서는 노선별 표기가 따로 나온다(2026-09-14, 아산·천안아산과 같은 원칙)', () => {
    // 7호선 원본 자체가 "이수(총신대입구)"로 순서가 반대다 — 병합 대표(검색·그룹
    // 제목용 officialStationName)는 "총신대입구(이수)"로 그대로 두되(사용자 확인:
    // "총신대입구(이수) 역이 메인으로 지정 및 검색되도록"), 노선별 화면
    // (displayStationName)은 그 노선이 실제로 쓰는 표기를 보여준다("노선별
    // 취급하는 역명으로 표기").
    const line4Id = seoulRecords.find((r) => r.line.lineNumber === 4 && r.officialStationName === '총신대입구(이수)역')!.line.lineId
    const line4Stations = listStationsOnLine(seoulRecords, line4Id)
    const choongsin = line4Stations.find((s) => s.officialStationName === '총신대입구(이수)역')!
    expect(choongsin.displayStationName).toBe('총신대입구(이수)역')

    const line7Id = seoulRecords.find((r) => r.line.lineNumber === 7 && r.officialStationName === '총신대입구(이수)역')!.line.lineId
    const line7Stations = listStationsOnLine(seoulRecords, line7Id)
    const isu = line7Stations.find((s) => s.officialStationName === '총신대입구(이수)역')!
    expect(isu.displayStationName).toBe('이수(총신대입구)역')
    expect(isu.stationId).toBe(choongsin.stationId) // 같은 역(환승)이다.
  })
})

describe('실제 데이터: listStationsOnLine() 노선 내 역 순서', () => {
  // line.lineNumber만으로는 "2호선"과 "인천 2호선"처럼 서울 범위 안에서도 번호가
  // 겹칠 수 있어(둘 다 SEOUL_METRO region), line_code로 정확히 짚는다.
  function lineIdOf(records: StationLineRecord[], lineCode: string): string {
    const record = records.find((r) => r.line.lineCode === lineCode)
    if (!record) throw new Error(`${lineCode} 레코드를 찾지 못했다`)
    return record.line.lineId
  }

  it('을지로순환선(2호선 본선)은 43개 역이 시청→을지로입구→을지로3가→...→충정로 순서대로 나오고, 성수지선·신정지선은 빠진다', () => {
    const stations = listStationsOnLine(seoulRecords, lineIdOf(seoulRecords, 'SM-2'))
    expect(stations).toHaveLength(43)
    const names = stations.map((s) => s.officialStationName)
    const cityHallIndex = names.indexOf('시청역')
    expect(cityHallIndex).toBeGreaterThanOrEqual(0)
    expect(names.slice(cityHallIndex, cityHallIndex + 3)).toEqual(['시청역', '을지로입구역', '을지로3가역'])
    expect(stations[stations.length - 1].officialStationName).toBe('충정로(경기대입구)역')
    for (const branchOnlyStation of ['용답역', '신답역', '신설동역', '도림천역', '양천구청역', '신정네거리역', '까치산역']) {
      expect(names).not.toContain(branchOnlyStation)
    }
  })

  it('1호선: 서울교통공사 도심 구간(150~159)이 원본 STIN_CD 충돌 없이 회기~남영 사이 실제 순서로 끼워진다', () => {
    // 1호선은 한국철도공사(100~159)와 서울교통공사(150~159)가 같은 코드값을
    // 완전히 다른 두 구간에 매겨 놓아, 정렬 전용 override(station-line-sequence.csv)
    // 없이는 순서가 뒤섞인다 — 그 보정이 실제로 반영됐는지 확인한다.
    const stations = listStationsOnLine(seoulRecords, lineIdOf(seoulRecords, 'SM-1'))
    const names = stations.map((s) => s.officialStationName)
    const gihiIndex = names.indexOf('회기역')
    expect(gihiIndex).toBeGreaterThanOrEqual(0)
    expect(names.slice(gihiIndex, gihiIndex + 12)).toEqual([
      '회기역',
      '청량리역',
      '제기동역',
      '신설동역',
      '동묘앞역',
      '동대문역',
      '종로5가역',
      '종로3가역',
      '종각역',
      '시청역',
      '서울역',
      '남영역',
    ])
  })

  it('3호선: 일산선(대화~삼송)이 서울교통공사 구간(지축~안국) 바로 앞에 온다', () => {
    // 3호선도 한국철도공사(일산선)와 서울교통공사가 같은 코드값(309~318)을 각각
    // 다른 구간에 매겨 놓은 사례다.
    const stations = listStationsOnLine(seoulRecords, lineIdOf(seoulRecords, 'SM-3'))
    const names = stations.map((s) => s.officialStationName)
    expect(names.slice(0, 21)).toEqual([
      '대화역',
      '주엽역',
      '정발산역',
      '마두역',
      '백석역',
      '대곡역',
      '화정역',
      '원당역',
      '원흥역',
      '삼송역',
      '지축역',
      '구파발역',
      '연신내역',
      '불광역',
      '녹번역',
      '홍제역',
      '무악재역',
      '독립문역',
      '경복궁(정부서울청사)역',
      '안국역',
      '종로3가역',
    ])
  })

  it('신분당선: 원본 코드 체계가 통일되며(2026-09-14) 신사에서 광교까지 순서대로 나온다', () => {
    // 사용자가 엑셀 원본에서 신분당선 코드를 "43xx"/"Dxx" 혼용에서 "Dxx"로
    // 통일했다 — 그 전엔 "4305"~"4319"(12개 역)이 "D04"·"D13"~"D15"(4개 역)와
    // 자연정렬이 안 맞아 신사(D04)가 맨 뒤로 밀리는 등 순서가 깨져 있었다.
    const stations = listStationsOnLine(seoulRecords, lineIdOf(seoulRecords, 'SB-S'))
    expect(stations.map((s) => s.officialStationName)).toEqual([
      '신사역',
      '논현역',
      '신논현역',
      '강남역',
      '양재(서초구청)역',
      '양재시민의숲(매헌)역',
      '청계산입구역',
      '판교(판교테크노밸리)역',
      '정자역',
      '미금(분당서울대병원)역',
      '동천역',
      '수지구청역',
      '성복역',
      '상현역',
      '광교중앙(아주대)역',
      '광교(경기대)역',
    ])
  })

  it('부산 1호선: 다대포해수욕장~장림 코드가 바로잡혀(2026-09-14) 노선 맨 앞에 온다', () => {
    // 원래 코드(195~199)는 다른 구간(100~104 등)보다 큰 숫자라 자연정렬상 노선
    // 맨 뒤로 밀렸다 — 실제로는 다대포해수욕장이 이 노선의 시종점이다. 사용자가
    // 코드를 095~099로 바로잡았다.
    const stations = listStationsOnLine(busanRecords, busanRecords.find((r) => r.line.lineCode === 'BT-1')!.line.lineId)
    expect(stations.slice(0, 6).map((s) => s.officialStationName)).toEqual([
      '다대포해수욕장역',
      '다대포항역',
      '낫개역',
      '신장림역',
      '장림역',
      '동매역',
    ])
  })

  it('대구 1호선: 중앙로 코드가 바로잡혀(2026-09-14) 반월당과 대구역 사이에 온다', () => {
    // 원래 코드(3140)는 다른 구간(01xx)과 체계가 달라 자연정렬상 순서가 어긋났다.
    // 사용자가 코드를 0131로 바로잡았다.
    const stations = listStationsOnLine(daeguRecords, lineIdOf(daeguRecords, 'DT-1'))
    const jungangnoIndex = stations.findIndex((s) => s.officialStationName === '중앙로역')
    expect(jungangnoIndex).toBeGreaterThan(0)
    expect(stations[jungangnoIndex - 1].officialStationName).toBe('반월당역')
    expect(stations[jungangnoIndex + 1].officialStationName).toBe('대구역')
  })

  it('광주 1호선: "학동증심사입구"가 "학동.증심사입구"로 바뀌어(2026-09-14) 7호선 "학동"과 헷갈리지 않는다', () => {
    const results = search(records, '학동.증심사입구', { limit: 10 })
    expect(results.some((r) => r.record.officialStationName === '학동.증심사입구역')).toBe(true)
    // 서울 7호선의 "학동"과는 별개 역이다.
    expect(records.some((r) => r.officialStationName === '학동역')).toBe(true)
  })
})

describe('실제 데이터: 7호선·8호선 코드 재정렬(2026-09-14)', () => {
  function lineIdOf(records: StationLineRecord[], lineCode: string): string {
    const record = records.find((r) => r.line.lineCode === lineCode)
    if (!record) throw new Error(`${lineCode} 레코드를 찾지 못했다`)
    return record.line.lineId
  }

  it('7호선은 서울교통공사·인천교통공사 구간 코드가 통일되며(709~761) 장암부터 석남까지 하나의 연속된 순서로 나온다', () => {
    const stations = listStationsOnLine(seoulRecords, lineIdOf(seoulRecords, 'SM-7'))
    expect(stations).toHaveLength(53)
    expect(stations[0].officialStationName).toBe('장암역')
    expect(stations[stations.length - 1].officialStationName).toBe('석남(거북시장)역')
    // 총신대입구(이수)가 서울교통공사 구간 안(온수 이전)에 정상적으로 끼어 있다.
    const isuIndex = stations.findIndex((s) => s.officialStationName === '총신대입구(이수)역')
    const onsuIndex = stations.findIndex((s) => s.officialStationName === '온수역')
    expect(isuIndex).toBeGreaterThan(0)
    expect(isuIndex).toBeLessThan(onsuIndex)
  })

  it('8호선: 남위례 코드가 바로잡혀(2026-09-14) 복정과 산성 사이에 오고, 별내·다산·구리·동구릉·장자호수공원도 한 묶음으로 붙는다', () => {
    const stations = listStationsOnLine(seoulRecords, lineIdOf(seoulRecords, 'SM-8'))
    const names = stations.map((s) => s.officialStationName)
    const bokjeongIndex = names.indexOf('복정(동서울대학)역')
    const namwiryeIndex = names.indexOf('남위례역')
    const seongIndex = names.indexOf('산성역')
    expect(namwiryeIndex).toBe(bokjeongIndex + 1)
    expect(seongIndex).toBe(namwiryeIndex + 1)
    // 별내(삼육대학교)~장자호수공원 5개 역이 한 묶음으로 붙어 있다(순서는 관여하지 않음).
    const extensionNames = ['별내(삼육대학교)역', '다산역', '구리역', '동구릉역', '장자호수공원역']
    const indices = extensionNames.map((n) => names.indexOf(n)).sort((a, b) => a - b)
    expect(indices.every((idx) => idx >= 0)).toBe(true)
    expect(indices[indices.length - 1] - indices[0]).toBe(extensionNames.length - 1) // 연속된 구간
  })
})

describe('실제 데이터: 2호선 본선 ↔ 성수지선·신정지선(지선, 2026-09-14)', () => {
  function lineIdOf(records: StationLineRecord[], lineCode: string): string {
    const record = records.find((r) => r.line.lineCode === lineCode)
    if (!record) throw new Error(`${lineCode} 레코드를 찾지 못했다`)
    return record.line.lineId
  }

  it('2호선 본선은 "노선 선택" 등 대부분의 자리에 쓰는 displayName은 그대로 "2호선"이고, stationListLabel만 "을지로순환선(본선)"이다(사용자 확인: "밑에 리스트를 변경해달라는거였지, 위의 노선 명을 바꾸라곤 안했어")', () => {
    const mainLine = seoulRecords.find((r) => r.line.lineCode === 'SM-2')!.line
    expect(mainLine.displayName).toBe('2호선')
    expect(mainLine.stationListLabel).toBe('을지로순환선(본선)')
    expect(mainLine.iconLabel).toBe('2')
    expect(mainLine.lineNumber).toBe(2)
  })

  it('"을지로순환선"·"을지로"로 검색하면(별칭) 본선 소속 역이 나온다', () => {
    for (const keyword of ['을지로순환선', '을지로']) {
      const results = search(seoulRecords, keyword, { limit: 50 })
      expect(results.some((r) => r.record.officialStationName === '시청역' && r.record.line.lineCode === 'SM-2')).toBe(true)
    }
  })

  it('성수지선은 성수→용답→신답→용두→신설동 5개 역이고, 신정지선은 신도림→도림천→양천구청→신정네거리→까치산 5개 역이다', () => {
    const seongsu = listStationsOnLine(seoulRecords, lineIdOf(seoulRecords, 'SM-2-SEONGSU'))
    expect(seongsu.map((s) => s.officialStationName)).toEqual([
      '성수역', '용답역', '신답역', '용두(동대문구청)역', '신설동역',
    ])

    const sinjeong = listStationsOnLine(seoulRecords, lineIdOf(seoulRecords, 'SM-2-SINJEONG'))
    expect(sinjeong.map((s) => s.officialStationName)).toEqual([
      '신도림역', '도림천역', '양천구청역', '신정네거리역', '까치산역',
    ])
  })

  it('성수지선·신정지선은 "노선 선택" 목록에 안 나오고, 2호선의 지선으로만 잡힌다', () => {
    const selectable = deriveSelectableLines(seoulRecords)
    expect(selectable.some((l) => l.displayName === '성수지선')).toBe(false)
    expect(selectable.some((l) => l.displayName === '신정지선')).toBe(false)
    expect(selectable.some((l) => l.displayName === '2호선')).toBe(true)

    const mainLineId = lineIdOf(seoulRecords, 'SM-2')
    const children = deriveChildLines(records, mainLineId).map((l) => l.displayName)
    expect(children).toEqual(['성수지선', '신정지선'])
  })

  it('2호선 본선에서 성수·신도림을 보면 환승 배지는 안 붙고, 대신 지선 분기 표시(branchLines)가 붙는다', () => {
    const stations = listStationsOnLine(records, lineIdOf(seoulRecords, 'SM-2'))
    const seongsu = stations.find((s) => s.officialStationName === '성수역')!
    expect(seongsu.transferLines.some((l) => l.displayName === '성수지선')).toBe(false)
    expect(seongsu.branchLines.map((l) => l.displayName)).toEqual(['성수지선'])

    const sindorim = stations.find((s) => s.officialStationName === '신도림역')!
    expect(sindorim.transferLines.some((l) => l.displayName === '신정지선')).toBe(false)
    expect(sindorim.branchLines.map((l) => l.displayName)).toEqual(['신정지선'])
  })

  it('까치산은 신정지선과 5호선의 실제 환승역이라 5호선 배지는 그대로 남는다', () => {
    const stations = listStationsOnLine(records, lineIdOf(seoulRecords, 'SM-2-SINJEONG'))
    const kkachisan = stations.find((s) => s.officialStationName === '까치산역')!
    expect(kkachisan.transferLines.map((l) => l.displayName)).toEqual(['5호선'])
  })

  it('지선 자신의 이름("성수지선"·"신정지선")으로는 검색되지 않는다(사용자 확인: "지선들에 대한 키워드 검색은 불필요")', () => {
    expect(search(seoulRecords, '성수지선', { limit: 50 })).toHaveLength(0)
    expect(search(seoulRecords, '신정지선', { limit: 50 })).toHaveLength(0)
  })
})

describe('실제 데이터: 1호선 본선 ↔ 경부/장항선 ↔ 경부고속선·병점기지선(2단계 지선, 2026-09-14)', () => {
  function lineIdOf(records: StationLineRecord[], lineCode: string): string {
    const record = records.find((r) => r.line.lineCode === lineCode)
    if (!record) throw new Error(`${lineCode} 레코드를 찾지 못했다`)
    return record.line.lineId
  }

  it('1호선 본선도 2호선과 같은 원칙 — displayName은 "1호선" 그대로, stationListLabel만 "경원/종로/경인선(본선)"이다', () => {
    const mainLine = seoulRecords.find((r) => r.line.lineCode === 'SM-1')!.line
    expect(mainLine.displayName).toBe('1호선')
    expect(mainLine.stationListLabel).toBe('경원/종로/경인선(본선)')
    expect(mainLine.iconLabel).toBe('1')
    expect(mainLine.lineNumber).toBe(1)
  })

  it('1호선 본선은 회기(123)~남영(134) 사이 자연정렬만으로 실제 순서가 나오고(동묘앞이 127로 재번호돼 override 없이도 신설동·동대문 사이에 낀다), 구로에서 끝난다 — 구로~신창(경부/장항선)은 빠진다', () => {
    const stations = listStationsOnLine(seoulRecords, lineIdOf(seoulRecords, 'SM-1'))
    const names = stations.map((s) => s.officialStationName)
    const gihiIndex = names.indexOf('회기역')
    expect(gihiIndex).toBeGreaterThanOrEqual(0)
    expect(names.slice(gihiIndex, gihiIndex + 12)).toEqual([
      '회기역', '청량리역', '제기동역', '신설동역', '동묘앞역', '동대문역',
      '종로5가역', '종로3가역', '종각역', '시청역', '서울역', '남영역',
    ])
    // 구로(경부/장항선과 만나는 분기점)까지만 본선이고, 그 이남(가산디지털단지·
    // 금천구청·광명·수원·천안·아산·신창 등)은 전부 빠진다.
    expect(names).toContain('구로역')
    for (const branchOnlyStation of ['가산디지털단지역', '금천구청역', '광명역', '수원역', '천안역', '아산역', '신창(순천향대)역']) {
      expect(names).not.toContain(branchOnlyStation)
    }
  })

  it('경부/장항선은 구로에서 시작해 신창까지 이어지고, 그 안에서 다시 경부고속선(금천구청→광명)·병점기지선(병점→서동탄)이 갈라진다', () => {
    const gyeongbuJanghang = listStationsOnLine(seoulRecords, lineIdOf(seoulRecords, 'SM-1-GYEONGBU-JANGHANG'))
    const names = gyeongbuJanghang.map((s) => s.officialStationName)
    expect(names[0]).toBe('구로역')
    expect(names[names.length - 1]).toBe('신창(순천향대)역')
    expect(names).toContain('금천구청역')
    expect(names).toContain('병점역')
    // 광명·서동탄은 각자의 지선(경부고속선·병점기지선) 소속이라 여기엔 없다.
    expect(names).not.toContain('광명역')
    expect(names).not.toContain('서동탄역')

    const gyeongbugosok = listStationsOnLine(seoulRecords, lineIdOf(seoulRecords, 'SM-1-GYEONGBUGOSOK'))
    expect(gyeongbugosok.map((s) => s.officialStationName)).toEqual(['금천구청역', '광명역'])

    const byeongjeom = listStationsOnLine(seoulRecords, lineIdOf(seoulRecords, 'SM-1-BYEONGJEOM'))
    expect(byeongjeom.map((s) => s.officialStationName)).toEqual(['병점역', '서동탄역'])
  })

  it('경부/장항선·경부고속선·병점기지선은 전부 "노선 선택" 목록에 안 나오고, 1호선을 고르면 세 패널이 한꺼번에 나온다(지선의 지선까지 재귀적으로)', () => {
    const selectable = deriveSelectableLines(seoulRecords)
    expect(selectable.some((l) => l.displayName === '경부/장항선')).toBe(false)
    expect(selectable.some((l) => l.displayName === '경부고속선')).toBe(false)
    expect(selectable.some((l) => l.displayName === '병점기지선')).toBe(false)
    expect(selectable.some((l) => l.displayName === '1호선')).toBe(true)

    const mainLineId = lineIdOf(seoulRecords, 'SM-1')
    // 직계 자식만 보면 "경부/장항선" 하나뿐이다.
    expect(deriveChildLines(records, mainLineId).map((l) => l.displayName)).toEqual(['경부/장항선'])
    // 재귀적으로 모으면(App.tsx가 실제로 쓰는 방식) 손자뻘 지선까지 다 나온다.
    expect(deriveDescendantLines(records, mainLineId).map((l) => l.displayName)).toEqual([
      '경부/장항선', '경부고속선', '병점기지선',
    ])
  })

  it('1호선 본선에서 구로를 보면 환승 배지는 안 붙고, 대신 "경부/장항선" 분기 표시(branchLines)가 붙는다', () => {
    const stations = listStationsOnLine(records, lineIdOf(seoulRecords, 'SM-1'))
    const guro = stations.find((s) => s.officialStationName === '구로역')!
    expect(guro.transferLines.some((l) => l.displayName === '경부/장항선')).toBe(false)
    expect(guro.branchLines.map((l) => l.displayName)).toEqual(['경부/장항선'])
  })

  it('경부/장항선 자기 목록에서 금천구청·병점을 보면 환승 배지는 안 붙고, 대신 경부고속선·병점기지선 분기 표시(branchLines)가 붙는다', () => {
    const stations = listStationsOnLine(records, lineIdOf(seoulRecords, 'SM-1-GYEONGBU-JANGHANG'))
    const geumcheon = stations.find((s) => s.officialStationName === '금천구청역')!
    expect(geumcheon.transferLines.some((l) => l.displayName === '경부고속선')).toBe(false)
    expect(geumcheon.branchLines.map((l) => l.displayName)).toEqual(['경부고속선'])

    const byeongjeomStation = stations.find((s) => s.officialStationName === '병점역')!
    expect(byeongjeomStation.transferLines.some((l) => l.displayName === '병점기지선')).toBe(false)
    expect(byeongjeomStation.branchLines.map((l) => l.displayName)).toEqual(['병점기지선'])
  })

  it('다른 노선(예: KTX)에서 경부고속선 소속 역(광명)을 보면, 지선 자신이 아니라 그 바로 위 부모(경부/장항선)의 정체성으로 배지가 붙는다 — 한 단계만 올라가지 더 위(1호선)까지는 안 간다', () => {
    // 광명역은 KTX와 경부고속선(1호선의 지선의 지선)의 실제 환승역이다.
    const ktxGwangmyeong = records.find((r) => r.officialStationName === '광명역' && r.line.displayName === 'KTX-경부-행신착발')!
    const stations = listStationsOnLine(records, ktxGwangmyeong.line.lineId)
    const station = stations.find((s) => s.officialStationName === '광명역')!
    expect(station.transferLines.map((l) => l.displayName)).toContain('경부/장항선')
    expect(station.transferLines.some((l) => l.displayName === '경부고속선')).toBe(false)
    expect(station.transferLines.some((l) => l.displayName === '1호선')).toBe(false)
  })

  it('경부/장항선 소속 역(금정)을 다른 노선(4호선)에서 보면, 경부/장항선의 부모인 "1호선" 배지가 붙는다', () => {
    // 금정역은 4호선과 경부/장항선(원 1호선 구간)의 실제 환승역이다.
    const line4Geumjeong = records.find((r) => r.officialStationName === '금정역' && r.line.displayName === '4호선')!
    const stations = listStationsOnLine(records, line4Geumjeong.line.lineId)
    const station = stations.find((s) => s.officialStationName === '금정역')!
    expect(station.transferLines.map((l) => l.displayName)).toEqual(['1호선'])
  })

  it('지선 자신의 이름으로는 그 소속 역이 검색되지 않는다 — "경부/장항선"은 수원(직속)을 못 찾고, "경부고속선"·"병점기지선"은 자기 자신이니 아예 0건이다', () => {
    // 수원(경부/장항선 직속)은 "경부/장항선"이라는 지선 자신의 이름으로는 안 잡힌다.
    const byGyeongbuJanghangName = search(seoulRecords, '경부/장항선', { limit: 500 })
    expect(byGyeongbuJanghangName.some((r) => r.record.officialStationName === '수원역')).toBe(false)
    // 반대로 광명·서동탄(경부고속선·병점기지선 소속)은 자신의 바로 위 부모인
    // "경부/장항선"이 officialName에 그 문자열을 담고 있어 함께 걸린다 — 광명·
    // 서동탄 입장에서 "경부/장항선"은 자기 이름이 아니라 부모 이름이므로 정상
    // 허용이다(5호선 키워드로 마천지선을 찾는 것과 같은 원리).
    expect(byGyeongbuJanghangName.some((r) => r.record.officialStationName === '광명역')).toBe(true)
    expect(byGyeongbuJanghangName.some((r) => r.record.officialStationName === '서동탄역')).toBe(true)

    expect(search(seoulRecords, '경부고속선', { limit: 50 })).toHaveLength(0)
    expect(search(seoulRecords, '병점기지선', { limit: 50 })).toHaveLength(0)
  })
})

describe('실제 데이터: 5호선 ↔ 마천지선(지선, 2026-09-14)', () => {
  function lineIdOf(records: StationLineRecord[], lineCode: string): string {
    const record = records.find((r) => r.line.lineCode === lineCode)
    if (!record) throw new Error(`${lineCode} 레코드를 찾지 못했다`)
    return record.line.lineId
  }

  it('5호선 본선은 49개 역이고 둔촌동~마천이 빠져 방화부터 하남검단산까지 이어진다', () => {
    const stations = listStationsOnLine(seoulRecords, lineIdOf(seoulRecords, 'SM-5'))
    expect(stations).toHaveLength(49)
    expect(stations[0].officialStationName).toBe('방화역')
    expect(stations[stations.length - 1].officialStationName).toBe('하남검단산역')
    expect(stations.map((s) => s.officialStationName)).not.toContain('둔촌동역')
    // 강동(분기점)은 그대로 본선에 남아, 천호와 길동 사이에 있다.
    const gangdongIndex = stations.findIndex((s) => s.officialStationName === '강동역')
    expect(stations[gangdongIndex - 1].officialStationName).toBe('천호(풍납토성)역')
    expect(stations[gangdongIndex + 1].officialStationName).toBe('길동역')
  })

  it('마천지선은 강동→둔촌동→올림픽공원→방이→오금→개롱→거여→마천 8개 역이고, 자기 이름은 원래대로 표시된다', () => {
    const stations = listStationsOnLine(seoulRecords, lineIdOf(seoulRecords, 'SM-5-MACHEON'))
    expect(stations.map((s) => s.displayStationName)).toEqual([
      '강동역', '둔촌동역', '올림픽공원(한국체대)역', '방이역', '오금역', '개롱역', '거여역', '마천역',
    ])
  })

  it('마천지선 자기 목록에서는 본선(5호선) 배지를 보여주지 않는다', () => {
    const stations = listStationsOnLine(records, lineIdOf(seoulRecords, 'SM-5-MACHEON'))
    const gangdong = stations.find((s) => s.displayStationName === '강동역')!
    expect(gangdong.transferLines.some((l) => l.displayName === '5호선')).toBe(false)
  })

  it('마천지선은 "노선 선택" 목록에 안 나오고, 5호선의 지선으로만 잡힌다', () => {
    const selectable = deriveSelectableLines(seoulRecords)
    expect(selectable.some((l) => l.displayName === '마천지선')).toBe(false)
    expect(selectable.some((l) => l.displayName === '5호선')).toBe(true)

    const line5Id = lineIdOf(seoulRecords, 'SM-5')
    const children = deriveChildLines(records, line5Id)
    expect(children.map((l) => l.displayName)).toEqual(['마천지선'])
  })

  it('5호선 본선에서 강동을 보면 환승 배지는 안 붙고, 대신 마천지선 분기 표시(branchLines)가 붙는다(사용자 확인: "환승 알을 표기할 필요 없어")', () => {
    const stations = listStationsOnLine(records, lineIdOf(seoulRecords, 'SM-5'))
    const gangdong = stations.find((s) => s.officialStationName === '강동역')!
    expect(gangdong.transferLines.some((l) => l.displayName === '마천지선')).toBe(false)
    expect(gangdong.branchLines.map((l) => l.displayName)).toEqual(['마천지선'])
  })

  it('마천지선이 아닌 다른 노선(3호선)에서 오금을 보면 "마천지선"이 아니라 "5호선" 배지가 붙는다(사용자 확인: "큰 노선만 하나만 표기")', () => {
    const line3Id = seoulRecords.find((r) => r.line.lineNumber === 3 && r.officialStationName === '오금역')!.line.lineId
    const stations = listStationsOnLine(records, line3Id)
    const ogeum = stations.find((s) => s.officialStationName === '오금역')!
    expect(ogeum.transferLines.map((l) => l.displayName)).toEqual(['5호선'])
  })
})

describe('실제 데이터: 경춘선 ↔ 망우선(지선)', () => {
  function lineIdOf(records: StationLineRecord[], lineCode: string): string {
    const record = records.find((r) => r.line.lineCode === lineCode)
    if (!record) throw new Error(`${lineCode} 레코드를 찾지 못했다`)
    return record.line.lineId
  }

  it('경춘선 본선은 청량리에서 시작한다(광운대는 본선 순번에서 빠졌다 — 원래는 망우선 소속)', () => {
    const stations = listStationsOnLine(seoulRecords, lineIdOf(seoulRecords, 'KR-GYEONGCHUN'))
    expect(stations).toHaveLength(24)
    expect(stations[0].officialStationName).toBe('청량리역')
    expect(stations.map((s) => s.officialStationName)).not.toContain('광운대역')
    expect(stations[stations.length - 1].officialStationName).toBe('춘천(한림대)역')
  })

  it('망우선은 광운대→상봉 2개 역이고, 자기 이름은 원래대로 표시된다', () => {
    const stations = listStationsOnLine(seoulRecords, lineIdOf(seoulRecords, 'KR-MANGU'))
    expect(stations.map((s) => s.displayStationName)).toEqual(['광운대역', '상봉역'])
  })

  it('망우선 자기 목록에서는 본선(경춘선) 배지를 보여주지 않는다 — 지선이 본선과 만나는 건 당연하다(사용자 확인)', () => {
    const stations = listStationsOnLine(records, lineIdOf(seoulRecords, 'KR-MANGU'))
    const sangbong = stations.find((s) => s.displayStationName === '상봉역')!
    expect(sangbong.transferLines.some((l) => l.displayName === '경춘선')).toBe(false)
    // 경춘선(본선) 외의 다른 환승은 그대로 보여준다.
    expect(sangbong.transferLines.some((l) => l.displayName === '7호선')).toBe(true)
    expect(sangbong.transferLines.some((l) => l.displayName === '경의중앙선')).toBe(true)
  })

  it('망우선은 "노선 선택" 목록(deriveSelectableLines)에 안 나오고, 경춘선의 지선(deriveChildLines)으로만 잡힌다', () => {
    const selectable = deriveSelectableLines(seoulRecords)
    expect(selectable.some((l) => l.displayName === '망우선')).toBe(false)
    expect(selectable.some((l) => l.displayName === '경춘선')).toBe(true)

    const gyeongchunLineId = lineIdOf(seoulRecords, 'KR-GYEONGCHUN')
    const children = deriveChildLines(records, gyeongchunLineId)
    expect(children.map((l) => l.displayName)).toEqual(['망우선'])
  })

  it('1호선에서 광운대를 보면 "망우선"이 아니라 그 본선인 "경춘선" 배지가 붙는다(사용자 확인: "큰 노선만 하나만 표기")', () => {
    const line1Id = lineIdOf(seoulRecords, 'SM-1')
    const line1Stations = listStationsOnLine(records, line1Id)
    const gwangwoondae = line1Stations.find((s) => s.officialStationName === '광운대역')!
    expect(gwangwoondae.transferLines.map((l) => l.displayName)).toEqual(['경춘선'])
  })

  it('경춘선 자기 목록에서는 망우선 환승 배지가 안 붙고, 대신 상봉이 분기역으로 branchLines에 잡힌다(사용자 확인: "환승 알을 표기할 필요 없어")', () => {
    const gyeongchunStations = listStationsOnLine(records, lineIdOf(seoulRecords, 'KR-GYEONGCHUN'))
    const sangbong = gyeongchunStations.find((s) => s.officialStationName === '상봉역')!
    expect(sangbong.transferLines.some((l) => l.displayName === '망우선')).toBe(false)
    expect(sangbong.transferLines.some((l) => l.displayName === '1호선')).toBe(false)
    expect(sangbong.branchLines.map((l) => l.displayName)).toEqual(['망우선'])
  })
})

describe('실제 데이터: 경의중앙선 ↔ 경의1선(지선)', () => {
  function lineIdOf(records: StationLineRecord[], lineCode: string): string {
    const record = records.find((r) => r.line.lineCode === lineCode)
    if (!record) throw new Error(`${lineCode} 레코드를 찾지 못했다`)
    return record.line.lineId
  }

  it('경의중앙선 본선에는 서울역·신촌이 빠져 있고, 도라산(K338)은 그대로 남아 있다', () => {
    const stations = listStationsOnLine(seoulRecords, lineIdOf(seoulRecords, 'KR-GYEONGUI-JUNGANG'))
    const names = stations.map((s) => s.officialStationName)
    expect(names).not.toContain('서울역')
    expect(names).not.toContain('신촌역')
    expect(names).toContain('도라산역') // 캡처엔 없었지만 이미 본선(K338)에 정상 포함
  })

  it('경의중앙선 본선은 원본 코드 3개 구간(용산선/경원선·중앙선/경의선)을 나무위키 km 순서로 재정렬한 도라산~지평 순으로 나온다', () => {
    // 원본 코드가 K1xx(용산~응봉)·K2xx(청량리·왕십리만)·K3xx(효창공원앞~용산,
    // 그리고 별도로 임진강~디지털미디어시티)로 나뉘어 있어 자연정렬로는 전혀 다른
    // 순서가 나온다 — station-line-sequence.csv로 56개 역 전체를 재정렬했다
    // (사용자 확인: "도라산역이 임진강 윗 역이야").
    const stations = listStationsOnLine(seoulRecords, lineIdOf(seoulRecords, 'KR-GYEONGUI-JUNGANG'))
    expect(stations).toHaveLength(56)
    expect(stations.map((s) => s.officialStationName)).toEqual([
      '도라산역', '임진강역', '운천역', '문산역', '파주(두원대학)역', '월롱(서영대학교)역',
      '금촌역', '금릉역', '운정역', '야당역', '탄현역', '일산역', '풍산역', '백마역', '곡산역',
      '대곡역', '능곡역', '행신역', '강매역', '한국항공대역', '수색역', '디지털미디어시티역',
      '가좌역', '홍대입구역', '서강대역', '공덕역', '효창공원앞역', '용산역', '이촌역',
      '서빙고역', '한남역', '옥수역', '응봉역', '왕십리역', '청량리역', '회기역', '중랑역',
      '상봉역', '망우역', '양원(서울시북부병원)역', '구리역', '도농역', '양정역', '덕소역',
      '도심역', '팔당역', '운길산역', '양수역', '신원역', '국수역', '아신(아세아연합신학대)역',
      '오빈역', '양평역', '원덕(추읍산)역', '용문역', '지평역',
    ])
  })

  it('경의1선은 가좌→신촌→서울역 3개 역이고, 자기 이름은 원래대로 표시된다', () => {
    const stations = listStationsOnLine(seoulRecords, lineIdOf(seoulRecords, 'KR-GYEONGUI1'))
    expect(stations.map((s) => s.displayStationName)).toEqual(['가좌역', '신촌역', '서울역'])
  })

  it('경의1선 자기 목록에서는 본선(경의중앙선) 배지를 보여주지 않는다', () => {
    const stations = listStationsOnLine(records, lineIdOf(seoulRecords, 'KR-GYEONGUI1'))
    const gajwa = stations.find((s) => s.displayStationName === '가좌역')!
    expect(gajwa.transferLines.some((l) => l.displayName === '경의중앙선')).toBe(false)
  })

  it('경의1선은 "노선 선택" 목록에 안 나오고, 경의중앙선의 지선으로만 잡힌다', () => {
    const selectable = deriveSelectableLines(seoulRecords)
    expect(selectable.some((l) => l.displayName === '경의1선')).toBe(false)
    expect(selectable.some((l) => l.displayName === '경의중앙선')).toBe(true)

    const gyeonguiJungangId = lineIdOf(seoulRecords, 'KR-GYEONGUI-JUNGANG')
    const children = deriveChildLines(records, gyeonguiJungangId)
    expect(children.map((l) => l.displayName)).toEqual(['경의1선'])
  })

  it('경의중앙선 본선에서 가좌를 보면 환승 배지는 안 붙고, 대신 경의1선 분기 표시(branchLines)가 붙는다(사용자 확인: "환승 알을 표기할 필요 없어")', () => {
    const gyeonguiJungangStations = listStationsOnLine(records, lineIdOf(seoulRecords, 'KR-GYEONGUI-JUNGANG'))
    const gajwa = gyeonguiJungangStations.find((s) => s.officialStationName === '가좌역')!
    expect(gajwa.transferLines.some((l) => l.displayName === '경의1선')).toBe(false)
    expect(gajwa.branchLines.map((l) => l.displayName)).toEqual(['경의1선'])
  })

  it('신촌은 2호선과 경의1선(경의중앙선 지선)에 이름만 같을 뿐 환승역이 아니라 서로 다른 station_id로 분리된다', () => {
    const groups = searchGrouped(seoulRecords, '신촌', { limit: 10 })
    const matching = groups.filter((g) => g.officialStationName === '신촌역')
    expect(matching).toHaveLength(2)
    expect(matching[0].stationId).not.toBe(matching[1].stationId)
  })
})

describe('실제 데이터: 부산', () => {
  it('서면은 1호선·2호선 두 행으로 반환된다', () => {
    const results = search(busanRecords, '서면')
    expect(results).toHaveLength(2)
    const lineNumbers = results.map((r) => r.record.line.lineNumber).sort()
    expect(lineNumbers).toEqual([1, 2])
  })

  it('동래는 1호선·4호선·동해선 세 행으로 반환되고 모두 부산 지역이다', () => {
    const results = search(busanRecords, '동래', { limit: 10 })
    expect(results).toHaveLength(3)
    expect(results.every((r) => r.record.regionCode === 'BUSAN')).toBe(true)
  })

  it('좌천은 1호선과 동해선에 이름만 같을 뿐 환승역이 아니라 서로 다른 station_id로 분리된다', () => {
    const groups = searchGrouped(busanRecords, '좌천', { limit: 10 })
    const matching = groups.filter((g) => g.displayStationName.startsWith('좌천'))
    expect(matching.length).toBeGreaterThanOrEqual(2)
    const stationIds = new Set(matching.map((g) => g.stationId))
    expect(stationIds.size).toBe(matching.length) // 전부 서로 다른 station_id — 배지가 합쳐지지 않는다.
  })

  it('부전은 부산 1호선·동해선이 실제로 환승 가능해 하나로 합쳐진다(2026-09-16 사용자 확인으로 정정)', () => {
    const groups = searchGrouped(busanRecords, '부전', { limit: 10 })
    const matching = groups.filter((g) => g.displayStationName.startsWith('부전'))
    expect(matching).toHaveLength(1)
    expect(matching[0].lines.map((l) => l.line.displayName)).toEqual(
      expect.arrayContaining(['부산 1호선', '동해선']),
    )
  })

  it('부산-김해 경전철 노선의 역도 검색된다', () => {
    const results = search(busanRecords, '김해경전철', { limit: 50 })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => r.record.line.displayName === '부산김해경전철')).toBe(true)
  })

  it('경성대.부경대(동명대학교)역은 문장부호 없이("경성대부경대") 검색해도 나온다', () => {
    const withDot = search(busanRecords, '경성대.부경대')
    const withoutDot = search(busanRecords, '경성대부경대')
    expect(withDot).toHaveLength(1)
    expect(withoutDot).toHaveLength(1)
    expect(withoutDot[0].record.officialStationName).toBe('경성대.부경대(동명대학교)역')
    expect(withoutDot[0].record.subName).toBe('동명대학교')
  })

  it('경성대.부경대(동명대학교)역은 초성 ㄱㅅㄷㅂㄱㄷ로 검색된다(문장부호가 초성에 섞이지 않는다)', () => {
    const results = search(busanRecords, 'ㄱㅅㄷㅂㄱㄷ')
    expect(results).toHaveLength(1)
    expect(results[0].record.officialStationName).toBe('경성대.부경대(동명대학교)역')
  })

  it('봉황(김해여객터미널)역은 부역명이 필드로는 저장되지만, 괄호 안 부역명만으로는 검색되지 않는다', () => {
    const results = search(busanRecords, '봉황')
    expect(results).toHaveLength(1)
    expect(results[0].record.officialStationName).toBe('봉황(김해여객터미널)역')
    expect(results[0].record.subName).toBe('김해여객터미널')

    const bySubName = search(busanRecords, '김해여객터미널')
    expect(bySubName).toHaveLength(0)
  })
})

describe('실제 데이터: 대구', () => {
  it('반월당은 1호선·2호선 환승역이다', () => {
    const results = search(daeguRecords, '반월당')
    expect(results).toHaveLength(2)
    const lineNumbers = results.map((r) => r.record.line.lineNumber).sort()
    expect(lineNumbers).toEqual([1, 2])
  })

  it('명덕(2.28민주운동기념회관)역은 부역명이 필드로는 저장되지만, 부역명만으로는 검색되지 않는다', () => {
    const byAlias = search(daeguRecords, '228민주운동기념회관')
    expect(byAlias.some((r) => r.record.officialStationName === '명덕(2.28민주운동기념회관)역')).toBe(false)

    // 부역명 토큰이 섞이면 AND 검색 특성상 매칭되지 않는다(부역명은 검색 색인에서 제외됨).
    const byBothTokens = search(daeguRecords, '명덕 228민주운동기념회관', { limit: 10 })
    expect(byBothTokens).toHaveLength(0)

    // 본 역명(명덕)만으로는 정상적으로 검색된다.
    const byMainName = search(daeguRecords, '명덕', { limit: 10 })
    expect(byMainName.some((r) => r.record.officialStationName === '명덕(2.28민주운동기념회관)역')).toBe(true)
  })

  it('대경선(대구-경북 통근열차) 역도 검색된다', () => {
    const results = search(daeguRecords, '대경선', { limit: 50 })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => r.record.line.displayName === '대경선')).toBe(true)
  })
})

describe('실제 데이터: 광주·대전 (신규 지역)', () => {
  it('광주 1호선 역들이 모두 GWANGJU 지역·광주 1호선으로 분류된다', () => {
    expect(gwangjuRecords.length).toBeGreaterThan(0)
    expect(gwangjuRecords.every((r) => r.line.displayName === '광주 1호선' && r.line.lineNumber === 1)).toBe(true)
  })

  it('대전 1호선 역들이 모두 DAEJEON 지역·대전 1호선으로 분류된다', () => {
    expect(daejeonRecords.length).toBeGreaterThan(0)
    expect(daejeonRecords.every((r) => r.line.displayName === '대전 1호선' && r.line.lineNumber === 1)).toBe(true)
  })
})

describe('실제 데이터: KTX (game_line_stations.csv 기반, 2026-09-16 2차: SRT 명칭을 KTX로 통합)', () => {
  // 2026-09-16 2차 사용자 확인: "KTX 노선 SRT 노선 병합... SRT 명도 KTX로 통합."
  // — "SRT"라는 브랜드 이름이 화면에서 사라지고 옛 SRT(수서발) 5개 노선도
  // line.trainServiceCode="KTX"로 합류한다. 같은 이름이 겹치는 5개 계통(경부·
  // 호남·전라·경부-동해·경전)만 "행신착발"/"수서착발" 접미어로 구분하고(사용자
  // 확인: "착발 구분은 행신 착발 / 수서 착발으로", "괄호는 빼줘"), 겹칠 상대가
  // 없는 4개(강릉·중앙·동해[전구간]·중부내륙)는 접미어 없이 그대로 둔다.
  it('KTX 노선 14개(옛 KTX 9 + 옛 SRT 5) 모두 line.trainServiceCode="KTX"로 합쳐진다', () => {
    const displayNames = new Set(ktxRecords.map((r) => r.line.displayName))
    expect(displayNames).toEqual(
      new Set([
        'KTX-경부-행신착발',
        'KTX-경부-수서착발',
        'KTX-호남-행신착발',
        'KTX-호남-수서착발',
        'KTX-전라-행신착발',
        'KTX-전라-수서착발',
        'KTX-강릉',
        'KTX-중앙',
        'KTX-경부-동해-행신착발',
        'KTX-경부-동해-수서착발',
        'KTX-동해',
        'KTX-경전-행신착발',
        'KTX-경전-수서착발',
        'KTX-중부내륙',
      ]),
    )
    expect(ktxRecords.every((r) => r.line.regionCode === 'KTX' && r.line.trainServiceCode === 'KTX')).toBe(true)
    // 아이콘 배지는 옛 SRT 쪽도 이제 전부 "KTX"다.
    expect(ktxRecords.every((r) => r.line.iconLabel === 'KTX')).toBe(true)
    // 겹치지 않는 4개는 착발 접미어가 없다.
    for (const name of ['KTX-강릉', 'KTX-중앙', 'KTX-동해', 'KTX-중부내륙']) {
      expect(displayNames.has(name)).toBe(true)
    }
    // 옛 SRT는 operatorCode로만 구분되고 남는다(색상·override 매핑 유지용).
    expect(srtRecords.length).toBeGreaterThan(0)
    expect(srtRecords.every((r) => r.line.trainServiceCode === 'KTX')).toBe(true)
  })

  it('scope_option에는 "SRT" 버튼이 더 이상 없다 — KTX 하나로 통합됐다', () => {
    const scopes = loadScopeOptions(db)
    expect(scopes.find((s) => s.scope_code === 'KTX')?.status).toBe('AVAILABLE')
    expect(scopes.find((s) => s.scope_code === 'SRT')).toBeUndefined()
  })

  it('수서착발 전용 출발역(수서/동탄/평택지제)은 기존 지하철·GTX-A 역과 환승으로 합쳐진다', () => {
    const cases: Array<[string, string]> = [
      ['수서역', '3호선'],
      ['동탄역', 'GTX-A'],
      ['평택지제역', '1호선'],
    ]
    for (const [name, existingLine] of cases) {
      const groups = searchGrouped(records, name, { limit: 10 })
      const group = groups.find((g) => g.officialStationName === name)
      expect(group, `${name} 그룹을 찾지 못함`).toBeDefined()
      const displayNames = group!.lines.map((l) => l.line.displayName)
      expect(displayNames).toEqual(expect.arrayContaining([existingLine]))
      expect(displayNames.some((n) => n.endsWith('수서착발'))).toBe(true)
    }
    // 1호선 "서동탄역"은 이름이 달라 수서착발/GTX-A "동탄역"과 합쳐지지 않는다.
    const seodongtan = searchGrouped(records, '서동탄', { limit: 10 }).find(
      (g) => g.officialStationName === '서동탄역',
    )
    expect(seodongtan).toBeDefined()
    expect(seodongtan!.lines.some((l) => l.line.displayName.endsWith('수서착발'))).toBe(false)
  })

  it('수서착발은 서울역에는 서지 않는다(수서발 전용 — 행신착발만 서울역과 환승)', () => {
    const groups = searchGrouped(records, '서울역', { limit: 10 })
    const seoul = groups.find((g) => g.officialStationName === '서울역')
    expect(seoul).toBeDefined()
    expect(seoul!.lines.some((l) => l.line.displayName.endsWith('수서착발'))).toBe(false)
  })

  it('KTX-경부-수서착발 역 순서는 수서에서 시작한다(수서→동탄→평택지제→...→부산)', () => {
    const srtGyeongbuId = records.find((r) => r.line.displayName === 'KTX-경부-수서착발')!.line.lineId
    const stations = listStationsOnLine(records, srtGyeongbuId)
    const names = stations.map((s) => s.officialStationName)
    expect(names.slice(0, 3)).toEqual(['수서역', '동탄역', '평택지제역'])
    expect(names[names.length - 1]).toBe('부산역')
  })

  it('KTX 범위 안에서 서울역을 검색하면 행신착발 7개 노선 배지가 한 행에 모인다(실제 환승 지점)', () => {
    const groups = searchGrouped(ktxRecords, '서울', { limit: 10 })
    const seoul = groups.find((g) => g.officialStationName === '서울역')
    expect(seoul).toBeDefined()
    expect(seoul!.lines.map((l) => l.line.displayName).sort()).toEqual(
      [
        'KTX-강릉',
        'KTX-경부-행신착발',
        'KTX-경전-행신착발',
        'KTX-전라-행신착발',
        'KTX-중앙',
        'KTX-경부-동해-행신착발',
        'KTX-호남-행신착발',
      ].sort(),
    )
  })

  it('전체 범위에서 서울역을 검색하면 지하철·전철 노선과 KTX 노선이 모두 한 행에 모인다', () => {
    const groups = searchGrouped(records, '서울', { limit: 10 })
    const seoul = groups.find((g) => g.officialStationName === '서울역')
    expect(seoul).toBeDefined()
    const displayNames = seoul!.lines.map((l) => l.line.displayName)
    // 서울역은 경의중앙선 본선이 아니라 지선(경의1선) 소속이지만(2026-09-14, 나무위키
    // 확인 — 경의중앙선 본선 계통은 도라산~지평, 서울역·신촌은 경의1선 계통),
    // 지선은 배지에서 항상 본선 이름으로 치환된다(사용자 확인: "큰 노선만
    // 하나만 표기") — 그래서 "경의1선"이 아니라 "경의중앙선"으로 나온다.
    expect(displayNames).toEqual(
      expect.arrayContaining(['1호선', '4호선', '경의중앙선', '공항철도', 'GTX-A', 'KTX-경부-행신착발']),
    )
    expect(displayNames).not.toContain('경의1선')
  })

  it('부산·대전·동대구·서대구도 기존 역과 환승으로 합쳐진다', () => {
    const cases: Array<[string, string]> = [
      ['부산역', '부산 1호선'],
      ['대전역', '대전 1호선'],
      ['동대구역', '대구 1호선'],
      ['서대구역', '대경선'],
    ]
    for (const [name, existingLine] of cases) {
      const groups = searchGrouped(records, name, { limit: 10 })
      const group = groups.find((g) => g.officialStationName === name)
      expect(group, `${name} 그룹을 찾지 못함`).toBeDefined()
      const displayNames = group!.lines.map((l) => l.line.displayName)
      expect(displayNames).toEqual(expect.arrayContaining([existingLine]))
      expect(displayNames.some((n) => n.startsWith('KTX-'))).toBe(true)
    }
  })

  it('KTX "마산"은 김포골드라인 "마산역"과 이름만 같을 뿐 서로 다른 역이다(오탐 방지)', () => {
    const groups = searchGrouped(records, '마산', { limit: 10 })
    const stationIds = new Set(groups.map((g) => g.stationId))
    expect(groups.length).toBeGreaterThanOrEqual(2)
    expect(stationIds.size).toBe(groups.length) // 전부 서로 다른 station_id
  })

  it('KTX "용산"은 서울역과 환승되지만, 대구 2호선 "용산(서부법원.검찰청입구)역"과는 합쳐지지 않는다', () => {
    const groups = searchGrouped(records, '용산', { limit: 10 })
    const seoulYongsan = groups.find(
      (g) => g.officialStationName === '용산역' && g.regionCode === 'SEOUL_METRO',
    )
    expect(seoulYongsan).toBeDefined()
    expect(seoulYongsan!.lines.map((l) => l.line.displayName)).toEqual(
      expect.arrayContaining(['1호선', '경의중앙선', 'KTX-호남-행신착발', 'KTX-전라-행신착발']),
    )
    const daeguYongsan = groups.find((g) => g.regionCode === 'DAEGU' && g.officialStationName.startsWith('용산'))
    expect(daeguYongsan).toBeDefined()
    expect(daeguYongsan!.stationId).not.toBe(seoulYongsan!.stationId)
  })

  it('KTX "부전"은 동해선·부산 1호선 부전역과 모두 합쳐진다(2026-09-16: 실제로 환승 가능하다는 사용자 확인으로 KEEP_SEPARATE→MERGE 정정)', () => {
    // 병합 그룹의 대표 이름(officialStationName)이 이제 부산 1호선 쪽의 긴
    // 표기("부전(부산시민공원.송상현광장)역")로 통일됐다(아산/천안아산과 같은
    // 원칙 — displayStationName은 노선마다 원래 이름 그대로).
    const groups = searchGrouped(records, '부전', { limit: 10 })
    const donghaeBujeon = groups.find((g) => g.lines.some((l) => l.line.displayName === '동해선'))
    expect(donghaeBujeon).toBeDefined()
    // KTX 중앙선·KTX-동해(옛 "동해선 전구간")·부산 1호선·무궁화호까지 전부 같은
    // 부전역으로 합쳐진다.
    expect(donghaeBujeon!.lines.map((l) => l.line.displayName)).toEqual(
      expect.arrayContaining(['동해선', 'KTX-중앙', 'KTX-동해', '부산 1호선']),
    )
    const line1Bujeon = groups.find((g) => g.lines.some((l) => l.line.displayName === '부산 1호선'))
    expect(line1Bujeon!.stationId).toBe(donghaeBujeon!.stationId)
  })

  it('KTX-동해(옛 "동해선 전구간")의 새 구간(영덕/울진/삼척)은 독립된 KTX 전용 역이 된다', () => {
    const results = search(ktxRecords, '영덕', { limit: 10 })
    expect(
      results.some((r) => r.record.officialStationName === '영덕역' && r.record.line.displayName === 'KTX-동해'),
    ).toBe(true)
    for (const name of ['영덕', '울진', '삼척']) {
      const groups = searchGrouped(records, name, { limit: 10 })
      const group = groups.find((g) => g.officialStationName === `${name}역`)
      expect(group, `${name}역을 찾지 못함`).toBeDefined()
      expect(group!.regionCode).toBe('KTX')
      expect(group!.lines).toHaveLength(1) // 다른 지역 역과 우연히 겹치지 않는 완전히 새로운 역이다
    }
  })

  it('KTX-경부-동해-행신착발(포항까지)과 KTX-동해(부전~강릉)는 서로 다른 별개 노선이다', () => {
    const donghaeLineId = ktxRecords.find((r) => r.line.displayName === 'KTX-경부-동해-행신착발')!.line.lineId
    const donghae = listStationsOnLine(records, donghaeLineId)
    const donghaeNames = donghae.map((s) => s.officialStationName)
    expect(donghaeNames.slice(0, 3)).toEqual(['행신역', '서울역', '광명역'])
    expect(donghaeNames[donghaeNames.length - 1]).toBe('포항역')

    const donghaeFullLineId = ktxRecords.find((r) => r.line.displayName === 'KTX-동해')!.line.lineId
    const donghaeFull = listStationsOnLine(records, donghaeFullLineId)
    // 부전은 이제 부산 1호선과도 병합돼 대표 이름(officialStationName)이 그쪽
    // 긴 표기로 바뀌었으므로, 이 노선 자신의 이름(displayStationName)으로 확인한다.
    const donghaeFullNames = donghaeFull.map((s) => s.displayStationName)
    expect(donghaeFullNames[0]).toBe('부전역')
    expect(donghaeFullNames[donghaeFullNames.length - 1]).toBe('강릉역')
  })

  it('KTX-경부-수서착발은 KTX-경부-동해(전구간이 아닌 쪽)와 같은 계통을 가리킨다(SRT의 "동해"는 경부선 경유 포항행)', () => {
    const suseoDonghaeId = records.find((r) => r.line.displayName === 'KTX-경부-동해-수서착발')!.line.lineId
    const names = listStationsOnLine(records, suseoDonghaeId).map((s) => s.officialStationName)
    expect(names[0]).toBe('수서역')
    expect(names[names.length - 1]).toBe('포항역')
  })

  it('KTX-경부-행신착발 역 순서는 원본 "순번" 그대로다(행신→서울→...→부산)', () => {
    const gyeongbuLineId = ktxRecords.find((r) => r.line.displayName === 'KTX-경부-행신착발')!.line.lineId
    const stations = listStationsOnLine(records, gyeongbuLineId)
    const names = stations.map((s) => s.officialStationName)
    expect(names.slice(0, 5)).toEqual(['행신역', '서울역', '영등포역', '광명역', '수원역'])
    expect(names[names.length - 1]).toBe('부산역')
  })
})

describe('실제 데이터: 무궁화호 — group_name(노선 선택) × pattern_name(운행계통 토글), 2026-09-16 raw 전면 재수정 반영', () => {
  // "노선 선택"에는 group_name 13개만 뜬다 — pattern이 여럿인 그룹(충북선/호남선/
  // 동해선/경전선)의 대표가 아닌 나머지 계통은 parentLineId가 있어 여기서 빠진다
  // (사용자 확인: "노선 선택 토글에서는 무궁화-장항선의 이전 KTX와 동일한 방식으로").
  // 2026-09-16 raw 재수정으로 "경부선 서울-제천"이 "충북선 서울-영주"로 통합되며
  // 경부선은 계통이 하나만 남아 평면 노선이 됐고, 옛 "동해선(동대구-포항)"이
  // "대구선"이라는 새 그룹으로 분리됐다.
  it('노선 선택에는 group_name 13개(무궁화-*)만 나온다', () => {
    const lines = deriveSelectableLines(mugunghwaRecords)
    expect(lines.map((l) => l.displayName).sort()).toEqual(
      [
        '무궁화-경부선',
        '무궁화-경북선',
        '무궁화-경전선',
        '무궁화-교외선',
        '무궁화-대구선',
        '무궁화-동해선',
        '무궁화-영동선',
        '무궁화-장항선',
        '무궁화-전라선',
        '무궁화-중앙선',
        '무궁화-충북선',
        '무궁화-태백선',
        '무궁화-호남선',
      ].sort(),
    )
    // 참고 사이트(metrotyping.kr)의 아이콘 배지를 그대로 따라 아이콘 글자는
    // 전부 "무궁화"다(사용자 확인: "아이콘도 저 사진대로 진행해줘").
    expect(lines.every((l) => l.iconLabel === '무궁화')).toBe(true)
  })

  it('단일 계통 그룹(경부선·대구선 등)은 KTX와 같은 평면 노선이다 — 노선 선택 버튼은 "무궁화-OO선", 토글박스 이름(stationListLabel)은 "OO선"만 쓴다', () => {
    // 2026-09-15: "단일 노선 시 토글 박스에서도 '00선'만 보이게" — 접두어를 뗐다가
    // "전체 범위에서 헷갈린다"는 확인으로 버튼 이름은 되돌렸고(확장 33), 토글박스만
    // stationListLabel로 "OO선"을 유지한다.
    for (const name of ['장항선', '경부선', '대구선']) {
      const line = deriveSelectableLines(mugunghwaRecords).find((l) => l.displayName === `무궁화-${name}`)!
      expect(line.stationListLabel, `무궁화-${name}의 토글박스 이름`).toBe(name)
      expect(deriveChildLines(mugunghwaRecords, line.lineId)).toHaveLength(0)
      expect(listStationsOnLine(mugunghwaRecords, line.lineId).length).toBeGreaterThan(0)
    }
  })

  it('충북선 그룹: 대표(동대구-영주)와 자식(서울-영주)의 토글 이름은 그룹명 없이 "(구간)"만 쓴다', () => {
    // 사용자 확인: "지선 처리가 되어있는 무궁화호 노선일 경우, 토글박스의
    // 아이콘 명은 경유하는 역만 작성 — 무궁화-충북선일 경우 두개의 토글박의
    // 아이콘은 (서울-영주) / (동대구-영주) 이렇게 구성".
    const carrier = deriveSelectableLines(mugunghwaRecords).find((l) => l.displayName === '무궁화-충북선')!
    expect(carrier.stationListLabel).toBe('동대구-영주')
    const children = deriveChildLines(mugunghwaRecords, carrier.lineId)
    expect(children.map((l) => l.displayName)).toEqual(['서울-영주'])

    // pattern-stops 파일 순서 그대로 반영 — 서로 다른 계통이라 중복 제거하지
    // 않는다(사용자 확인: "중복에 대해서는 신경쓰지 말고 pattern-stops 파일의
    // 순서대로 토글에 반영해줘"). 둘 다 영주에서 끝나지만 역 수는 다르다.
    const carrierStations = listStationsOnLine(mugunghwaRecords, carrier.lineId)
    const childStations = listStationsOnLine(mugunghwaRecords, children[0].lineId)
    expect(carrierStations.map((s) => s.displayStationName).at(-1)).toBe('영주역')
    expect(childStations.map((s) => s.displayStationName).at(-1)).toBe('영주역')
    expect(carrierStations.length).not.toBe(childStations.length)
  })

  it('대표-자식이 겹치는 역(오송)에는 "↳ 갈림" 분기 표시도, 서로 환승 배지도 붙지 않는다', () => {
    const carrier = deriveSelectableLines(mugunghwaRecords).find((l) => l.displayName === '무궁화-충북선')!
    const child = deriveChildLines(mugunghwaRecords, carrier.lineId)[0]
    const stationOnCarrier = listStationsOnLine(mugunghwaRecords, carrier.lineId).find(
      (s) => s.displayStationName === '오송역',
    )!
    const stationOnChild = listStationsOnLine(mugunghwaRecords, child.lineId).find(
      (s) => s.displayStationName === '오송역',
    )!
    expect(stationOnCarrier, '대표 계통에 오송역 없음').toBeDefined()
    expect(stationOnChild, '자식 계통에 오송역 없음').toBeDefined()
    expect(stationOnCarrier.branchLines).toHaveLength(0)
    expect(stationOnCarrier.transferLines.some((l) => l.displayName === child.displayName)).toBe(false)
    expect(stationOnChild.branchLines).toHaveLength(0)
    expect(stationOnChild.transferLines.some((l) => l.displayName === carrier.displayName)).toBe(false)
  })

  it('검색하면 겹치는 역이라도 그룹 배지 하나만 뜬다(운행계통은 환승으로 표기하지 않음)', () => {
    const grouped = searchGrouped(mugunghwaRecords, '오송', { limit: 20 })
    const osongGroup = grouped.find((g) => g.displayStationName === '오송역')!
    expect(osongGroup.lines.map((l) => l.line.displayName)).toEqual(['무궁화-충북선'])
  })

  it('3계통 그룹(호남선)에서는 대표가 아닌 두 자식(형제)끼리도 서로 환승 배지를 보여주지 않는다', () => {
    const carrier = deriveSelectableLines(mugunghwaRecords).find((l) => l.displayName === '무궁화-호남선')!
    const [child1, child2] = deriveChildLines(mugunghwaRecords, carrier.lineId)
    expect([child1.displayName, child2.displayName]).toEqual(['용산-목포', '광주-목포'])

    const child1Stations = listStationsOnLine(mugunghwaRecords, child1.lineId)
    const child2Names = new Set(listStationsOnLine(mugunghwaRecords, child2.lineId).map((s) => s.displayStationName))
    const sharedStation = child1Stations.find((s) => child2Names.has(s.displayStationName))!
    expect(sharedStation, '두 계통이 겹치는 역을 찾지 못함').toBeDefined()
    expect(sharedStation.transferLines.some((l) => l.displayName === child2.displayName)).toBe(false)
    expect(sharedStation.transferLines.some((l) => l.displayName === carrier.displayName)).toBe(false)
    expect(sharedStation.branchLines).toHaveLength(0)
  })

  it('동해선 그룹은 이제 계통이 둘뿐이다(대구선이 별도 그룹으로 분리됨)', () => {
    const carrier = deriveSelectableLines(mugunghwaRecords).find((l) => l.displayName === '무궁화-동해선')!
    expect(carrier.stationListLabel).toBe('동대구-부전')
    const children = deriveChildLines(mugunghwaRecords, carrier.lineId)
    expect(children.map((l) => l.displayName)).toEqual(['부전~포항'])

    const daeguseon = deriveSelectableLines(mugunghwaRecords).find((l) => l.displayName === '무궁화-대구선')!
    expect(daeguseon.stationListLabel).toBe('대구선')
    expect(deriveChildLines(mugunghwaRecords, daeguseon.lineId)).toHaveLength(0)
    const daeguseonStations = listStationsOnLine(mugunghwaRecords, daeguseon.lineId).map((s) => s.displayStationName)
    expect(daeguseonStations[0]).toBe('동대구역')
    expect(daeguseonStations.at(-1)).toBe('포항역')
  })

  it('무궁화호 노선(line.regionCode)은 항상 전용 pseudo-region이다 — 확실한 환승만 station-resolution.csv로 명시 확인했다', () => {
    // line.regionCode 자체는 KTX/SRT와 같은 "KTX"가 아니라 항상 "MUGUNGHWA"다
    // (사용자 확인: "무궁화호 내 제외 타 지역별 환승역에 대해서 확실하지 않은
    // 부분은 환승역이라고 우선 표기하지 말고" — region을 분리해 애매한 환승은
    // 자동으로 만들지 않는다). 확실한 역(예: 서울역·부산역처럼 실제로 KTX와
    // 같은 역사를 공용하는 역)만 station-resolution.csv에 MERGE로 직접
    // 명시했다 — 그런 역은 station 레벨에서 실제로 KTX 등 다른 지역과 병합된다.
    expect(mugunghwaRecords.every((r) => r.line.regionCode === 'MUGUNGHWA')).toBe(true)

    // 확실한 환승으로 명시한 서울역은 실제로 KTX 쪽과 같은 station_id를 공유한다.
    const mgSeoul = mugunghwaRecords.find((r) => r.displayStationName === '서울역')!
    const ktxSeoul = records.find((r) => r.line.displayName === 'KTX-경부-행신착발' && r.displayStationName === '서울역')!
    expect(mgSeoul.stationId).toBe(ktxSeoul.stationId)

    // 이름만 같을 뿐 실제로는 다른 지역인 역(무궁화 상동역 vs 7호선 상동역)은
    // KEEP_SEPARATE로 명시해 여전히 서로 다른 station_id로 분리돼 있다.
    const mgSangdong = mugunghwaRecords.find((r) => r.displayStationName === '상동역')!
    const line7Sangdong = records.find((r) => r.line.displayName === '7호선' && r.displayStationName === '상동역')!
    expect(mgSangdong.stationId).not.toBe(line7Sangdong.stationId)

    // 김천: 표기가 다른 채로 병합했던 이전 판단(2026-09-15)을 사용자가
    // "김천(구미)역과 무궁화호 김천역은 다른 역"이라고 정정해(2026-09-16),
    // 이제 서로 다른 station_id로 분리돼 있다.
    const mgGimcheon = mugunghwaRecords.find((r) => r.displayStationName === '김천역')!
    const ktxGimcheon = records.find(
      (r) => r.line.trainServiceCode === 'KTX' && r.displayStationName === '김천(구미)역',
    )!
    expect(mgGimcheon.stationId).not.toBe(ktxGimcheon.stationId)
  })
})

describe('실제 데이터: 무궁화호 ↔ 타 지역 환승역 정리 (station-resolution.csv, 2026-09-15)', () => {
  // 확장 25 직후 "무궁화호 내 제외 타 지역별 환승역에 대해서 확실하지 않은
  // 부분은 환승역이라고 우선 표기하지 말고"에 따라 비워 뒀던 부분을, 이번엔
  // 반대로 "확실한 역"을 station-resolution.csv에 하나씩 직접 확인해 MERGE로
  // 채워 넣었다(76건) — 이름만 같을 뿐 실제로는 다른 지역인 5건은 KEEP_SEPARATE
  // 로 명시했다. 여기서는 대표적인 유형별로 실제 병합/분리 결과를 확인한다.
  // officialStationName은 병합 그룹의 대표 이름으로 공유되므로(예: 김천 그룹은
  // "김천(구미)역"으로 통일됨) 노선별로 다른 원래 이름을 찾을 땐 displayStationName
  // (station_line 쪽, 노선마다 원래 이름 그대로)을 써야 한다.
  function stationIdOf(displayName: string, displayStationName: string): string {
    const found = records.find((r) => r.line.displayName === displayName && r.displayStationName === displayStationName)
    if (!found) throw new Error(`${displayName}에 ${displayStationName} 없음`)
    return found.stationId
  }

  it('KTX와 같은 물리적 역사를 공용하는 무궁화호 주요 역은 실제로 병합된다(경부선·호남선·전라선·영동선·경전선·대구선 각 1건)', () => {
    const cases: Array<[string, string]> = [
      ['무궁화-충북선', '대전역'],
      ['용산-목포', '목포역'],
      ['무궁화-전라선', '여수엑스포역'],
      ['무궁화-영동선', '안동역'],
      ['무궁화-경전선', '진주역'],
      ['무궁화-대구선', '포항역'],
    ]
    for (const [mgLine, name] of cases) {
      const mgId = stationIdOf(mgLine, name)
      const ktx = records.find((r) => r.line.trainServiceCode === 'KTX' && r.displayStationName === name)
      expect(ktx, `KTX에 ${name} 없음`).toBeDefined()
      expect(mgId).toBe(ktx!.stationId)
    }
  })

  it('도시철도·광역전철과 같은 물리적 역사를 공용하는 역도 병합된다(대구·부산·수도권전철 각 1건)', () => {
    expect(stationIdOf('무궁화-충북선', '대구역')).toBe(stationIdOf('대구 1호선', '대구역'))
    expect(stationIdOf('무궁화-경부선', '화명역')).toBe(
      records.find((r) => r.displayStationName === '화명역' && r.regionCode === 'BUSAN')!.stationId,
    )
    expect(stationIdOf('무궁화-중앙선', '청량리역')).toBe(stationIdOf('1호선', '청량리(서울시립대입구)역'))
  })

  it('김천역과 김천(구미)역은 이름이 비슷해도 다른 역이다(2026-09-15 아산/천안아산식 병합 → 2026-09-16 사용자 확인으로 정정)', () => {
    const mgGimcheon = records.find(
      (r) => r.line.regionCode === 'MUGUNGHWA' && r.displayStationName === '김천역',
    )!
    const ktxGimcheon = records.find(
      (r) => r.line.trainServiceCode === 'KTX' && r.displayStationName === '김천(구미)역',
    )!
    expect(mgGimcheon.stationId).not.toBe(ktxGimcheon.stationId)
  })

  it('이름만 같을 뿐 실제로는 다른 지역인 역은 병합하지 않는다(상동·연산·판교·신기·양원·김천)', () => {
    const pairs: Array<[string, string, string, string]> = [
      ['무궁화-경부선', '상동역', '7호선', '상동역'],
      ['무궁화-전라선', '연산역', '부산 1호선', '연산역'],
      ['무궁화-장항선', '판교역', '신분당선', '판교(판교테크노밸리)역'],
      ['무궁화-태백선', '신기역', '대구 1호선', '신기역'],
      ['무궁화-영동선', '양원역', '경의중앙선', '양원(서울시북부병원)역'],
      ['무궁화-충북선', '김천역', 'KTX-경부-행신착발', '김천(구미)역'],
    ]
    for (const [mgLine, mgName, otherLine, otherName] of pairs) {
      const mgId = stationIdOf(mgLine, mgName)
      const other = records.find((r) => r.line.displayName === otherLine && r.displayStationName === otherName)
      expect(other, `${otherLine}에 ${otherName} 없음`).toBeDefined()
      expect(mgId).not.toBe(other!.stationId)
    }
  })

  it('검색에서도 실제 병합된 역은 배지로 합쳐 나온다(대전역: 무궁화 계통·대전 1호선·행신착발·수서착발)', () => {
    const grouped = searchGrouped(records, '대전역', { limit: 20 })
    const daejeon = grouped.find((g) => g.displayStationName === '대전역')!
    const badgeNames = daejeon.lines.map((l) => l.line.displayName)
    // 대전은 무궁화호 두 계통(충북선의 직행, 경부선(서울-부산)의 경유)에 모두
    // 걸리는데, 후자는 자식 노선이라 대표("무궁화-경부선")로 치환되어 나온다.
    expect(badgeNames).toContain('무궁화-충북선')
    expect(badgeNames).toContain('무궁화-경부선')
    expect(badgeNames).toContain('대전 1호선')
    expect(badgeNames.some((n) => n.startsWith('KTX') && n.endsWith('행신착발'))).toBe(true)
    expect(badgeNames.some((n) => n.startsWith('KTX') && n.endsWith('수서착발'))).toBe(true)
  })
})

describe('실제 데이터: 아산(1호선) ↔ 천안아산(KTX/SRT) — 병합은 하되 역명은 동기화하지 않음', () => {
  it('같은 station_id로 병합되어 환승 정보를 공유한다', () => {
    // 무궁화호(경부선 계통, 확장 25)의 "아산"도 station-resolution.csv에 명시적
    // MERGE로 확인해 같은 그룹에 속한다(확장 25 직후 환승역 정리 작업, 2026-09-15)
    // — 무궁화호는 KTX/SRT와 달리 "천안아산"이 아니라 1호선과 같은 "아산"으로
    // 표기해서 displayStationName은 "아산역" 쪽에 합류한다. 여기서는 원래
    // 있던 1호선/KTX/SRT 사이의 병합만 확인하고, 무궁화호 쪽은 아래에서 따로
    // 확인한다.
    const asan = records.filter((r) => r.displayStationName === '아산역' && r.line.regionCode !== 'MUGUNGHWA')
    const cheonanAsan = records.filter((r) => r.displayStationName === '천안아산역')
    expect(asan).toHaveLength(1)
    expect(cheonanAsan.length).toBeGreaterThan(0) // KTX 5개 + SRT 5개 노선
    expect(new Set([...asan, ...cheonanAsan].map((r) => r.stationId)).size).toBe(1)

    const mgAsan = records.find((r) => r.line.regionCode === 'MUGUNGHWA' && r.displayStationName === '아산역')!
    expect(mgAsan.stationId).toBe(asan[0].stationId)
  })

  it('병합돼도 각 노선은 자기 원래 이름을 유지한다(officialStationName은 공유, displayStationName은 노선마다 다름)', () => {
    // 아산은 실제로는 1호선 본선이 아니라 그 지선인 경부/장항선 소속이다(확장 24) —
    // 다른 곳(예: KTX 목록)에서 볼 때는 resolveDisplayLine()이 "1호선"으로 치환해
    // 보여주지만, 아산 자신의 line은 그대로 "경부/장항선"이다.
    const asan = records.find((r) => r.line.displayName === '경부/장항선' && r.displayStationName === '아산역')!
    const ktxGyeongbu = records.find((r) => r.line.displayName === 'KTX-경부-행신착발' && r.stationId === asan.stationId)!
    // 같은 병합 그룹이라 officialStationName(대표 이름)은 공유하지만,
    expect(ktxGyeongbu.officialStationName).toBe(asan.officialStationName)
    // 화면 표시용 이름(displayStationName)은 노선마다 원래 이름 그대로다.
    expect(asan.displayStationName).toBe('아산역')
    expect(ktxGyeongbu.displayStationName).toBe('천안아산역')
  })

  it('"아산"으로 검색하면 "아산"이, "천안아산"으로 검색하면 "천안아산"이 그룹 이름으로 나온다', () => {
    const byAsan = searchGrouped(records, '아산', { limit: 50 })
    const asanGroup = byAsan.find((g) => g.lines.some((l) => l.line.displayName === '1호선'))
    expect(asanGroup?.displayStationName).toBe('아산역')

    const byCheonanAsan = searchGrouped(records, '천안아산', { limit: 50 })
    const cheonanAsanGroup = byCheonanAsan.find((g) => g.lines.some((l) => l.line.displayName === 'KTX-경부-행신착발'))
    expect(cheonanAsanGroup?.displayStationName).toBe('천안아산역')
    // 같은 병합 그룹이므로(환승) 1호선 배지도 함께 나온다.
    expect(cheonanAsanGroup?.lines.some((l) => l.line.displayName === '1호선')).toBe(true)
  })

  it('"이 노선의 역 보기"에서도 (아산이 실제로 속한) 경부/장항선 목록엔 "아산", KTX 목록엔 "천안아산"이 각각 나온다', () => {
    const gyeongbuJanghangId = records.find((r) => r.line.displayName === '경부/장항선')!.line.lineId
    const gyeongbuJanghangStations = listStationsOnLine(records, gyeongbuJanghangId)
    const asanEntry = gyeongbuJanghangStations.find((s) => s.displayStationName === '아산역')
    expect(asanEntry).toBeDefined()
    expect(asanEntry!.transferLines.some((l) => l.displayName === 'KTX-경부-행신착발')).toBe(true)

    const ktxGyeongbuId = records.find((r) => r.line.displayName === 'KTX-경부-행신착발')!.line.lineId
    const ktxStations = listStationsOnLine(records, ktxGyeongbuId)
    const cheonanAsanEntry = ktxStations.find((s) => s.stationId === asanEntry!.stationId)
    expect(cheonanAsanEntry?.displayStationName).toBe('천안아산역')
    expect(cheonanAsanEntry!.transferLines.some((l) => l.displayName === '1호선')).toBe(true)
  })
})

describe('실제 데이터: 부역명 검색 (화면에 부역명을 남기기로 한 역만)', () => {
  it('김천(구미)은 "구미"만으로도 검색된다', () => {
    const results = search(records, '구미', { limit: 50 })
    expect(results.some((r) => r.record.officialStationName === '김천(구미)역')).toBe(true)
  })

  it('울산(통도사)은 "통도사"만으로도 검색된다', () => {
    const results = search(records, '통도사', { limit: 50 })
    expect(results.some((r) => r.record.officialStationName === '울산(통도사)역')).toBe(true)
  })

  it('부역명을 화면에서 떼는 일반 역은 여전히 부역명만으로는 검색되지 않는다(예: 봉황(김해여객터미널))', () => {
    const results = search(records, '김해여객터미널', { limit: 50 })
    expect(results.some((r) => r.record.officialStationName.startsWith('봉황'))).toBe(false)
  })
})

describe('실제 데이터: 서울과 부산의 같은 번호 노선은 서로 섞이지 않는다', () => {
  it('서울 3호선과 부산 3호선은 서로 다른 line_id를 갖는다', () => {
    const seoulLine3 = seoulRecords.find((r) => r.line.lineNumber === 3)!.line
    const busanLine3 = busanRecords.find((r) => r.line.lineNumber === 3)!.line
    expect(seoulLine3.lineId).not.toBe(busanLine3.lineId)
    expect(seoulLine3.regionCode).toBe('SEOUL_METRO')
    expect(busanLine3.regionCode).toBe('BUSAN')
  })

  it('부산 범위로 좁혀서 "3"을 검색하면 부산 3호선만 나온다', () => {
    const results = search(busanRecords, '3', { limit: 100 })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => r.record.line.lineNumber === 3 && r.record.regionCode === 'BUSAN')).toBe(true)
  })
})

describe('실제 데이터: 운행 범위', () => {
  it('scope_option 에 5개 지역 + KTX/ITX/무궁화호가 모두 AVAILABLE 이다(2026-09-16 2차: SRT는 KTX로 통합돼 별도 버튼이 없다, 2026-09-19: ITX-새마을 추가로 ITX도 열림)', () => {
    const scopes = loadScopeOptions(db)
    const regionCodes = ['SEOUL_METRO', 'BUSAN', 'DAEGU', 'GWANGJU', 'DAEJEON']
    for (const code of regionCodes) {
      expect(scopes.find((s) => s.scope_code === code)?.status).toBe('AVAILABLE')
    }
    expect(scopes.find((s) => s.scope_code === 'SRT')).toBeUndefined()
    for (const code of ['KTX', 'ITX', 'MUGUNGHWA']) {
      expect(scopes.find((s) => s.scope_code === code)?.status).toBe('AVAILABLE')
      expect(scopes.find((s) => s.scope_code === code)?.kind).toBe('TRAIN_SERVICE')
    }
    // COMING_SOON으로 남은 열차 종류는 이제 없다.
    expect(scopes.some((s) => s.status === 'COMING_SOON')).toBe(false)
  })

  it('모든 station_line 레코드는 5개 지역 또는 KTX·무궁화호(line.regionCode 기준) 중 하나에 속한다', () => {
    const knownRegions = new Set(['SEOUL_METRO', 'BUSAN', 'DAEGU', 'GWANGJU', 'DAEJEON', 'KTX', 'MUGUNGHWA'])
    expect(records.every((r) => knownRegions.has(r.line.regionCode))).toBe(true)
    expect(seoulRecords.length).toBeGreaterThan(0)
    expect(busanRecords.length).toBeGreaterThan(0)
    expect(ktxRecords.length).toBeGreaterThan(0)
  })
})

describe('실제 데이터: 노선 필터', () => {
  it('lineId 를 지정하면 다른 노선에 있는 동명역은 걸러진다', () => {
    // 오금은 3호선과 마천지선(5호선의 지선, 2026-09-14부터) 두 곳에 있다.
    const line3 = seoulRecords.find((r) => r.line.lineNumber === 3)!.line
    const macheonLine = seoulRecords.find((r) => r.line.displayName === '마천지선')!.line

    const onLine3 = search(seoulRecords, '오금', { lineId: line3.lineId })
    expect(onLine3).toHaveLength(1)
    expect(onLine3[0].record.line.lineId).toBe(line3.lineId)

    const onMacheon = search(seoulRecords, '오금', { lineId: macheonLine.lineId })
    expect(onMacheon).toHaveLength(1)
    expect(onMacheon[0].record.line.lineId).toBe(macheonLine.lineId)
  })

  it('무악재는 3호선에만 있으므로 다른 노선으로 필터링하면 결과가 없다', () => {
    const otherLine = seoulRecords.find((r) => r.line.lineNumber === 5)!.line
    const results = search(seoulRecords, '무악재', { lineId: otherLine.lineId })
    expect(results).toHaveLength(0)
  })
})

describe('실제 데이터: 노선 번호 토큰의 지역 모호성(사용자 확인: "1만 입력해도 인천, 부산, 대구, 광주 다 뜨기 때문에")', () => {
  it('"서울·수도권" 범위(seoulRecords)에서 "1"만 입력하면 순수 "1호선"만 나오고 인천 1호선은 안 나온다', () => {
    const results = search(seoulRecords, '1', { limit: 200 })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => r.record.line.displayName === '1호선')).toBe(true)
  })

  it('"인1"으로는 인천 1호선만 나온다', () => {
    const results = search(seoulRecords, '인1', { limit: 200 })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => r.record.line.displayName === '인천 1호선')).toBe(true)
  })

  it('"인2"로는 인천 2호선만 나온다', () => {
    const results = search(seoulRecords, '인2', { limit: 200 })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => r.record.line.displayName === '인천 2호선')).toBe(true)
  })

  it('전체(records) 범위에서 "1"만 입력해도 수도권 1호선만 나오고 부산·대구·광주·대전·인천 1호선은 섞이지 않는다', () => {
    const results = search(records, '1', { limit: 500 })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => r.record.line.displayName === '1호선')).toBe(true)
  })

  it('전체(records) 범위에서도 지역 전용 키워드로는 각 지역 1호선을 정확히 찾을 수 있다(부1·대구1·광1·대전1)', () => {
    expect(
      search(records, '부1', { limit: 200 }).every((r) => r.record.line.displayName === '부산 1호선'),
    ).toBe(true)
    expect(search(records, '부1', { limit: 200 }).length).toBeGreaterThan(0)

    expect(
      search(records, '대구1', { limit: 200 }).every((r) => r.record.line.displayName === '대구 1호선'),
    ).toBe(true)
    expect(search(records, '대구1', { limit: 200 }).length).toBeGreaterThan(0)

    expect(
      search(records, '광1', { limit: 200 }).every((r) => r.record.line.displayName === '광주 1호선'),
    ).toBe(true)
    expect(search(records, '광1', { limit: 200 }).length).toBeGreaterThan(0)

    expect(
      search(records, '대전1', { limit: 200 }).every((r) => r.record.line.displayName === '대전 1호선'),
    ).toBe(true)
    expect(search(records, '대전1', { limit: 200 }).length).toBeGreaterThan(0)
  })

  it('대구1호선과 대전1호선은 서로 다른 키워드("대구1"/"대전1")라 섞이지 않는다(사용자 확인: 대구·대전은 줄임말 대신 풀 네임)', () => {
    const daeguResults = search(records, '대구1', { limit: 200 })
    const daejeonResults = search(records, '대전1', { limit: 200 })
    expect(daeguResults.every((r) => r.record.regionCode === 'DAEGU')).toBe(true)
    expect(daejeonResults.every((r) => r.record.regionCode === 'DAEJEON')).toBe(true)
  })

  it('부산·대구·광주 범위로 이미 좁혀졌으면(그 번호를 가진 노선이 후보군에 하나뿐이면) 접두어 없는 숫자만으로도 찾아진다(사용자 확인: "운행 범위를 부산으로 지정 시, 1만 적어도 부산 1호선이 검색되어야 한다")', () => {
    const busanResults = search(busanRecords, '1', { limit: 200 })
    expect(busanResults.length).toBeGreaterThan(0)
    expect(busanResults.every((r) => r.record.line.displayName === '부산 1호선')).toBe(true)

    const daeguResults = search(daeguRecords, '1', { limit: 200 })
    expect(daeguResults.length).toBeGreaterThan(0)
    expect(daeguResults.every((r) => r.record.line.displayName === '대구 1호선')).toBe(true)

    const gwangjuResults = search(gwangjuRecords, '1', { limit: 200 })
    expect(gwangjuResults.length).toBeGreaterThan(0)
    expect(gwangjuResults.every((r) => r.record.line.displayName === '광주 1호선')).toBe(true)
  })

  it('부산-김해경전철은 "BGL"(소문자 포함)로도 찾을 수 있다', () => {
    const upper = search(records, 'BGL', { limit: 50 })
    const lower = search(records, 'bgl', { limit: 50 })
    expect(upper.length).toBeGreaterThan(0)
    expect(upper.every((r) => r.record.line.displayName === '부산김해경전철')).toBe(true)
    expect(lower.map((r) => r.record.officialStationName)).toEqual(upper.map((r) => r.record.officialStationName))
  })

  it('GTX-A는 "GTX-A"(소문자 포함)로 찾을 수 있다', () => {
    const upper = search(records, 'GTX-A', { limit: 50 })
    const lower = search(records, 'gtx-a', { limit: 50 })
    expect(upper.length).toBeGreaterThan(0)
    expect(upper.every((r) => r.record.line.displayName === 'GTX-A')).toBe(true)
    expect(lower.map((r) => r.record.officialStationName)).toEqual(upper.map((r) => r.record.officialStationName))
  })
})

describe('실제 데이터: 지선 소속 역은 지선 자신의 이름이 아니라 본선명으로만 키워드 검색된다(사용자 확인: "필터링 되는 노선 명 키워드는 본선명 즉 parents 명만... 마천지선 또는 경의1선과 같은걸로는 필터링 되지 않게")', () => {
  it('"망우선"으로는 망우선(지선) 자신이 노선 키워드로 걸리지 않는다(본선명 "경춘"으로는 나온다)', () => {
    const byBranchKeyword = search(seoulRecords, '망우선', { limit: 50 })
    expect(byBranchKeyword.every((r) => r.record.line.displayName !== '망우선')).toBe(true)
    const byMainName = search(seoulRecords, '경춘', { limit: 50 })
    expect(byMainName.some((r) => r.record.officialStationName === '광운대역')).toBe(true)
  })

  it('"마천지선"으로는 아무 것도 안 나온다(지선 자신의 이름은 키워드로 안 먹힌다)', () => {
    expect(search(seoulRecords, '마천지선', { limit: 50 })).toHaveLength(0)
  })

  it('"경의1선"으로는 아무 것도 안 나온다(본선명 "경의"로는 나온다)', () => {
    expect(search(seoulRecords, '경의1선', { limit: 50 })).toHaveLength(0)
    const byMainName = search(seoulRecords, '경의', { limit: 50 })
    expect(byMainName.some((r) => r.record.officialStationName === '서울역')).toBe(true)
  })
})

describe('실제 데이터: ITX-새마을 (mugunghwa-ITXsaemaul/itx_saemaul_*.csv, 무궁화호 역 마스터 재사용, 2026-09-19)', () => {
  // ITX-새마을은 무궁화호와 같은 재래선 역들을 쓰기 때문에 역 마스터를 그대로
  // 재사용한다(사용자 확인). 같은 pseudo-region("MUGUNGHWA")에 line.trainServiceCode
  // 만 "ITX"로 달리해 "운행 범위 선택"에서 별도 버튼(ITX)으로 나뉜다.
  const itx = () => records.filter((r) => r.line.lineCode.startsWith('ITX-SAEMAUL'))

  it('노선 선택에는 경부·경전·호남·전라 4개만 나온다 — 호남선의 두 번째 계통(용산-광주)은 자식이라 빠진다', () => {
    const lines = deriveSelectableLines(itx())
    expect(lines.map((l) => l.displayName)).toEqual([
      'ITX-새마을-경부',
      'ITX-새마을-경전',
      'ITX-새마을-호남',
      'ITX-새마을-전라',
    ])
    expect(lines.every((l) => l.iconLabel === '새마을')).toBe(true)
    // 색은 사용자가 준 참고 이미지(Railmap 전국 일반여객철도 노선도)에서 옮겼다.
    expect(lines.map((l) => l.colorHex)).toEqual(['#1361A4', '#009BCD', '#F09F7F', '#91659F'])
  })

  it('호남선은 대표(용산-목포)+자식(용산-광주) 토글이다 — 토글 이름은 구간만, 역 목록은 pattern_stops 순서 그대로', () => {
    const carrier = deriveSelectableLines(itx()).find((l) => l.displayName === 'ITX-새마을-호남')!
    expect(carrier.stationListLabel).toBe('용산-목포')
    const children = deriveChildLines(itx(), carrier.lineId)
    expect(children.map((l) => l.displayName)).toEqual(['용산-광주'])
    expect(children[0].colorHex).toBe('#D37D6F')

    const carrierStations = listStationsOnLine(itx(), carrier.lineId).map((s) => s.displayStationName)
    const childStations = listStationsOnLine(itx(), children[0].lineId).map((s) => s.displayStationName)
    expect(carrierStations).toHaveLength(27)
    expect(carrierStations[0]).toBe('용산역')
    expect(carrierStations.at(-1)).toBe('목포역')
    expect(childStations).toHaveLength(22)
    expect(childStations.at(-1)).toBe('광주역')
  })

  it('경부·경전·전라 노선의 역 순서는 원본 그대로다(서울/용산 출발)', () => {
    const byName = (name: string) => deriveSelectableLines(itx()).find((l) => l.displayName === name)!
    const names = (name: string) => listStationsOnLine(itx(), byName(name).lineId).map((s) => s.displayStationName)
    const gyeongbu = names('ITX-새마을-경부')
    expect(gyeongbu).toHaveLength(31)
    expect(gyeongbu.slice(0, 3)).toEqual(['서울역', '영등포역', '안양역'])
    expect(gyeongbu.at(-1)).toBe('부산역')
    const gyeongjeon = names('ITX-새마을-경전')
    expect(gyeongjeon).toHaveLength(20)
    expect(gyeongjeon.at(-1)).toBe('진주역')
    const jeolla = names('ITX-새마을-전라')
    expect(jeolla).toHaveLength(23)
    expect(jeolla[0]).toBe('용산역')
    expect(jeolla.at(-1)).toBe('여수엑스포역')
  })

  it('ITX 역은 전부 무궁화호와 같은 station으로 합쳐진다(역 마스터 재사용) — 무궁화호 노선 선택은 그대로 13개다', () => {
    const mgStationIds = new Set(mugunghwaRecords.map((r) => r.stationId))
    expect(itx().length).toBeGreaterThan(0)
    expect(itx().every((r) => mgStationIds.has(r.stationId))).toBe(true)
    expect(deriveSelectableLines(mugunghwaRecords)).toHaveLength(13)
    expect(mugunghwaRecords.some((r) => r.line.displayName.startsWith('ITX'))).toBe(false)
  })

  it('서울역 검색 결과에 ITX-새마을·무궁화호·KTX 배지가 함께 붙는다(무궁화호와 이름이 겹치지 않는다)', () => {
    const grouped = searchGrouped(records, '서울', { limit: 5 })
    const seoul = grouped.find((g) => g.displayStationName === '서울역')!
    const badgeNames = seoul.lines.map((l) => l.line.displayName)
    expect(badgeNames).toEqual(expect.arrayContaining(['ITX-새마을-경부', 'ITX-새마을-경전', '무궁화-경부선', 'KTX-경부-행신착발']))
    expect(new Set(badgeNames).size).toBe(badgeNames.length)
  })

  it('scope_option의 ITX는 AVAILABLE이고 train_service_code="ITX"로 걸러낸다(region_code는 비어 있다 — 새마을·청춘이 서로 다른 region을 쓴다)', () => {
    const scope = loadScopeOptions(db).find((s) => s.scope_code === 'ITX')!
    expect(scope.status).toBe('AVAILABLE')
    expect(scope.kind).toBe('TRAIN_SERVICE')
    expect(scope.train_service_code).toBe('ITX')
    expect(scope.region_code).toBeNull()
  })

  it('ITX 범위 노선 선택은 ITX-청춘이 맨 앞이고 새마을 4개가 뒤따른다(게임 화면 순서)', () => {
    const all = records.filter((r) => r.line.trainServiceCode === 'ITX')
    expect(deriveSelectableLines(all).map((l) => l.displayName)).toEqual([
      'ITX-청춘',
      'ITX-새마을-경부',
      'ITX-새마을-경전',
      'ITX-새마을-호남',
      'ITX-새마을-전라',
    ])
  })
})

describe('실제 데이터: ITX-청춘 (itx_cheongchun/*.csv, 수도권 경춘선과 선로·역 공용, 2026-09-19)', () => {
  const cheongchun = () => records.filter((r) => r.line.lineCode === 'ITX-CHEONGCHUN')

  it('용산→춘천 15개 역이 pattern_stops 순서 그대로 나오고, 서울·수도권 범위 노선 선택에는 뜨지 않는다', () => {
    const line = cheongchun()[0].line
    const names = listStationsOnLine(records, line.lineId).map((s) => s.displayStationName)
    expect(names).toHaveLength(15)
    expect(names.slice(0, 5)).toEqual(['용산역', '옥수역', '왕십리역', '청량리역', '상봉역'])
    expect(names.at(-1)).toBe('춘천역')
    expect(line.iconLabel).toBe('청춘')
    expect(line.trainServiceCode).toBe('ITX')
    expect(deriveSelectableLines(seoulRecords).some((l) => l.displayName === 'ITX-청춘')).toBe(false)
  })

  it('경춘선과 같은 역은 같은 station으로 합쳐져 서로 환승 배지가 붙는다 — 용산·청량리는 1호선 등과도 이어진다', () => {
    const stationIdsOn = (lineCode: string) => new Set(records.filter((r) => r.line.lineCode === lineCode).map((r) => r.stationId))
    const gyeongchun = stationIdsOn('KR-GYEONGCHUN')
    const shared = cheongchun().filter((r) => gyeongchun.has(r.stationId)).map((r) => r.displayStationName)
    expect(shared).toEqual(
      expect.arrayContaining(['청량리역', '상봉역', '퇴계원역', '사릉역', '평내호평역', '마석역', '청평역', '가평역', '백양리역', '강촌역', '남춘천역', '춘천역']),
    )

    const cheongryangri = searchGrouped(records, '청량리', { limit: 5 }).find((g) => g.displayStationName === '청량리역')!
    expect(cheongryangri.lines.map((l) => l.line.displayName)).toEqual(
      expect.arrayContaining(['ITX-청춘', '경춘선', '1호선', '경의중앙선']),
    )
    const yongsan = searchGrouped(records, '용산', { limit: 5 }).find((g) => g.displayStationName === '용산역')!
    expect(yongsan.lines.map((l) => l.line.displayName)).toEqual(expect.arrayContaining(['ITX-청춘', '1호선', '경의중앙선']))
  })

  it('색은 노선도의 경춘선 초록이며 ITX-새마을 노선 색과 전부 뚜렷이 다르다(경전선 청록과 헷갈리지 않게)', () => {
    const color = cheongchun()[0].line.colorHex!
    expect(color).toBe('#34A944')
    const others = new Set(
      records.filter((r) => r.line.lineCode.startsWith('ITX-SAEMAUL')).map((r) => r.line.colorHex!),
    )
    const dist = (a: string, b: string) => {
      const c = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
      const [x, y] = [c(a), c(b)]
      return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2])
    }
    for (const other of others) expect(dist(color, other), `${color} vs ${other}`).toBeGreaterThan(80)
  })

  it('"청춘"·"경춘선"으로 검색해도 ITX-청춘 역이 나오고, 서울·수도권 범위 후보에는 섞이지 않는다', () => {
    expect(search(records, '청춘', { limit: 50 }).some((r) => r.record.line.lineCode === 'ITX-CHEONGCHUN')).toBe(true)
    expect(seoulRecords.some((r) => r.line.lineCode === 'ITX-CHEONGCHUN')).toBe(false)
  })
})

describe('실제 데이터: 공항철도 역 순서 — 0이 붙은 세 자리 역번호는 하이픈 뒤 번호처럼 취급한다(2026-09-22)', () => {
  // 사용자 확인: "숫자가 두자리수가 되면 A다음으로 오지 0이 있는 경우 셋째자리는 다시
  // 1과 같은 역할이기 때문이야." — A042(마곡나루)·A071(청라국제도시)·A072(영종)는
  // 숫자값으로 자연정렬하면 42·71·72라 종점(A11) 뒤로 밀리므로 station-line-sequence.csv로
  // 정렬 전용 키(A04-2·A07-1·A07-2)를 줬다.
  it('A01(서울역)→A11(인천공항2터미널) 순으로 나오고 마곡나루·청라국제도시·영종이 제자리에 낀다', () => {
    const airport = records.find((r) => r.line.displayName === '공항철도')!.line
    const names = listStationsOnLine(records, airport.lineId).map((s) => s.displayStationName)
    expect(names).toEqual([
      '서울역',
      '공덕역',
      '홍대입구역',
      '디지털미디어시티역',
      '마곡나루역',
      '김포공항역',
      '계양역',
      '검암역',
      '청라국제도시역',
      '영종역',
      '운서역',
      '공항화물청사역',
      '인천공항1터미널역',
      '인천공항2터미널역',
    ])
  })
})
