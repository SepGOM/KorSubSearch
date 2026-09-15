/** 출처별 어댑터가 공통으로 만들어내는 중간 표현. */

export interface RawStationInput {
  /** 이 레코드가 속한 출처(data_source) id */
  sourceId: string
  /** 출처 안에서 유일한 원본 역 코드 (station.source_record_id / 중복 판정 pairKey에 사용) */
  sourceRecordId: string
  regionCode: string
  /** 그 출처의 노선 매핑 테이블(LineDefinition[])을 찾을 때 쓰는 원본 노선 라벨 */
  rawLineLabel: string
  /** 정규화 전 원본 역명 */
  officialNameRaw: string
  englishName?: string
  /** 노선별 외부 코드(있으면) */
  sourceStationCode?: string
  /** 출처가 명시적으로 환승역이라고 표시했는지 (규칙 7.2.3 공식 환승 확인에 참고) */
  officialTransferConfirmed?: boolean
}

export interface LineDefinition {
  /** 그 출처 원본의 "호선"/"선명" 컬럼 값과 정확히 일치해야 한다 */
  rawLabel: string
  lineCode: string
  officialName: string
  displayName: string
  /** 여러 배지가 한 줄에 나열되는 곳(환승 배지 등)에 쓰는 짧은 아이콘 글자 — 예: "1", "인1", "KTX". 참고 사이트(metrotyping.kr)의 원형 아이콘 표기를 그대로 따랐다. */
  iconLabel: string
  lineNumber: number | null
  operatorCode: string
  regionCode: string
  /** KTX/SRT처럼 지역이 아니라 열차 종류로 "운행 범위 선택"을 구분해야 하는 노선만 채운다. */
  trainServiceCode?: string
  /**
   * 이 노선이 다른 노선(본선)의 지선이면 그 본선의 lineCode를 적는다(같은
   * import 실행 안의 다른 LineDefinition을 가리켜야 한다). 지선은 "노선 선택"
   * 목록에서 빠지고, 본선을 고르면 본선 패널 아래에 자기 패널로 추가로 나온다.
   */
  parentLineCode?: string
  /**
   * "이 노선의 역 보기" 패널(LineStationsPanel)에서만 쓰는 이름 — "노선 선택"
   * 버튼·환승 배지 등 다른 모든 곳은 그대로 displayName을 쓴다. 지선이 있는
   * 본선의 정체성을 그 패널 안에서만 구체적으로 밝히고 싶을 때 쓴다(예: 2호선의
   * "을지로순환선(본선)", 1호선의 "경원/종로/경인선(본선)") — 사용자 확인:
   * "밑에 리스트를 변경해달라는거였지, 위의 노선 명을 바꾸라곤 안했어". 없으면
   * displayName을 그대로 쓴다.
   */
  stationListLabel?: string
  /**
   * true면 parentLineCode 관계가 물리적 분기(지선)가 아니라 같은 노선의 서로
   * 다른 운행계통(패턴) 변형임을 뜻한다(예: 무궁화호 경부선의 "서울-제천"
   * ↔ "서울-부산" 계통, 확장 25). listStationsOnLine의 "↳ 갈림" 분기 표시를
   * 이 자식 노선에는 붙이지 않는다 — 그 표시는 진짜 물리적 분기역 전용이고,
   * 이 관계는 같은 구간이 대부분 그대로 겹치기 때문이다(사용자 확인: "운행방식에
   * 대한 환승 알은 표기하지 않아"). 환승 배지 억제는 parentLineCode만으로 이미
   * 되므로 기본값(false/미지정)은 기존 지선과 동일하게 동작한다.
   */
  suppressBranchTag?: boolean
  aliases: string[]
  sortOrder: number
}

export interface SourceAdapterResult {
  sourceId: string
  provider: {
    providerName: string
    datasetName: string
    sourceUrl: string | null
    sourceRevision: string | null
    referenceDate: string | null
    retrievedAt: string
    license: string
    notes: string[]
  }
  lineDefinitions: LineDefinition[]
  rows: RawStationInput[]
}

export function findLineDefinition(
  definitions: LineDefinition[],
  rawLabel: string,
): LineDefinition | undefined {
  return definitions.find((d) => d.rawLabel === rawLabel)
}
