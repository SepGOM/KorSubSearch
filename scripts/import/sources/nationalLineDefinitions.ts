/**
 * "운영기관_역사_코드정보" 전국 역사고유번호 원본을 다루기 위한 노선 매핑.
 *
 * 원본은 (RAIL_OPR_ISTT_CD, LN_CD) 조합으로 노선을 식별하는데, 같은 실제 노선이
 * 구간별로 운영기관이 달라 여러 조합으로 쪼개져 있다 — 예: "1호선"은 서울교통공사·
 * 한국철도공사 두 조합으로 나뉘어 있지만 승객 입장에서는 환승 없이 이어지는 하나의
 * 노선이다. 사용자 확인에 따라 이런 구간은 하나의 line_code로 합친다.
 *
 * 반대로 LN_CD 값 자체("1","2","3"...)는 도시마다 재사용되므로(부산 1호선과
 * 대구 1호선이 둘 다 LN_CD="1"), operator 코드까지 함께 봐야 어느 도시의 노선인지
 * 구별할 수 있다.
 */

import type { LineDefinition, RawStationInput } from './types'

export const NATIONAL_SOURCE_ID = 'SRC-RAIL-OPERATOR-STATION-CODES'

/** 이번 버전에서 다루지 않는 노선(인천공항 자기부상철도) — 사용자 확인. */
const EXCLUDED_KEYS = new Set(['IA|M1'])

export function isExcludedOperatorLine(operatorCode: string, lineCode: string): boolean {
  return EXCLUDED_KEYS.has(`${operatorCode}|${lineCode}`)
}

export const SEOUL_METRO_LINE_DEFINITIONS: LineDefinition[] = [
  // 1호선 본선은 경원선·종로선(서울교통공사 도심 구간의 통칭)·경인선 세 구간이
  // 이어진 것이다 — 경부고속선 연결선(광명 셔틀)·병점기지선 두 지선이 갈라진다
  // (사용자 확인, 2026-09-14). displayName("노선 선택" 버튼·배지 등 대부분의
  // 자리)은 그대로 "1호선"으로 두고, stationListLabel로 "이 노선의 역 보기"
  // 패널 안에서만 본선 정체성을 밝힌다(사용자 확인: "밑에 리스트를 변경해달라는
  // 거였지, 위의 노선 명을 바꾸라곤 안했어").
  { rawLabel: 'SM-1', lineCode: 'SM-1', officialName: '수도권 전철 1호선', displayName: '1호선', stationListLabel: '경원/종로/경인선(본선)', iconLabel: '1', lineNumber: 1, operatorCode: 'SM', regionCode: 'SEOUL_METRO', aliases: ['경원선', '종로선', '경인선'], sortOrder: 1 },
  // 1호선의 지선(2단계 — 사용자 확인, 2026-09-14): 본선(경원/종로/경인선) 자체는
  // 구로에서 끝나고, 구로~신창 구간(실제로는 경부선, 신창 이후 비전철 장항선으로
  // 이어짐)이 통째로 "경부/장항선"이라는 별도 지선이다("경부/장항선이 구로<->신창
  // 구간이야"). 그 경부/장항선 안에서 다시 금천구청→광명(경부고속선 연결선,
  // "광명 셔틀")과 병점→서동탄(병점기지선) 두 곳이 더 갈라진다 — 그래서 이 둘의
  // parentLineCode는 SM-1이 아니라 "경부/장항선"이다(지선의 지선, 2단계 계층).
  { rawLabel: 'SM-1-GYEONGBU-JANGHANG', lineCode: 'SM-1-GYEONGBU-JANGHANG', officialName: '1호선 경부/장항선 구간', displayName: '경부/장항선', iconLabel: '1', lineNumber: null, operatorCode: 'KR', regionCode: 'SEOUL_METRO', parentLineCode: 'SM-1', aliases: ['경부선', '장항선'], sortOrder: 1204 },
  { rawLabel: 'SM-1-GYEONGBUGOSOK', lineCode: 'SM-1-GYEONGBUGOSOK', officialName: '1호선 경부고속선 연결선', displayName: '경부고속선', iconLabel: '1', lineNumber: null, operatorCode: 'KR', regionCode: 'SEOUL_METRO', parentLineCode: 'SM-1-GYEONGBU-JANGHANG', aliases: [], sortOrder: 1205 },
  { rawLabel: 'SM-1-BYEONGJEOM', lineCode: 'SM-1-BYEONGJEOM', officialName: '1호선 병점기지선', displayName: '병점기지선', iconLabel: '1', lineNumber: null, operatorCode: 'KR', regionCode: 'SEOUL_METRO', parentLineCode: 'SM-1-GYEONGBU-JANGHANG', aliases: [], sortOrder: 1206 },
  // 2호선 본선 자체에 성수지선·신정지선 두 지선이 갈라진다(나무위키 "서울 지하철
  // 2호선/역 목록" 문서) — 1호선과 같은 이유로 displayName은 "2호선" 그대로 두고,
  // stationListLabel로만 "을지로순환선(본선)"을 밝힌다.
  { rawLabel: 'SM-2', lineCode: 'SM-2', officialName: '서울 지하철 2호선', displayName: '2호선', stationListLabel: '을지로순환선(본선)', iconLabel: '2', lineNumber: 2, operatorCode: 'SM', regionCode: 'SEOUL_METRO', aliases: ['을지로순환선', '을지로'], sortOrder: 2 },
  // 2호선의 지선 — 나무위키 문서의 "성수지선"(성수~신설동)·"신정지선"(신도림~까치산)
  // 구분을 그대로 반영했다(사용자 확인, 2026-09-14). 사용자가 원본 엑셀에 이미
  // 위키의 역번 하이픈 표기(211-1~211-4, 234-1~234-4)를 그대로 붙여놔서, 자연정렬
  // 만으로 성수/신도림(합류역) 바로 뒤에 정확히 이어진다 — 별도 정렬 키가 필요 없다.
  { rawLabel: 'SM-2-SEONGSU', lineCode: 'SM-2-SEONGSU', officialName: '2호선 성수지선', displayName: '성수지선', iconLabel: '2', lineNumber: null, operatorCode: 'S1', regionCode: 'SEOUL_METRO', parentLineCode: 'SM-2', aliases: [], sortOrder: 1203 },
  { rawLabel: 'SM-2-SINJEONG', lineCode: 'SM-2-SINJEONG', officialName: '2호선 신정지선', displayName: '신정지선', iconLabel: '2', lineNumber: null, operatorCode: 'S1', regionCode: 'SEOUL_METRO', parentLineCode: 'SM-2', aliases: [], sortOrder: 1204 },
  { rawLabel: 'SM-3', lineCode: 'SM-3', officialName: '수도권 전철 3호선', displayName: '3호선', iconLabel: '3', lineNumber: 3, operatorCode: 'SM', regionCode: 'SEOUL_METRO', aliases: [], sortOrder: 3 },
  { rawLabel: 'SM-4', lineCode: 'SM-4', officialName: '수도권 전철 4호선', displayName: '4호선', iconLabel: '4', lineNumber: 4, operatorCode: 'SM', regionCode: 'SEOUL_METRO', aliases: [], sortOrder: 4 },
  { rawLabel: 'SM-5', lineCode: 'SM-5', officialName: '수도권 전철 5호선', displayName: '5호선', iconLabel: '5', lineNumber: 5, operatorCode: 'SM', regionCode: 'SEOUL_METRO', aliases: [], sortOrder: 5 },
  // 5호선의 지선(마천지선) — 나무위키 "수도권 전철 5호선/역 목록" 문서의
  // "본선/하남선"·"마천지선" 구분을 그대로 반영했다(사용자 확인, 2026-09-14).
  // 강동에서 갈라져 둔촌동~마천으로 이어지고 천호 방면 본선에 합류한다.
  // iconLabel을 "5"로 맞춰 다른 노선에서 볼 때도 배지가 "5"로 보이게 했다.
  { rawLabel: 'SM-5-MACHEON', lineCode: 'SM-5-MACHEON', officialName: '5호선 마천지선', displayName: '마천지선', iconLabel: '5', lineNumber: null, operatorCode: 'SM', regionCode: 'SEOUL_METRO', parentLineCode: 'SM-5', aliases: [], sortOrder: 1202 },
  { rawLabel: 'SM-6', lineCode: 'SM-6', officialName: '서울 지하철 6호선', displayName: '6호선', iconLabel: '6', lineNumber: 6, operatorCode: 'SM', regionCode: 'SEOUL_METRO', aliases: [], sortOrder: 6 },
  { rawLabel: 'SM-7', lineCode: 'SM-7', officialName: '서울 지하철 7호선', displayName: '7호선', iconLabel: '7', lineNumber: 7, operatorCode: 'SM', regionCode: 'SEOUL_METRO', aliases: [], sortOrder: 7 },
  { rawLabel: 'SM-8', lineCode: 'SM-8', officialName: '수도권 전철 8호선', displayName: '8호선', iconLabel: '8', lineNumber: 8, operatorCode: 'SM', regionCode: 'SEOUL_METRO', aliases: [], sortOrder: 8 },
  { rawLabel: 'S9-9', lineCode: 'S9-9', officialName: '서울 지하철 9호선', displayName: '9호선', iconLabel: '9', lineNumber: 9, operatorCode: 'S9', regionCode: 'SEOUL_METRO', aliases: [], sortOrder: 9 },
  { rawLabel: 'KR-SUIN-BUNDANG', lineCode: 'KR-SUIN-BUNDANG', officialName: '수도권 전철 수인·분당선', displayName: '수인분당선', iconLabel: '수인', lineNumber: null, operatorCode: 'KR', regionCode: 'SEOUL_METRO', aliases: ['분당선', '수인선'], sortOrder: 10 },
  { rawLabel: 'KR-GYEONGUI-JUNGANG', lineCode: 'KR-GYEONGUI-JUNGANG', officialName: '수도권 전철 경의·중앙선', displayName: '경의중앙선', iconLabel: '경의', lineNumber: null, operatorCode: 'KR', regionCode: 'SEOUL_METRO', aliases: ['경의중앙선', '중앙선', '경의선'], sortOrder: 11 },
  // 경의중앙선의 지선(경의1선) — 나무위키 "경의·중앙선/역 목록" 문서의 "경의·중앙선
  // 본선 계통"/"경의1선 계통" 구분을 그대로 반영했다(사용자 확인, 2026-09-14).
  // 가좌에서 갈라져 신촌·서울역으로 이어지고 디지털미디어시티 방면 본선에 합류한다.
  // 망우선과 같은 원칙으로 iconLabel을 "경의"로 맞췄다 — 용문홍천선은 아직 미개통
  // 구간이라(가칭 역명, 나무위키에도 취소선 표기) 사용자 확인에 따라 분리하지 않는다.
  { rawLabel: 'KR-GYEONGUI1', lineCode: 'KR-GYEONGUI1', officialName: '경의중앙선 경의1선', displayName: '경의1선', iconLabel: '경의', lineNumber: null, operatorCode: 'KR', regionCode: 'SEOUL_METRO', parentLineCode: 'KR-GYEONGUI-JUNGANG', aliases: [], sortOrder: 1201 },
  { rawLabel: 'KR-GYEONGCHUN', lineCode: 'KR-GYEONGCHUN', officialName: '수도권 전철 경춘선', displayName: '경춘선', iconLabel: '경춘', lineNumber: null, operatorCode: 'KR', regionCode: 'SEOUL_METRO', aliases: [], sortOrder: 12 },
  // 경춘선의 지선(망우선) — 위키백과 경춘선 문서의 "본선"/"망우선" 구분을 그대로
  // 반영했다(사용자 확인, 2026-09-14). "노선 선택" 목록에는 안 나오고(parentLineCode),
  // 경춘선을 고르면 패널이 하나 더 붙어 나온다. iconLabel을 "경춘"으로 맞춰서
  // 다른 노선(1호선)에서 광운대를 볼 때도 배지가 "경춘"으로 보이게 했다(사용자 확인:
  // "1호선에서 볼 때 광운대역은 (경춘) 배지가 보이면 돼").
  { rawLabel: 'KR-MANGU', lineCode: 'KR-MANGU', officialName: '경춘선 망우선', displayName: '망우선', iconLabel: '경춘', lineNumber: null, operatorCode: 'KR', regionCode: 'SEOUL_METRO', parentLineCode: 'KR-GYEONGCHUN', aliases: [], sortOrder: 1200 },
  { rawLabel: 'KR-GYEONGGANG', lineCode: 'KR-GYEONGGANG', officialName: '수도권 전철 경강선', displayName: '경강선', iconLabel: '경강', lineNumber: null, operatorCode: 'KR', regionCode: 'SEOUL_METRO', aliases: [], sortOrder: 13 },
  { rawLabel: 'SW-SH', lineCode: 'SW-SH', officialName: '수도권 전철 서해선', displayName: '서해선', iconLabel: '서해', lineNumber: null, operatorCode: 'SW', regionCode: 'SEOUL_METRO', aliases: [], sortOrder: 14 },
  { rawLabel: 'SB-S', lineCode: 'SB-S', officialName: '신분당선', displayName: '신분당선', iconLabel: '신분', lineNumber: null, operatorCode: 'SB', regionCode: 'SEOUL_METRO', aliases: [], sortOrder: 15 },
  { rawLabel: 'KA-A', lineCode: 'KA-A', officialName: '인천국제공항철도', displayName: '공항철도', iconLabel: '공항', lineNumber: null, operatorCode: 'KA', regionCode: 'SEOUL_METRO', aliases: ['AREX', '인천공항철도'], sortOrder: 16 },
  { rawLabel: 'IM-1', lineCode: 'IM-1', officialName: '인천 도시철도 1호선', displayName: '인천 1호선', iconLabel: '인1', lineNumber: 1, operatorCode: 'IM', regionCode: 'SEOUL_METRO', aliases: ['인1'], sortOrder: 17 },
  { rawLabel: 'IM-2', lineCode: 'IM-2', officialName: '인천 도시철도 2호선', displayName: '인천 2호선', iconLabel: '인2', lineNumber: 2, operatorCode: 'IM', regionCode: 'SEOUL_METRO', aliases: ['인2'], sortOrder: 18 },
  { rawLabel: 'UL-U', lineCode: 'UL-U', officialName: '의정부 경전철', displayName: '의정부경전철', iconLabel: '의정', lineNumber: null, operatorCode: 'UL', regionCode: 'SEOUL_METRO', aliases: [], sortOrder: 19 },
  { rawLabel: 'YL-E', lineCode: 'YL-E', officialName: '용인 경전철', displayName: '용인경전철', iconLabel: '용인', lineNumber: null, operatorCode: 'YL', regionCode: 'SEOUL_METRO', aliases: ['에버라인', '용인 에버라인'], sortOrder: 20 },
  { rawLabel: 'UI-U', lineCode: 'UI-U', officialName: '서울 경전철 우이신설선', displayName: '우이신설선', iconLabel: '우이', lineNumber: null, operatorCode: 'UI', regionCode: 'SEOUL_METRO', aliases: ['우이신설경전철'], sortOrder: 21 },
  { rawLabel: 'SS-S', lineCode: 'SS-S', officialName: '서울 경전철 신림선', displayName: '신림선', iconLabel: '신림', lineNumber: null, operatorCode: 'SS', regionCode: 'SEOUL_METRO', aliases: [], sortOrder: 22 },
  { rawLabel: 'GG-G', lineCode: 'GG-G', officialName: '김포골드라인', displayName: '김포골드라인', iconLabel: '김포', lineNumber: null, operatorCode: 'GG', regionCode: 'SEOUL_METRO', aliases: ['김포도시철도'], sortOrder: 23 },
  { rawLabel: 'SG-A', lineCode: 'SG-A', officialName: '수도권 광역급행철도 A노선', displayName: 'GTX-A', iconLabel: 'GTX', lineNumber: null, operatorCode: 'SG', regionCode: 'SEOUL_METRO', aliases: ['수도권 광역급행철도 A노선', 'GTX-A'], sortOrder: 24 },
]

export const BUSAN_LINE_DEFINITIONS: LineDefinition[] = [
  { rawLabel: 'BT-1', lineCode: 'BT-1', officialName: '부산 도시철도 1호선', displayName: '부산 1호선', iconLabel: '부1', lineNumber: 1, operatorCode: 'BT', regionCode: 'BUSAN', aliases: ['부1'], sortOrder: 100 },
  { rawLabel: 'BT-2', lineCode: 'BT-2', officialName: '부산 도시철도 2호선', displayName: '부산 2호선', iconLabel: '부2', lineNumber: 2, operatorCode: 'BT', regionCode: 'BUSAN', aliases: ['부2'], sortOrder: 101 },
  { rawLabel: 'BT-3', lineCode: 'BT-3', officialName: '부산 도시철도 3호선', displayName: '부산 3호선', iconLabel: '부3', lineNumber: 3, operatorCode: 'BT', regionCode: 'BUSAN', aliases: ['부3'], sortOrder: 102 },
  { rawLabel: 'BT-4', lineCode: 'BT-4', officialName: '부산 도시철도 4호선', displayName: '부산 4호선', iconLabel: '부4', lineNumber: 4, operatorCode: 'BT', regionCode: 'BUSAN', aliases: ['부4'], sortOrder: 103 },
  { rawLabel: 'BG-L', lineCode: 'BG-L', officialName: '부산-김해 경전철', displayName: '부산김해경전철', iconLabel: 'BGL', lineNumber: null, operatorCode: 'BG', regionCode: 'BUSAN', aliases: ['부산-김해경전철', '김해경전철', 'BGL'], sortOrder: 110 },
  { rawLabel: 'KR-DONGHAE', lineCode: 'KR-DONGHAE', officialName: '동해선 광역전철', displayName: '동해선', iconLabel: '동해', lineNumber: null, operatorCode: 'KR', regionCode: 'BUSAN', aliases: [], sortOrder: 111 },
]

export const DAEGU_LINE_DEFINITIONS: LineDefinition[] = [
  { rawLabel: 'DT-1', lineCode: 'DT-1', officialName: '대구 도시철도 1호선', displayName: '대구 1호선', iconLabel: '대1', lineNumber: 1, operatorCode: 'DT', regionCode: 'DAEGU', aliases: ['대구1'], sortOrder: 200 },
  { rawLabel: 'DT-2', lineCode: 'DT-2', officialName: '대구 도시철도 2호선', displayName: '대구 2호선', iconLabel: '대2', lineNumber: 2, operatorCode: 'DT', regionCode: 'DAEGU', aliases: ['대구2'], sortOrder: 201 },
  { rawLabel: 'DT-3', lineCode: 'DT-3', officialName: '대구 도시철도 3호선', displayName: '대구 3호선', iconLabel: '대3', lineNumber: 3, operatorCode: 'DT', regionCode: 'DAEGU', aliases: ['대구3'], sortOrder: 202 },
  { rawLabel: 'KR-DAEGYEONG', lineCode: 'KR-DAEGYEONG', officialName: '대경선', displayName: '대경선', iconLabel: '대경', lineNumber: null, operatorCode: 'KR', regionCode: 'DAEGU', aliases: [], sortOrder: 210 },
]

export const GWANGJU_LINE_DEFINITIONS: LineDefinition[] = [
  { rawLabel: 'GM-1', lineCode: 'GM-1', officialName: '광주 도시철도 1호선', displayName: '광주 1호선', iconLabel: '광1', lineNumber: 1, operatorCode: 'GM', regionCode: 'GWANGJU', aliases: ['광1'], sortOrder: 300 },
]

export const DAEJEON_LINE_DEFINITIONS: LineDefinition[] = [
  // 대구 1호선과 나란히 "대1"을 쓰면 두 노선이 다시 섞이므로(사용자 확인:
  // "대구, 대전일 경우, 그냥 풀 네임 적는것으로 진행"), 대전은 줄임말 대신
  // 지역명 그대로("대전1")를 키워드로 쓴다.
  { rawLabel: 'DJ-1', lineCode: 'DJ-1', officialName: '대전 도시철도 1호선', displayName: '대전 1호선', iconLabel: '대전', lineNumber: 1, operatorCode: 'DJ', regionCode: 'DAEJEON', aliases: ['대전1'], sortOrder: 400 },
]

export const ALL_REGION_LINE_DEFINITIONS: Record<string, LineDefinition[]> = {
  SEOUL_METRO: SEOUL_METRO_LINE_DEFINITIONS,
  BUSAN: BUSAN_LINE_DEFINITIONS,
  DAEGU: DAEGU_LINE_DEFINITIONS,
  GWANGJU: GWANGJU_LINE_DEFINITIONS,
  DAEJEON: DAEJEON_LINE_DEFINITIONS,
}

/**
 * 원본의 (RAIL_OPR_ISTT_CD, LN_CD) 조합 → 우리 내부 line_code.
 * 같은 line_code로 매핑되는 여러 조합은 승객이 환승 없이 잇는 한 노선으로 본다
 * (사용자 확인 — 예: 서울교통공사 1호선 + 한국철도공사 1호선 → SM-1).
 */
export const OPERATOR_LINE_TO_CODE: Record<string, string> = {
  'AR|A1': 'KA-A',
  'BG|B1': 'BG-L',
  'BS|1': 'BT-1',
  'BS|2': 'BT-2',
  'BS|3': 'BT-3',
  'BS|4': 'BT-4',
  'DG|1': 'DT-1',
  'DG|2': 'DT-2',
  'DG|3': 'DT-3',
  'DJ|1': 'DJ-1',
  'DX|D1': 'SB-S',
  'EV|E1': 'YL-E',
  'GJ|1': 'GM-1',
  'GM|G1': 'GG-G',
  'GU|8': 'SM-8',
  'GX|A': 'SG-A',
  'SR|A': 'SG-A',
  'IC|7': 'SM-7',
  'IC|I1': 'IM-1',
  'IC|I2': 'IM-2',
  'KR|1': 'SM-1',
  'KR|3': 'SM-3',
  'KR|4': 'SM-4',
  'KR|K1': 'KR-SUIN-BUNDANG',
  'KR|K2': 'KR-GYEONGCHUN',
  'KR|K4': 'KR-GYEONGUI-JUNGANG',
  'KR|K5': 'KR-GYEONGGANG',
  'KR|K6': 'KR-DONGHAE',
  'KR|K7': 'KR-DAEGYEONG',
  'KR|WS': 'SW-SH',
  'NU|4': 'SM-4',
  'NU|8': 'SM-8',
  'S1|1': 'SM-1',
  'S1|2': 'SM-2',
  'S1|3': 'SM-3',
  'S1|4': 'SM-4',
  'S1|5': 'SM-5',
  'S1|6': 'SM-6',
  'S1|7': 'SM-7',
  'S1|8': 'SM-8',
  'S9|9': 'S9-9',
  'SL|L1': 'SS-S',
  'SW|WS': 'SW-SH',
  'UI|UI': 'UI-U',
  'UL|U1': 'UL-U',
}

/** line_code → 그 노선이 속한 지역. LineDefinition 배열들로부터 한 번만 만든다. */
export const LINE_CODE_TO_REGION: Record<string, string> = Object.fromEntries(
  Object.values(ALL_REGION_LINE_DEFINITIONS)
    .flat()
    .map((def) => [def.lineCode, def.regionCode]),
)

// ---------------------------------------------------------------------------
// 지선(branch line) 보정 — 원본은 지선 소속 역도 본선과 같은 (operator, line_code)
// 조합으로 묶어놓는 경우가 있어, 그런 개별 레코드만 사람이 확인해 다른 line_code로
// 재분류한다. 위키백과 노선 문서의 "본선"/"지선" 구분을 기준으로 삼는다
// (사용자 확인, 2026-09-14). 원본 자체를 고치는 게 아니라 이 매핑을 거쳐서만
// 다르게 처리한다 — station.official_name·source_station_code 등은 그대로다.
// ---------------------------------------------------------------------------

/**
 * source_record_id → 재분류할 line_code.
 *
 * 경춘선: 광운대(코드 119)는 원본에서 "KR|K2"(경춘선)로 표시되지만, 실제로는
 * 본선(K11x~P14x)과 다른 코드 체계를 쓰는 별도 지선(망우선) 소속이다 — 이
 * 레코드 하나만 "KR-MANGU"로 재분류한다. 광운대 자체는 지우지 않고 그대로
 * 1호선(KR-1-119)에도 남아 있으며, 이름·지역이 같아 자동으로 병합된다.
 *
 * 경의중앙선: 서울역(P313)·신촌(P314)은 원본에서 "KR|K4"(경의중앙선)로 표시되지만,
 * 실제로는 본선(K1xx/K2xx/K3xx)과 다른 코드 체계(P3xx)를 쓰는 별도 지선(경의1선)
 * 소속이다 — 이 두 레코드만 "KR-GYEONGUI1"로 재분류한다.
 *
 * 5호선: 둔촌동~마천 7개 역(P549~P555)은 원본에서 "S1|5"(5호선)로 표시되지만,
 * 실제로는 본선(순수 숫자 코드)과 다른 코드 체계(P54x)를 쓰는 별도 지선(마천지선)
 * 소속이다 — 이 7개 레코드만 "SM-5-MACHEON"으로 재분류한다. 사용자가 원본
 * 엑셀 자체에서 이미 이 7개 역에 P 접두 코드를 붙여놨다(2026-09-14).
 *
 * 2호선: 성수지선(용답·신답·용두·신설동, 211-1~211-4)과 신정지선(도림천·양천구청·
 * 신정네거리·까치산, 234-1~234-4)은 원본에서 "S1|2"(2호선)로 표시되지만 실제로는
 * 본선(순수 숫자 코드)과 다른 하이픈 확장 코드 체계를 쓰는 별도 지선 소속이다 —
 * 사용자가 원본 엑셀에 나무위키 역번 그대로 하이픈 코드를 이미 붙여놨다
 * (2026-09-14).
 *
 * 1호선: 광명(금천구청에서 갈라지는 경부고속선 연결선, P144-1)과 서동탄(병점에서
 * 갈라지는 병점기지선, P157-1)은 원본에서 "KR|1"(1호선)로 표시되지만 실제로는
 * 본선과 다른 하이픈 확장 코드 체계를 쓰는 별도 지선 소속이다(사용자 확인,
 * 2026-09-14).
 *
 * 1호선: 구로~신창(가산디지털단지~신창, P142~P177) 구간 전체도 본선(경원/종로/
 * 경인선)과는 별도인 "경부/장항선" 지선이다(사용자 확인: "경부/장항선이
 * 구로<->신창 구간이야") — 그 안에서 다시 갈라지는 경부고속선(P144-1)·병점기지선
 * (P157-1)은 위에서 이미 SM-1-GYEONGBU-JANGHANG로 부모를 잡아뒀으니 여기서는
 * 겹치지 않는다.
 */
export const RECLASSIFIED_LINE_CODE_BY_SOURCE_RECORD_ID: Record<string, string> = {
  'KR-K2-119': 'KR-MANGU',
  'KR-K4-P313': 'KR-GYEONGUI1',
  'KR-K4-P314': 'KR-GYEONGUI1',
  'S1-5-P549': 'SM-5-MACHEON',
  'S1-5-P550': 'SM-5-MACHEON',
  'S1-5-P551': 'SM-5-MACHEON',
  'S1-5-P552': 'SM-5-MACHEON',
  'S1-5-P553': 'SM-5-MACHEON',
  'S1-5-P554': 'SM-5-MACHEON',
  'S1-5-P555': 'SM-5-MACHEON',
  'S1-2-211-1': 'SM-2-SEONGSU',
  'S1-2-211-2': 'SM-2-SEONGSU',
  'S1-2-211-3': 'SM-2-SEONGSU',
  'S1-2-211-4': 'SM-2-SEONGSU',
  'S1-2-234-1': 'SM-2-SINJEONG',
  'S1-2-234-2': 'SM-2-SINJEONG',
  'S1-2-234-3': 'SM-2-SINJEONG',
  'S1-2-234-4': 'SM-2-SINJEONG',
  'KR-1-P144-1': 'SM-1-GYEONGBUGOSOK',
  'KR-1-P157-1': 'SM-1-BYEONGJEOM',
  'KR-1-P142': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P143': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P144': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P145': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P146': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P147': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P148': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P149': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P150': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P151': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P152': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P153': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P154': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P155': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P156': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P157': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P158': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P159': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P160': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P161': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P162': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P163': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P164': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P165': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P166': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P167': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P168': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P169': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P170': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P171': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P172': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P173': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P174': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P176': 'SM-1-GYEONGBU-JANGHANG',
  'KR-1-P177': 'SM-1-GYEONGBU-JANGHANG',
}

/**
 * 지선의 끝(본선과 만나는 역)처럼, 원본에는 그 지선 소속 레코드가 아예 없는
 * 역을 위한 합성(synthetic) 레코드. 실제 원본 표에는 없고 사람이 위키백과
 * 노선 문서를 확인해 추가한 것이다 — 새 역이 아니라 이름·지역이 같은 기존
 * 역(예: 상봉)에 자동으로 병합된다.
 *
 * 경춘선 망우선: 상봉은 이미 경춘선 본선 레코드(KR-K2-K120)로 존재하지만,
 * "망우선이 상봉에서 합류한다"는 사실 자체를 나타낼 지선 소속 레코드가 원본에
 * 없어 하나 추가한다.
 *
 * 경의중앙선 경의1선: 가좌는 이미 경의중앙선 본선 레코드(KR-K4-K315)로 존재하지만,
 * "경의1선이 가좌에서 갈라진다"는 사실 자체를 나타낼 지선 소속 레코드가 원본에
 * 없어 하나 추가한다.
 *
 * 5호선 마천지선: 강동은 이미 5호선 본선 레코드(S1-5-548)로 존재하지만,
 * "마천지선이 강동에서 갈라진다"는 사실 자체를 나타낼 지선 소속 레코드가 원본에
 * 없어 하나 추가한다.
 *
 * 2호선 성수지선·신정지선: 성수(211)·신도림(234)은 이미 2호선 본선
 * 레코드로 존재하지만, "지선이 여기서 갈라진다"는 사실 자체를 나타낼 지선 소속
 * 레코드가 원본에 없어 하나씩 추가한다(나무위키 문서도 각 지선 표의 첫 행을
 * 같은 역번으로 다시 보여준다).
 *
 * 1호선 경부고속선 연결선·병점기지선: 금천구청(P144)·병점(P157)은 이미 경부/
 * 장항선 레코드로 존재하지만(위 재분류로), "지선이 여기서 또 갈라진다"는 사실
 * 자체를 나타낼 지선 소속 레코드가 원본에 없어 하나씩 추가한다.
 *
 * 1호선 경부/장항선: 구로(141)는 이미 1호선 본선 레코드로 존재하지만,
 * "경부/장항선이 여기서 갈라진다"는 사실 자체를 나타낼 지선 소속 레코드가
 * 원본에 없어 하나 추가한다.
 */
export const SEOUL_METRO_BRANCH_SYNTHETIC_ROWS: Array<Omit<RawStationInput, 'sourceId'>> = [
  {
    sourceRecordId: 'BRANCH-MANGU-SANGBONG',
    regionCode: 'SEOUL_METRO',
    rawLineLabel: 'KR-MANGU',
    officialNameRaw: '상봉',
    sourceStationCode: 'K120',
  },
  {
    sourceRecordId: 'BRANCH-GYEONGUI1-GAJWA',
    regionCode: 'SEOUL_METRO',
    rawLineLabel: 'KR-GYEONGUI1',
    officialNameRaw: '가좌',
    sourceStationCode: 'K315',
  },
  {
    sourceRecordId: 'BRANCH-MACHEON-GANGDONG',
    regionCode: 'SEOUL_METRO',
    rawLineLabel: 'SM-5-MACHEON',
    officialNameRaw: '강동',
    sourceStationCode: '548',
  },
  {
    sourceRecordId: 'BRANCH-SEONGSU-JUNCTION',
    regionCode: 'SEOUL_METRO',
    rawLineLabel: 'SM-2-SEONGSU',
    officialNameRaw: '성수',
    sourceStationCode: '211',
  },
  {
    sourceRecordId: 'BRANCH-SINJEONG-JUNCTION',
    regionCode: 'SEOUL_METRO',
    rawLineLabel: 'SM-2-SINJEONG',
    officialNameRaw: '신도림',
    sourceStationCode: '234',
  },
  {
    sourceRecordId: 'BRANCH-GYEONGBUGOSOK-JUNCTION',
    regionCode: 'SEOUL_METRO',
    rawLineLabel: 'SM-1-GYEONGBUGOSOK',
    officialNameRaw: '금천구청',
    sourceStationCode: 'P144',
  },
  {
    sourceRecordId: 'BRANCH-BYEONGJEOM-JUNCTION',
    regionCode: 'SEOUL_METRO',
    rawLineLabel: 'SM-1-BYEONGJEOM',
    officialNameRaw: '병점',
    sourceStationCode: 'P157',
  },
  {
    sourceRecordId: 'BRANCH-GYEONGBU-JANGHANG-JUNCTION',
    regionCode: 'SEOUL_METRO',
    rawLineLabel: 'SM-1-GYEONGBU-JANGHANG',
    officialNameRaw: '구로',
    sourceStationCode: '141',
  },
]
