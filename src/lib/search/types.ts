/** 검색 엔진이 다루는 노선/역-노선 레코드 타입. DB 조회 결과를 평탄화한 형태다. */

export interface LineRecord {
  lineId: string
  lineCode: string
  officialName: string
  displayName: string
  /** 여러 배지가 한 줄에 나열되는 곳(환승 배지 등)에 쓰는 짧은 아이콘 글자 — 예: "1", "인1", "KTX". */
  iconLabel: string
  normalizedName: string
  lineNumber: number | null
  operatorCode: string
  regionCode: string
  /** KTX/SRT처럼 "운행 범위 선택"을 지역이 아니라 열차 종류로 좁혀야 할 때 쓰는 값.
   * 지하철 노선처럼 열차 종류가 아닌 노선은 null. regionCode와는 다른 축이다 —
   * KTX·SRT는 같은 region("KTX")을 공유해 물리적으로 같은 역끼리는 자동 병합되지만,
   * 화면에서는 이 값으로 서로 다른 버튼(브랜드)으로 구분한다. */
  trainServiceCode: string | null
  colorHex: string | null
  textColorHex: string | null
  /**
   * 이 노선이 다른 노선(본선)의 지선이면 그 본선의 lineId. 지선은 "노선 선택"
   * 목록에 안 나오고, 본선을 고르면 본선 패널 아래에 자기 패널로 추가로
   * 나온다(예: 경춘선을 고르면 망우선 패널도 함께) — 사용자 확인.
   */
  parentLineId: string | null
  /**
   * "이 노선의 역 보기" 패널(LineStationsPanel)에서만 쓰는 이름 — 그 외 모든
   * 자리(노선 선택 버튼, 환승 배지 등)는 displayName을 그대로 쓴다. null이면
   * 패널에서도 displayName을 그대로 쓴다(사용자 확인: "밑에 리스트를 변경해달라는
   * 거였지, 위의 노선 명을 바꾸라곤 안했어").
   */
  stationListLabel: string | null
  /**
   * true면 parentLineId 관계가 물리적 분기(지선)가 아니라 같은 노선의 서로
   * 다른 운행계통(패턴) 변형이다(예: 무궁화호 경부선의 "서울-제천"↔"서울-부산"
   * 계통). listStationsOnLine의 "↳ 갈림" 분기 표시는 이 값이 true인 자식
   * 노선에는 붙지 않는다 — 그 표시는 진짜 물리적 분기역 전용이고, 이 관계는
   * 같은 구간이 대부분 그대로 겹치기 때문이다(사용자 확인: "운행방식에 대한
   * 환승 알은 표기하지 않아").
   */
  suppressBranchTag: boolean
  isActive: boolean
  sortOrder: number
  aliases: string[]
}

/** 자동완성의 기본 표시 단위 — 역과 노선의 조합 하나. */
export interface StationLineRecord {
  stationLineId: string
  stationId: string
  displayStationName: string
  officialStationName: string
  normalizedStationName: string
  stationInitials: string
  subName: string | null
  /** 노선 안에서의 물리적 순서(1부터 시작, 원본 STIN_CD 자연 정렬 기준). 없으면 null. */
  sequence: number | null
  regionCode: string
  stationIsActive: boolean
  isExpressStop: boolean
  isActive: boolean
  aliases: string[]
  line: LineRecord
  /** 출처 우선순위. 낮을수록 공식 자료에 가깝다 (0 = 최우선). 없으면 undefined. */
  sourcePriority?: number
}
