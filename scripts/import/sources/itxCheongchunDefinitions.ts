/**
 * data/raw/itx_cheongchun/{cheongchun_stations,itx_cheongchun_pattern_stops}.csv
 * 원본을 다루기 위한 노선 정의(확장 32, ITX-청춘 추가).
 *
 * ITX-청춘(용산~춘천)은 수도권 전철 경춘선의 선로와 역을 공용한다(사용자 확인:
 * "기존 수도권 경춘선을 공용으로 사용하는 노선임"). 그래서 별도 pseudo-region을 두지
 * 않고 서울·수도권 region("SEOUL_METRO")에 그대로 둔다 — "같은 region + 같은 역명"
 * 자동 병합만으로 경춘선의 같은 역(상봉·퇴계원·사릉·평내호평·마석·청평·가평·백양리·
 * 강촌·남춘천·춘천)은 물론 용산·옥수·왕십리·청량리처럼 1호선·경의중앙선 등과 겹치는
 * 역도 기존 환승 그룹에 그대로 합류한다(별도 override 없음). 화면의 ITX 범위 구분은
 * line.train_service_code("ITX")로 하고, 서울·수도권 범위에는 뜨지 않도록 App.tsx가
 * 도시 지역 범위에서는 열차 종류(train_service_code)가 있는 노선을 뺀다.
 *
 * 계통(pattern)이 IC01 하나뿐이라(patterns.csv가 따로 없다) group/토글 구조 없이
 * 평면 노선 하나다. 역 목록은 pattern_stops 파일 순서 그대로다.
 *
 * 이름·아이콘: "ITX-청춘", 아이콘 "청춘"(게임 화면의 ITX-청춘 아이콘 글자).
 *
 * 색상: 이전에 제공된 이미지의 색을 쓰되 ITX-새마을-경전(#009BCD)과 구분되게 했다
 * — 게임 화면의 ITX-청춘 아이콘(#1AA4C8)은 경전선 청록과 거의 같아 헷갈린다는
 * 사용자 지적("경전선이랑 색이 비슷한 것 같은데, 차별점 필요해보임")에 따라, 같은
 * 노선이 그려진 Railmap 전국 노선도의 경춘선 색(#34A944, 초록)을 썼다.
 * data/reference/rail-line-colors-source.json 참고.
 */

import type { LineDefinition } from './types'

export const ITX_CHEONGCHUN_SOURCE_ID = 'SRC-ITX-CHEONGCHUN-PATTERNS'

/** 경춘선과 같은 서울·수도권 region — 역 마스터가 경춘선 역을 공용하므로 자동 병합된다. */
export const ITX_CHEONGCHUN_REGION_CODE = 'SEOUL_METRO'

export const ITX_CHEONGCHUN_LINE_DEFINITIONS: LineDefinition[] = [
  // ITX-청춘은 게임 화면에서도 ITX 범위의 첫 노선이라 새마을(800번대)보다 앞에 둔다.
  { rawLabel: 'IC01', lineCode: 'ITX-CHEONGCHUN', officialName: 'ITX-청춘 (용산-춘천)', displayName: 'ITX-청춘', iconLabel: '청춘', lineNumber: null, operatorCode: 'KR', regionCode: ITX_CHEONGCHUN_REGION_CODE, trainServiceCode: 'ITX', aliases: ['청춘', '경춘선', 'ITX'], sortOrder: 790 },
]
