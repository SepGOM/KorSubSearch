/**
 * data/raw/mugunghwa/{mugunghwa_patterns,mugunghwa_pattern_stops,mugunghwa_stations}.csv
 * 원본을 다루기 위한 노선 정의(확장 25, 2026-09-16 raw 전면 재수정 반영).
 *
 * KTX(ktxGameLineDefinitions.ts)와 달리 이 원본은 사용자가 미리 조인해 둔 파일이
 * 없다 — patterns.csv(pattern_id·group_name·pattern_name)·pattern_stops.csv
 * (pattern_id·stop_order·station_id)·stations.csv(station_id·station_name) 세 파일을
 * mugunghwaSource.ts가 직접 조인한다. pattern_id 하나가 이 파일의 LineDefinition
 * 하나에 정확히 대응한다(rawLabel = pattern_id).
 *
 * group_name(예: "경부선")별로 pattern이 하나뿐이면(경부선/장항선/전라선/중앙선/
 * 태백선/영동선/대구선/경북선/교외선) KTX와 똑같이 그 group_name 하나가 곧 "노선
 * 선택"에 뜨는 평면 노선이다(사용자 확인: "노선 선택 토글에서는 무궁화-장항선의
 * 이전 KTX와 동일한 방식으로 진행해주면 돼").
 *
 * group_name에 pattern이 여럿이면(충북선/호남선/동해선/경전선) patterns.csv에
 * 먼저 나오는 pattern을 "대표"로 삼아 그 group_name 자체를 displayName으로 쓰고
 * (예: "충북선"), 나머지 pattern들은 parentLineCode로 대표에 딸린 자식
 * 노선이 된다 — 수도권 전철 지선 토글과 같은 메커니즘(App.tsx의
 * deriveDescendantLines)을 그대로 써서, 대표를 고르면 나머지 계통 패널도 한꺼번에
 * 펼쳐진다.
 *
 * 토글박스 자체의 표시 이름(대표는 stationListLabel, 자식은 displayName)은
 * "그룹명(구간)" 전체가 아니라 구간만 쓴다 — 어차피 "충북선" 버튼을
 * 이미 고른 상태에서 그 아래 토글들을 보는 것이라 그룹명을 반복할 필요가 없기
 * 때문이다(사용자 확인: "지선 처리가 되어있는 무궁화호 노선일 경우, 토글박스의
 * 아이콘 명은 경유하는 역만 작성 — 무궁화-충북선일 경우 두개의 토글박의 아이콘은
 * (서울-영주) / (동대구-영주) 이렇게 구성" — 처음엔 괄호를 그대로 살려 "(서울-영주)"
 * 로 넣었는데, 바로 이어서 "괄호는 빼줘"라는 확인이 와서 괄호 없이 "서울-영주"
 * 로 고쳤다).
 *
 * 2026-09-15 추가 사용자 확인("무궁화호에서는 노선에 '무궁화-'가 필요없네.
 * 단일 노선 시 토글 박스에서도 '00선'만 보이게"): displayName에서 "무궁화-"
 * 접두어를 뺐다 — "무궁화-충북선" → "충북선", "무궁화-경부선" → "경부선" 등
 * (13개 group_name 중 12개, 동해선 예외는 아래 참고). 무궁화호는 애초에 KTX와
 * 달리 전용 region("MUGUNGHWA") 안에서만 노출되는 범위라 "무궁화-" 접두어가
 * 다른 범위와의 구분에 실질적으로 필요 없었다 — 원형 아이콘(iconLabel="무궁화")이
 * 이미 그 역할을 한다. 단일 계통(평면) 노선은 stationListLabel이 없어 토글박스가
 * displayName을 그대로 쓰므로, 이 변경만으로 "OO선"만 보이는 요청도 함께
 * 충족된다. 다중 계통 그룹의 대표(stationListLabel이 따로 있는 충북선·호남선·
 * 동해선·경전선)는 토글박스에서 여전히 자기 구간(예: "동대구-영주")을 보여준다
 * — "노선 선택" 버튼의 displayName만 바뀌었을 뿐이다.
 *
 * **예외 — 동해선만 접두어를 유지한다**: 부산 광역전철에 이미 "동해선"
 * (KR-DONGHAE)이 있고, 기장·남창·부전·센텀·신해운대·태화강 6개 역은 두
 * "동해선"이 실제로 같은 역을 공유해(이미 병합됨) 접두어를 떼면 그 역들의
 * 검색 결과에 이름이 완전히 같은 배지가 색만 다른 채로 두 개 뜬다 — 재수입 후
 * 실제 DB를 조회해 발견했다. 그래서 MG-DONGHAE(동해선 대표)만 "무궁화-동해선"
 * 그대로 두고, 자식(부전~포항)·나머지 12개 그룹은 그대로 접두어를 뺀다.
 *
 * 다만 수도권 전철 지선과 달리, 여기서는 대표/자식 노선의 역 목록이 대부분 그대로
 * 겹친다(예: 충북선의 "서울-영주"과 "동대구-영주"는 오송~영주 구간을 통째로
 * 공유) — 사용자 확인: "각 운행 방식에 따른 역을 확인하기 위해 중복에 대해서는
 * 신경쓰지 말고 pattern-stops 파일의 순서대로 토글에 반영해줘". 그래서 이 파일의
 * 자식 노선은 모두 suppressBranchTag: true로 표시해 물리적 분기역 전용인 "↳ 갈림"
 * 표시를 붙이지 않는다(환승 배지 억제는 parentLineCode만으로 이미 된다 —
 * engine.ts의 isSameLineFamily).
 *
 * 검색 화면에서 같은 역이 여러 계통에 겹쳐 나와도 배지는 하나(대표 이름)만
 * 남는다 — searchGrouped()의 resolveDisplayLine이 자식을 항상 부모(대표) 정체성
 * 으로 치환하기 때문에 자동으로 그렇게 된다(사용자 확인: "검색시에는 중복을
 * 관여하는 것으로, 하나만 뜨게").
 *
 * 지역: 무궁화호 전용 pseudo-region("MUGUNGHWA")을 새로 둔다 — KTX와 같은
 * pseudo-region("KTX")을 쓰지 않는 이유는, 무궁화호가 KTX/SRT나 도시 지역
 * 노선과 실제로 같은 역을 공유해도 그걸 자동으로 환승역 처리하고 싶지 않아서다
 * (사용자 확인: "무궁화호 내 제외 타 지역별 환승역에 대해서 확실하지 않은
 * 부분은 환승역이라고 우선 표기하지 말고"). 무궁화호 안에서(같은 region) 이름이
 * 같은 역은 기존 자동/잠정 병합 규칙대로 계속 하나로 묶인다. 확실한 역은
 * data/overrides/station-resolution.csv에 직접 MERGE/KEEP_SEPARATE로 확인해
 * 뒀다(확장 26).
 *
 * 아이콘·그룹 분류: 참고 사이트(metrotyping.kr) "무궁화호" 지역 선택의 "노선
 * 선택" 배지를 그대로 따랐다 — 배지 텍스트가 전부 "무궁화"라 iconLabel도
 * "무궁화"로 통일한다. 배지 배경색도 실제 CSS background-color를 읽어 옮겼다
 * (data/reference/rail-line-colors-source.json 참고). 다만 이 사이트에는 8개
 * 그룹(장항선/영동선/태백선/호남선/충북선/경북선/경부선/교외선)만 있고, raw
 * 데이터에 있는 전라선/중앙선/동해선/경전선/대구선은 참고할 색이 없어 같은
 * 팔레트 계열로 임의 지정했다(사용자 확인: "같은 팔레트로 자동 선정") — 실제
 * 공식 색상이 아니므로 추후 확인이 필요하다.
 *
 * 2026-09-16 raw 전면 재수정으로 바뀐 것(사용자 확인):
 * - 충북선 누락 역 추가 + "서울-영주" 계통(MG20) 신설 — 기존 "경부선(서울-제천)"
 *   (MG02)을 대체한다("경부선 서울-제천 노선 통합 및 경부(서울-제천)노선 삭제").
 *   그 결과 경부선(MG03, 서울-부산) 그룹은 계통이 하나만 남아 KTX 방식의 평면
 *   노선으로 되돌아간다 — 예전 "무궁화-경부선" 대표+자식 구조는 사라진다.
 * - 동해선(동대구-포항, 옛 MG13)이 "대구선"이라는 별도 group_name으로 분리됐다 —
 *   동해선 그룹은 이제 MG12(동대구-부전)·MG14(부전~포항) 두 계통만 남는다.
 * - 경부선·전라선·영동선 역 순서/목록 일부 수정, 경전선 등 나머지는 pattern_stops
 *   파일을 다시 읽으면 자동 반영되므로 이 파일에서 손댈 것은 없다.
 */

import type { LineDefinition } from './types'

export const MUGUNGHWA_SOURCE_ID = 'SRC-MUGUNGHWA-PATTERNS'

/** 무궁화호 전용 pseudo-region — KTX/SRT와는 별도 region이라 자동 병합되지 않는다. */
export const MUGUNGHWA_REGION_CODE = 'MUGUNGHWA'

const ICON_LABEL = '무궁화'

export const MUGUNGHWA_LINE_DEFINITIONS: LineDefinition[] = [
  // MG01/MG20 충북선 — MG01(동대구-영주)을 대표로 삼는다(패턴 파일에 먼저 나옴).
  // 옛 "경부선(서울-제천)"(MG02)을 대체하는 MG20(서울-영주)이 자식이다.
  { rawLabel: 'MG01', lineCode: 'MG-CHUNGBUK', officialName: '무궁화호 충북선(동대구-영주)', displayName: '충북선', stationListLabel: '동대구-영주', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'MUGUNGHWA', aliases: ['충북선'], sortOrder: 700 },
  { rawLabel: 'MG20', lineCode: 'MG-CHUNGBUK-SEOUL', officialName: '무궁화호 충북선(서울-영주)', displayName: '서울-영주', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'MUGUNGHWA', parentLineCode: 'MG-CHUNGBUK', suppressBranchTag: true, aliases: ['충북선'], sortOrder: 701 },

  // MG03 경부선 — 이제 계통이 하나뿐이라 KTX와 같은 평면 노선이다.
  { rawLabel: 'MG03', lineCode: 'MG-GYEONGBU', officialName: '무궁화호 경부선', displayName: '경부선', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'MUGUNGHWA', aliases: ['경부선'], sortOrder: 702 },

  // MG04 장항선 — 단일 계통
  { rawLabel: 'MG04', lineCode: 'MG-JANGHANG', officialName: '무궁화호 장항선', displayName: '장항선', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'MUGUNGHWA', aliases: ['장항선'], sortOrder: 703 },

  // MG05 전라선 — 단일 계통
  { rawLabel: 'MG05', lineCode: 'MG-JEOLLA', officialName: '무궁화호 전라선', displayName: '전라선', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'MUGUNGHWA', aliases: ['전라선'], sortOrder: 704 },

  // MG06/07/08 호남선 — MG06(용산-광주)을 대표로 삼는다
  { rawLabel: 'MG06', lineCode: 'MG-HONAM', officialName: '무궁화호 호남선(용산-광주)', displayName: '호남선', stationListLabel: '용산-광주', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'MUGUNGHWA', aliases: ['호남선'], sortOrder: 705 },
  { rawLabel: 'MG07', lineCode: 'MG-HONAM-MOKPO', officialName: '무궁화호 호남선(용산-목포)', displayName: '용산-목포', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'MUGUNGHWA', parentLineCode: 'MG-HONAM', suppressBranchTag: true, aliases: ['호남선'], sortOrder: 706 },
  { rawLabel: 'MG08', lineCode: 'MG-HONAM-GWANGJU-MOKPO', officialName: '무궁화호 호남선(광주-목포)', displayName: '광주-목포', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'MUGUNGHWA', parentLineCode: 'MG-HONAM', suppressBranchTag: true, aliases: ['호남선'], sortOrder: 707 },

  // MG09 중앙선 — 단일 계통
  { rawLabel: 'MG09', lineCode: 'MG-JUNGANG', officialName: '무궁화호 중앙선', displayName: '중앙선', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'MUGUNGHWA', aliases: ['중앙선'], sortOrder: 708 },

  // MG10 태백선 — 단일 계통
  { rawLabel: 'MG10', lineCode: 'MG-TAEBAEK', officialName: '무궁화호 태백선', displayName: '태백선', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'MUGUNGHWA', aliases: ['태백선'], sortOrder: 709 },

  // MG11 영동선 — 단일 계통
  { rawLabel: 'MG11', lineCode: 'MG-YEONGDONG', officialName: '무궁화호 영동선', displayName: '영동선', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'MUGUNGHWA', aliases: ['영동선'], sortOrder: 710 },

  // MG12/14 동해선 — MG12(동대구-부전)를 대표로 삼는다. 옛 자식 MG13(동대구-포항)은
  // "대구선"이라는 별도 group_name으로 독립했다(아래).
  //
  // 예외: 다른 12개와 달리 "무궁화-" 접두어를 그대로 남긴다 — 부산 광역전철에
  // 이미 별개의 "동해선"(KR-DONGHAE, nationalLineDefinitions.ts)이 있고, 실제로
  // 기장·남창·부전·센텀·신해운대·태화강 6개 역에서 두 "동해선"이 물리적으로
  // 같은 역을 공유해(이미 병합됨) 접두어를 떼면 그 역들의 검색 결과에 이름이
  // 똑같은 배지가 색만 다른 채로 두 개 뜬다. 2026-09-16 확인 필요 사항으로
  // 발견해 이 한 그룹만 접두어를 유지하기로 했다.
  { rawLabel: 'MG12', lineCode: 'MG-DONGHAE', officialName: '무궁화호 동해선(동대구-부전)', displayName: '무궁화-동해선', stationListLabel: '동대구-부전', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'MUGUNGHWA', aliases: ['동해선'], sortOrder: 711 },
  { rawLabel: 'MG14', lineCode: 'MG-DONGHAE-BUJEON-POHANG', officialName: '무궁화호 동해선(부전~포항)', displayName: '부전~포항', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'MUGUNGHWA', parentLineCode: 'MG-DONGHAE', suppressBranchTag: true, aliases: ['동해선'], sortOrder: 712 },

  // MG13 대구선 — 동해선에서 분리된 별도 그룹. 단일 계통(평면 노선).
  { rawLabel: 'MG13', lineCode: 'MG-DAEGUSEON', officialName: '무궁화호 대구선', displayName: '대구선', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'MUGUNGHWA', aliases: ['대구선'], sortOrder: 713 },

  // MG15/16/17 경전선 — MG15(동대구-진주)를 대표로 삼는다
  { rawLabel: 'MG15', lineCode: 'MG-GYEONGJEON', officialName: '무궁화호 경전선(동대구-진주)', displayName: '경전선', stationListLabel: '동대구-진주', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'MUGUNGHWA', aliases: ['경전선'], sortOrder: 714 },
  { rawLabel: 'MG16', lineCode: 'MG-GYEONGJEON-BUJEON-MOKPO', officialName: '무궁화호 경전선(부전-목포)', displayName: '부전-목포', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'MUGUNGHWA', parentLineCode: 'MG-GYEONGJEON', suppressBranchTag: true, aliases: ['경전선'], sortOrder: 715 },
  { rawLabel: 'MG17', lineCode: 'MG-GYEONGJEON-SUNCHEON-GWANGJUSONGJEONG', officialName: '무궁화호 경전선(순천-광주송정)', displayName: '순천-광주송정', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'MUGUNGHWA', parentLineCode: 'MG-GYEONGJEON', suppressBranchTag: true, aliases: ['경전선'], sortOrder: 716 },

  // MG18 경북선 — 단일 계통
  { rawLabel: 'MG18', lineCode: 'MG-GYEONGBUK', officialName: '무궁화호 경북선', displayName: '경북선', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'MUGUNGHWA', aliases: ['경북선'], sortOrder: 717 },

  // MG19 교외선 — 단일 계통
  { rawLabel: 'MG19', lineCode: 'MG-GYOE', officialName: '무궁화호 교외선', displayName: '교외선', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'MUGUNGHWA', aliases: ['교외선'], sortOrder: 718 },
]
