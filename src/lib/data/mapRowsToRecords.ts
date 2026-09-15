/**
 * SQL 조회 결과(평탄한 행)를 검색 엔진이 쓰는 StationLineRecord[] 로 변환한다.
 * DB 접근 방식(node:sqlite / @tauri-apps/plugin-sql)과 무관한 순수 함수다.
 */

import { normalizeForCompare } from '../normalize/text'
import type { StationLineRecord } from '../search/types'

export interface StationLineRow {
  station_line_id: string
  station_id: string
  line_id: string
  display_station_name: string
  is_express_stop: number
  sl_is_active: number
  sequence: number | null
  station_official_name: string
  station_normalized_name: string
  station_initials: string
  sub_name: string | null
  region_code: string
  station_is_active: number
  line_code: string
  line_official_name: string
  line_display_name: string
  line_icon_label: string
  line_train_service_code: string | null
  line_number: number | null
  operator_code: string
  line_region_code: string
  color_hex: string | null
  text_color_hex: string | null
  line_parent_line_id: string | null
  line_station_list_label: string | null
  line_suppress_branch_tag: number
  line_is_active: number
  line_sort_order: number
}

export interface AliasRow {
  station_id?: string
  line_id?: string
  normalized_alias: string
}

export function mapRowsToRecords(
  rows: StationLineRow[],
  stationAliasRows: AliasRow[],
  lineAliasRows: AliasRow[],
): StationLineRecord[] {
  const stationAliasesById = new Map<string, string[]>()
  for (const a of stationAliasRows) {
    if (!a.station_id) continue
    const list = stationAliasesById.get(a.station_id) ?? []
    list.push(a.normalized_alias)
    stationAliasesById.set(a.station_id, list)
  }

  const lineAliasesById = new Map<string, string[]>()
  for (const a of lineAliasRows) {
    if (!a.line_id) continue
    const list = lineAliasesById.get(a.line_id) ?? []
    list.push(a.normalized_alias)
    lineAliasesById.set(a.line_id, list)
  }

  return rows.map((row) => ({
    stationLineId: row.station_line_id,
    stationId: row.station_id,
    displayStationName: row.display_station_name,
    officialStationName: row.station_official_name,
    normalizedStationName: row.station_normalized_name,
    stationInitials: row.station_initials,
    subName: row.sub_name,
    sequence: row.sequence,
    regionCode: row.region_code,
    stationIsActive: !!row.station_is_active,
    isExpressStop: !!row.is_express_stop,
    isActive: !!row.sl_is_active,
    aliases: stationAliasesById.get(row.station_id) ?? [],
    line: {
      lineId: row.line_id,
      lineCode: row.line_code,
      officialName: row.line_official_name,
      displayName: row.line_display_name,
      iconLabel: row.line_icon_label,
      trainServiceCode: row.line_train_service_code,
      normalizedName: normalizeForCompare(row.line_official_name),
      lineNumber: row.line_number,
      operatorCode: row.operator_code,
      regionCode: row.line_region_code,
      colorHex: row.color_hex,
      textColorHex: row.text_color_hex,
      parentLineId: row.line_parent_line_id,
      stationListLabel: row.line_station_list_label,
      suppressBranchTag: !!row.line_suppress_branch_tag,
      isActive: !!row.line_is_active,
      sortOrder: row.line_sort_order,
      aliases: lineAliasesById.get(row.line_id) ?? [],
    },
  }))
}
