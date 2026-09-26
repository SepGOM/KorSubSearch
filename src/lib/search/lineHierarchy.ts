/**
 * 노선 계층(parentLineId) 조회 도우미. 지선은 "지선의 지선"(1호선 → 경부/장항선 →
 * 경부고속선·병점기지선)처럼 여러 단계로 이어질 수 있어, 배지·검색 키워드·노선 번호
 * 필터처럼 "이 노선의 정체성"이 필요한 곳은 한 단계 위(부모)가 아니라 맨 위(최상위
 * 본선)까지 올라가서 판단해야 한다(사용자 확인: 병점·금천구청에 "1" 배지가 두 개 뜨고,
 * "1 ㅂㅈ"·"1 ㄱㅁ"으로 병점기지선·경부고속선 역이 안 찾아졌다 — 지선일 뿐 환승도, 별개의
 * 노선 번호도 아니다).
 */

import type { LineRecord } from './types'

/** 무한 루프 방지(잘못된 순환 참조가 있어도 이 깊이에서 멈춘다). */
const MAX_DEPTH = 8

/** 지선이면 최상위 본선까지 올라간다. 부모를 못 찾으면 거기서 멈춘다. */
export function rootLine(line: LineRecord, lineById: Map<string, LineRecord>): LineRecord {
  let current = line
  for (let depth = 0; depth < MAX_DEPTH && current.parentLineId; depth++) {
    const parent = lineById.get(current.parentLineId)
    if (!parent) break
    current = parent
  }
  return current
}

/** line이 ancestorLineId 자신이거나 그 아래(몇 단계든)에 속한 지선인지. */
export function isSelfOrDescendantOf(
  line: LineRecord,
  ancestorLineId: string,
  lineById: Map<string, LineRecord>,
): boolean {
  let current: LineRecord | undefined = line
  for (let depth = 0; depth <= MAX_DEPTH && current; depth++) {
    if (current.lineId === ancestorLineId) return true
    // 부모 레코드가 조회용 맵에 없어도(예: 후보군에 본선 레코드가 하나도 없는 역) 부모
    // id가 곧 찾는 노선이면 포함이다.
    if (current.parentLineId === ancestorLineId) return true
    current = current.parentLineId ? lineById.get(current.parentLineId) : undefined
  }
  return false
}
