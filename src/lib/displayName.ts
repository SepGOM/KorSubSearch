import { stripStationSuffix, splitParenthetical } from './normalize/text'

/**
 * 자동완성 등 화면에 역명을 표시할 때 "역" 접미사를 없애되, 접미사를 떼면
 * 오히려 어색하거나 다른 뜻으로 읽히는 이름은 예외로 그대로 둔다.
 * (사용자 확인: "서울역"·"부산역"·"대구역"·"동대구역"·"대전역"·"서대구역"은 접미사를 떼지 않는다.)
 */
const SUFFIX_DISPLAY_EXCEPTIONS = new Set(['서울역', '부산역', '대구역', '동대구역', '대전역', '서대구역'])

/**
 * 괄호 안 부역명을 화면 표시에서도 떼되, 실제로 부역명까지 붙여 부르는 게
 * 관행인 역은 예외로 그대로 둔다.
 * (사용자 확인: "쌍용(나사렛대)"·"총신대입구(이수)"는 부역명을 남긴다. 그 외
 * 전국 역은 부역명을 뗀다 — 예: "봉황(김해여객터미널)역" → "봉황".)
 * "김천(구미)"·"울산(통도사)"도 사용자 확인: KTX/SRT 역명 안내에서 부역명까지
 * 함께 쓰는 관행이라 부역명을 남긴다.
 *
 * "이수(총신대입구)역"은 7호선 원본 자체의 표기다(2026-09-14, 4호선은 여전히
 * "총신대입구(이수)") — 같은 역인데 노선마다 본역명·부역명 순서가 반대다.
 * 병합 그룹의 대표 이름(검색·그룹 제목용)은 "총신대입구(이수)역"으로 그대로
 * 두고(사용자 확인: "총신대입구(이수) 역이 메인으로 지정 및 검색되도록"), 4호선/
 * 7호선을 각각 볼 때는 그 노선이 실제로 쓰는 표기가 나와야 하므로("노선별 취급
 * 하는 역명으로 표기") 이 목록에 두 표기를 모두 넣어 어느 쪽이든 부역명이
 * 잘리지 않게 한다.
 *
 * import 스크립트(scripts/import/run-import.ts)도 이 목록을 그대로 가져다 써서,
 * 여기 남긴 부역명은 station_alias에도 SUB_NAME으로 등록되어 검색된다(사용자
 * 확인: "부역명을 존치하기로 한 역은 그 부역명으로도 검색되게 해달라") — 화면
 * 표시 예외 목록과 검색 가능 여부가 이 한 곳에서 함께 정해진다.
 */
export const SUB_NAME_DISPLAY_EXCEPTIONS = new Set([
  '쌍용(나사렛대)역',
  '총신대입구(이수)역',
  '이수(총신대입구)역',
  '김천(구미)역',
  '울산(통도사)역',
])

export function formatStationDisplayName(officialName: string): string {
  const withoutSubName = SUB_NAME_DISPLAY_EXCEPTIONS.has(officialName)
    ? officialName
    : splitParenthetical(officialName).main

  if (SUFFIX_DISPLAY_EXCEPTIONS.has(withoutSubName)) return withoutSubName
  return stripStationSuffix(withoutSubName)
}
