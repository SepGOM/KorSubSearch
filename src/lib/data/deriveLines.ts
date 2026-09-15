import type { LineRecord, StationLineRecord } from '../search/types'

/** station_line 레코드들에서 중복 없는 노선 목록을 뽑아 정렬 순서대로 정렬한다. */
export function deriveLines(records: StationLineRecord[]): LineRecord[] {
  const byId = new Map<string, LineRecord>()
  for (const r of records) {
    if (!byId.has(r.line.lineId)) byId.set(r.line.lineId, r.line)
  }
  return [...byId.values()].sort((a, b) => a.sortOrder - b.sortOrder)
}

export function deriveLinesForRegion(records: StationLineRecord[], regionCode: string): LineRecord[] {
  // station.regionCode가 아니라 line.regionCode로 걸러야 한다 — 환승역처럼 한
  // 역에 서로 다른 범위(예: 도시 지역 + KTX)의 노선이 함께 붙어 있을 수 있다.
  return deriveLines(records.filter((r) => r.line.regionCode === regionCode))
}

/**
 * "노선 선택" 버튼 목록에 실제로 올릴 노선만 남긴다 — 지선(parentLineId가 있는
 * 노선, 예: 경춘선의 망우선)은 독립적으로 고를 수 있는 노선이 아니라 본선을
 * 고르면 자동으로 함께 나오는 패널이라 여기서는 뺀다(사용자 확인).
 */
export function deriveSelectableLines(records: StationLineRecord[]): LineRecord[] {
  return deriveLines(records).filter((line) => line.parentLineId === null)
}

/**
 * 주어진 노선의 지선들(parentLineId가 이 노선을 가리키는 노선)을 정렬 순서대로
 * 반환한다. "이 노선의 역 보기"에서 본선 패널 아래에 지선 패널을 추가로
 * 보여줄 때 쓴다.
 */
export function deriveChildLines(records: StationLineRecord[], parentLineId: string): LineRecord[] {
  return deriveLines(records).filter((line) => line.parentLineId === parentLineId)
}

/**
 * 주어진 노선 아래로 이어지는 모든 지선을 직계뿐 아니라 몇 단계든 재귀적으로
 * 모아 정렬 순서대로 반환한다("지선의 지선" — 예: 1호선의 경부/장항선 지선
 * 안에서 다시 갈라지는 경부고속선·병점기지선, 사용자 확인: "경부/장항선이
 * 구로<->신창 구간이야"). 본선을 고르면 이 모든 하위 지선 패널이 한꺼번에
 * 나와야 하므로, 자식만 보는 deriveChildLines()로는 손자뻘 지선(경부고속선 등)이
 * "노선 선택"에도 없고 부모(경부/장항선)도 선택 불가능해 화면에서 아예 닿을
 * 방법이 없어진다 — 너비 우선(BFS)으로 부모→자식→손자 순서를 유지한다.
 */
export function deriveDescendantLines(records: StationLineRecord[], rootLineId: string): LineRecord[] {
  const all = deriveLines(records)
  const result: LineRecord[] = []
  const queue: string[] = [rootLineId]
  while (queue.length > 0) {
    const parentId = queue.shift()!
    const children = all.filter((line) => line.parentLineId === parentId)
    for (const child of children) {
      result.push(child)
      queue.push(child.lineId)
    }
  }
  return result
}
