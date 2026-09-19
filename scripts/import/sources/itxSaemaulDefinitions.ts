/**
 * data/raw/mugunghwa-ITXsaemaul/{itx_saemaul_patterns,itx_saemaul_pattern_stops}.csv
 * 원본을 다루기 위한 노선 정의(확장 31, ITX-새마을 추가).
 *
 * ITX-새마을은 무궁화호와 같은 재래선 역들을 쓰기 때문에, 역 마스터
 * (mugunghwa_stations.csv)를 그대로 재사용한다 — 그래서 원본 폴더도
 * data/raw/mugunghwa → data/raw/mugunghwa-ITXsaemaul로 바뀌었다(사용자 확인:
 * "ITX-새마을이 무궁화호와 같은 재래선 역들을 쓰다 보니 station 마스터를 그대로
 * 재사용하였음. 따라서 일부 파일 경로가 변경되기도 하였음."). 구조와 조인 방식은
 * 무궁화호(mugunghwaDefinitions.ts / mugunghwaSource.ts)와 똑같다: pattern_id 하나가
 * LineDefinition 하나(rawLabel = pattern_id)에 대응하고, group_name이 "노선 선택"
 * 버튼, pattern_name이 그 아래 운행계통 토글이 된다.
 *
 * group_name(4개) 중 계통이 하나뿐인 경부선(IS01)·경전선(IS02)·전라선(IS05)은
 * 평면 노선이고, 호남선만 두 계통(IS03 용산-목포, IS04 용산-광주)이라 먼저 나오는
 * IS03을 대표로 삼고 IS04를 자식으로 둔다(무궁화호 호남선과 똑같은 방식, 자식은
 * suppressBranchTag). 토글박스 이름은 구간만 쓴다("용산-목포"/"용산-광주") —
 * 무궁화호와 같은 규칙(괄호 없음).
 *
 * 이름: "ITX-새마을-경부"처럼 KTX와 같은 "<종류>-<노선>" 형식을 쓴다("선" 생략).
 * 무궁화호 노선도 "무궁화-경부선"처럼 접두어가 있어(확장 33에서 접두어 제거를 롤백),
 * 같은 역에서 나란히 환승 배지로 뜨거나 "전체" 범위에서 섞여 보여도 서로 구분된다.
 * 아이콘은 "새마을"(게임의 ITX-청춘/ITX-마음처럼 배지 글자로 종류를 나타냄).
 *
 * 지역: 무궁화호와 같은 pseudo-region("MUGUNGHWA")을 쓴다 — 역 마스터를 공유하므로
 * "같은 region + 같은 역명" 자동 병합만으로 무궁화호의 같은 역과 하나로 합쳐지고,
 * 기존에 확인해 둔 무궁화호↔KTX/도시철도 환승(station-resolution.csv)도 그대로
 * 이어받는다. 화면에서 무궁화호/ITX를 다른 범위 버튼으로 나누는 건 region이 아니라
 * line.train_service_code("ITX")로 한다(KTX/SRT와 같은 방식, App.tsx 참고).
 *
 * 색상: 사용자 제공 참고 이미지(Railmap "전국 일반여객철도 노선도", 2026.9.1 기준)의
 * 노선 라벨 색을 그대로 옮겼다(사용자 확인: "노선 색상은 이미지 파일 확인해서
 * 사용해도 되고"). data/reference/rail-line-colors-source.json 참고.
 */

import type { LineDefinition } from './types'
import { MUGUNGHWA_REGION_CODE } from './mugunghwaDefinitions'

export const ITX_SAEMAUL_SOURCE_ID = 'SRC-ITX-SAEMAUL-PATTERNS'

const ICON_LABEL = '새마을'

export const ITX_SAEMAUL_LINE_DEFINITIONS: LineDefinition[] = [
  // IS01 경부선(서울-부산) — 단일 계통
  { rawLabel: 'IS01', lineCode: 'ITX-SAEMAUL-GYEONGBU', officialName: 'ITX-새마을 경부선(서울-부산)', displayName: 'ITX-새마을-경부', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'ITX', aliases: ['경부선', '새마을', 'ITX'], sortOrder: 800 },

  // IS02 경전선(서울-진주) — 단일 계통
  { rawLabel: 'IS02', lineCode: 'ITX-SAEMAUL-GYEONGJEON', officialName: 'ITX-새마을 경전선(서울-진주)', displayName: 'ITX-새마을-경전', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'ITX', aliases: ['경전선', '새마을', 'ITX'], sortOrder: 801 },

  // IS03/IS04 호남선 — IS03(용산-목포)을 대표로 삼는다(패턴 파일에 먼저 나옴)
  { rawLabel: 'IS03', lineCode: 'ITX-SAEMAUL-HONAM', officialName: 'ITX-새마을 호남선(용산-목포)', displayName: 'ITX-새마을-호남', stationListLabel: '용산-목포', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'ITX', aliases: ['호남선', '새마을', 'ITX'], sortOrder: 802 },
  { rawLabel: 'IS04', lineCode: 'ITX-SAEMAUL-HONAM-GWANGJU', officialName: 'ITX-새마을 호남선(용산-광주)', displayName: '용산-광주', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'ITX', parentLineCode: 'ITX-SAEMAUL-HONAM', suppressBranchTag: true, aliases: ['호남선', '새마을', 'ITX'], sortOrder: 803 },

  // IS05 전라선(용산-여수엑스포) — 단일 계통
  { rawLabel: 'IS05', lineCode: 'ITX-SAEMAUL-JEOLLA', officialName: 'ITX-새마을 전라선(용산-여수엑스포)', displayName: 'ITX-새마을-전라', iconLabel: ICON_LABEL, lineNumber: null, operatorCode: 'KR', regionCode: MUGUNGHWA_REGION_CODE, trainServiceCode: 'ITX', aliases: ['전라선', '새마을', 'ITX'], sortOrder: 804 },
]
