/**
 * "game_line_stations.csv"(및 그 짝인 game_line_patterns.csv) 원본을 다루기 위한
 * 노선 정의. 이 원본은 이전(2026-09-07 세션)에 썼던 "한국철도공사_KTX 노선별
 * 역정보" 단순 CSV(노선명+순번만 있는 평면 목록)를 완전히 대체한다 — 그 원본은
 * "경부선" 하나에 포항 지선(현재는 별도 "동해선" 패턴)까지 섞여 있는 등 실제
 * 운행계통(패턴)을 정확히 반영하지 못했다.
 *
 * 새 원본은 "게임 UI 노선 버튼"(game_line, 9개: 경부선/호남선/전라선/강릉선/
 * 중앙선/동해선/동해선 전구간/경전선/중부내륙선) × "출발 계열"(origin_type:
 * KTX=서울·용산발, SRT=수서발)로 역을 구분한다.
 *
 * 2026-09-16(2차) 사용자 확인: "KTX 노선 SRT 노선 병합... SRT 명도 KTX로 통합."
 * — 화면에는 더 이상 "SRT"라는 브랜드 이름이 보이지 않는다. rawLabel(원본 조인
 * 키)·lineCode·operatorCode는 여전히 KTX/SRT를 구분해서 관리하지만(그래야 기존
 * override·색상 매핑이 안 깨진다), 사용자에게 보이는 displayName·iconLabel은 전부
 * "KTX"로 통일했다. 다만 같은 game_line(경부·호남·전라·경전·동해)은 여전히
 * 서로 다른 두 실제 열차(행신/서울·용산발 vs 수서발)를 가리키므로, "노선 선택"
 * 안에서 이름이 겹치지 않도록 착발 구분을 접미어로 붙인다(괄호 없이 하이픈으로:
 * "KTX-경부-행신착발" / "KTX-경부-수서착발" — 사용자 확인: "괄호는 빼줘",
 * "착발 구분은 행신 착발 / 수서 착발으로"). 겹칠 상대가 없는 나머지 4개
 * (강릉·중앙·동해[옛 "동해선 전구간"]·중부내륙)는 접미어 없이 그대로 둔다.
 * "동해"는 특히 주의가 필요하다 — SRT의 "동해"는 실제로는 (구)"KTX-동해"
 * (경부선 경유, 포항까지, 확장 27에서 "KTX-경부-동해"로 개칭됨)와 같은 계통이고,
 * "KTX-동해"(전구간, 부전~강릉)와는 다른 계통이라 SRT 쪽은 "KTX-경부-동해"
 * 기준으로 착발 접미어를 붙인다.
 *
 * KTX와 SRT는 실제로 같은 물리적 역(예: 대전역, 동대구역)을 공유하므로 같은
 * pseudo-region("KTX")을 쓴다 — 그래야 "같은 region + 같은 역명" 자동 병합으로
 * 두 브랜드의 station_line이 하나의 station으로 자동으로 합쳐진다(별도 override
 * 없이). trainServiceCode도 이제 둘 다 "KTX"로 통일해 "운행 범위 선택"에
 * "SRT" 버튼이 따로 뜨지 않는다(run-import.ts 참고) — "수서착발"이라는 사실은
 * 화면에서 노선 이름 자체로 구분한다.
 *
 * 노선 분류·배지 색상은 여전히 사용자가 지정한 참고 사이트(metrotyping.kr)를
 * 따랐다 — 옛 SRT 색상(보라 계열)은 lineCode가 그대로라 색상 매핑도 그대로
 * 유지된다. data/reference/rail-line-colors-source.json 참고.
 *
 * 2026-09-15 사용자 확인("노선 구분 시 수서 및 행신 착발 노선에 대해서 그룹화
 * 하는건 어때?"): 배열 순서(sortOrder)를 옛 "KTX 9개 먼저 → SRT 5개 나중"에서
 * "같은 계통의 행신착발/수서착발을 서로 붙여서" 재배열했다 — LineSelector.tsx가
 * 이 인접성을 이용해 두 착발을 하나의 캡슐로 묶어 그린다(프론트 전용 시각적
 * 그룹화 — 데이터 모델은 여전히 flat한 14개 라인 그대로다). 곧바로 이어진 추가
 * 확인("KTX 노선 재정렬 필요성. 가독성이 좋지 않음")에 따라 순서를 한 번 더
 * 다듬었다 — 착발 짝이 있는 5개(경부·호남·전라·경부-동해·경전, 캡슐)를 모두
 * 앞으로, 짝이 없는 4개(강릉·중앙·동해·중부내륙, 단독 pill)를 모두 뒤로 몰아
 * "노선 선택" 목록이 캡슐 구간과 단독 구간 두 덩어리로 깔끔하게 나뉜다.
 */

import type { LineDefinition } from './types'

export const KTX_SOURCE_ID = 'SRC-KTX-SRT-GAME-LINES'

/** KTX/SRT 공용 region_code — 도시 지역이 아니라 고속철도 전용 pseudo-region. */
export const KTX_REGION_CODE = 'KTX'

/**
 * rawLabel은 `${game_line}|${origin_type}` 형식으로 짓는다 — 같은 game_line
 * 문자열("경부선" 등)이 KTX/SRT 두 origin_type에 걸쳐 재사용되므로 그 자체로는
 * 노선을 유일하게 특정할 수 없기 때문이다(ktxGameLineSource.ts 참고).
 */
export const KTX_GAME_LINE_DEFINITIONS: LineDefinition[] = [
  // operatorCode/lineCode는 내부적으로 여전히 KTX/SRT 계열로 나뉘어 있다(색상·
  // override 매핑 유지용) — 화면에 보이는 이름·아이콘만 "KTX"로 통일했다.
  //
  // 2026-09-15 추가 사용자 확인("KTX 노선 재정렬 필요성. 가독성이 좋지 않음"):
  // "행신착발 바로 다음에 그 짝인 수서착발"로만 짝지어 뒀던 첫 시도(확장 29
  // 1차)는 캡슐(넓음)과 단독 pill(좁음)이 화면에서 불규칙하게 섞여 오히려
  // 스캔하기 어려웠다 — 착발 짝이 있는 5개(경부·호남·전라·경부-동해·경전,
  // 캡슐로 묶임)를 앞으로 몰고, 짝이 없는 4개(강릉·중앙·동해·중부내륙, 단독
  // pill)를 뒤로 몰아 "노선 선택" 목록이 캡슐 구간 → 단독 구간 두 덩어리로
  // 깔끔하게 나뉘도록 다시 정렬했다.
  { rawLabel: '경부선|KTX', lineCode: 'KTX-GYEONGBU', officialName: 'KTX 경부선(서울)', displayName: 'KTX-경부-행신착발', iconLabel: 'KTX', lineNumber: null, operatorCode: 'KR', regionCode: KTX_REGION_CODE, trainServiceCode: 'KTX', aliases: ['경부선'], sortOrder: 500 },
  { rawLabel: '경부선|SRT', lineCode: 'SRT-GYEONGBU', officialName: 'SRT 경부선(수서)', displayName: 'KTX-경부-수서착발', iconLabel: 'KTX', lineNumber: null, operatorCode: 'SRT', regionCode: KTX_REGION_CODE, trainServiceCode: 'KTX', aliases: ['경부선'], sortOrder: 501 },
  { rawLabel: '호남선|KTX', lineCode: 'KTX-HONAM', officialName: 'KTX 호남선(용산)', displayName: 'KTX-호남-행신착발', iconLabel: 'KTX', lineNumber: null, operatorCode: 'KR', regionCode: KTX_REGION_CODE, trainServiceCode: 'KTX', aliases: ['호남선'], sortOrder: 502 },
  { rawLabel: '호남선|SRT', lineCode: 'SRT-HONAM', officialName: 'SRT 호남선(수서)', displayName: 'KTX-호남-수서착발', iconLabel: 'KTX', lineNumber: null, operatorCode: 'SRT', regionCode: KTX_REGION_CODE, trainServiceCode: 'KTX', aliases: ['호남선'], sortOrder: 503 },
  { rawLabel: '전라선|KTX', lineCode: 'KTX-JEOLLA', officialName: 'KTX 전라선(용산)', displayName: 'KTX-전라-행신착발', iconLabel: 'KTX', lineNumber: null, operatorCode: 'KR', regionCode: KTX_REGION_CODE, trainServiceCode: 'KTX', aliases: ['전라선'], sortOrder: 504 },
  { rawLabel: '전라선|SRT', lineCode: 'SRT-JEOLLA', officialName: 'SRT 전라선(수서)', displayName: 'KTX-전라-수서착발', iconLabel: 'KTX', lineNumber: null, operatorCode: 'SRT', regionCode: KTX_REGION_CODE, trainServiceCode: 'KTX', aliases: ['전라선'], sortOrder: 505 },
  // 2026-09-16 1차 사용자 확인: "KTX-동해 > KTX-경부-동해 명칭 변경", "KTX-동해
  // (전구간) > KTX-동해 명칭 변경" — 경부선을 경유해 포항까지만 가는 쪽이
  // "KTX-경부-동해", 부전~강릉 전 구간을 잇는 쪽이 "KTX-동해"다. SRT의
  // "동해"(수서발, 포항까지)는 전자와 같은 계통이라 아래에서 "KTX-경부-동해"
  // 기준으로 착발 접미어를 붙인다.
  { rawLabel: '동해선|KTX', lineCode: 'KTX-DONGHAE', officialName: 'KTX 동해선(포항)', displayName: 'KTX-경부-동해-행신착발', iconLabel: 'KTX', lineNumber: null, operatorCode: 'KR', regionCode: KTX_REGION_CODE, trainServiceCode: 'KTX', aliases: ['동해선'], sortOrder: 506 },
  { rawLabel: '동해선|SRT', lineCode: 'SRT-DONGHAE', officialName: 'SRT 동해선(포항)', displayName: 'KTX-경부-동해-수서착발', iconLabel: 'KTX', lineNumber: null, operatorCode: 'SRT', regionCode: KTX_REGION_CODE, trainServiceCode: 'KTX', aliases: ['동해선'], sortOrder: 507 },
  { rawLabel: '경전선|KTX', lineCode: 'KTX-GYEONGJEON', officialName: 'KTX 경전선(서울)', displayName: 'KTX-경전-행신착발', iconLabel: 'KTX', lineNumber: null, operatorCode: 'KR', regionCode: KTX_REGION_CODE, trainServiceCode: 'KTX', aliases: ['경전선'], sortOrder: 508 },
  { rawLabel: '경전선|SRT', lineCode: 'SRT-GYEONGJEON', officialName: 'SRT 경전선(수서)', displayName: 'KTX-경전-수서착발', iconLabel: 'KTX', lineNumber: null, operatorCode: 'SRT', regionCode: KTX_REGION_CODE, trainServiceCode: 'KTX', aliases: ['경전선'], sortOrder: 509 },

  // --- 착발 짝이 없어 단독 pill로 남는 4개. "동해선 전구간"은 SRT 데이터가
  // 없어(사용자 확인) 짝 없이 단독으로 둔다. ---
  { rawLabel: '강릉선|KTX', lineCode: 'KTX-GANGNEUNG', officialName: 'KTX 강릉선', displayName: 'KTX-강릉', iconLabel: 'KTX', lineNumber: null, operatorCode: 'KR', regionCode: KTX_REGION_CODE, trainServiceCode: 'KTX', aliases: ['강릉선'], sortOrder: 510 },
  { rawLabel: '중앙선|KTX', lineCode: 'KTX-JUNGANG', officialName: 'KTX 중앙선', displayName: 'KTX-중앙', iconLabel: 'KTX', lineNumber: null, operatorCode: 'KR', regionCode: KTX_REGION_CODE, trainServiceCode: 'KTX', aliases: ['중앙선'], sortOrder: 511 },
  { rawLabel: '동해선 전구간|KTX', lineCode: 'KTX-DONGHAE-FULL', officialName: 'KTX 동해선(전구간)', displayName: 'KTX-동해', iconLabel: 'KTX', lineNumber: null, operatorCode: 'KR', regionCode: KTX_REGION_CODE, trainServiceCode: 'KTX', aliases: ['동해선 전구간'], sortOrder: 512 },
  { rawLabel: '중부내륙선|KTX', lineCode: 'KTX-JUNGBUNAERYUK', officialName: 'KTX 중부내륙선', displayName: 'KTX-중부내륙', iconLabel: 'KTX', lineNumber: null, operatorCode: 'KR', regionCode: KTX_REGION_CODE, trainServiceCode: 'KTX', aliases: ['중부내륙선'], sortOrder: 513 },
]
