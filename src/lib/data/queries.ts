/**
 * SQLite 조회 SQL 모음. Node(node:sqlite, 스크립트/테스트용)와 Tauri
 * 프런트엔드(@tauri-apps/plugin-sql) 양쪽에서 그대로 재사용한다.
 */

/** region_code 목록으로 범위를 좁힌 StationLine 조회. 필터가 없으면 전체. */
export const STATION_LINE_QUERY = `
  SELECT
    sl.station_line_id      AS station_line_id,
    sl.station_id           AS station_id,
    sl.line_id              AS line_id,
    sl.display_station_name AS display_station_name,
    sl.is_express_stop      AS is_express_stop,
    sl.is_active            AS sl_is_active,
    sl.sequence             AS sequence,
    s.official_name         AS station_official_name,
    s.normalized_name       AS station_normalized_name,
    s.initials              AS station_initials,
    s.sub_name              AS sub_name,
    s.region_code           AS region_code,
    s.is_active             AS station_is_active,
    l.line_code             AS line_code,
    l.official_name         AS line_official_name,
    l.display_name          AS line_display_name,
    l.icon_label            AS line_icon_label,
    l.train_service_code    AS line_train_service_code,
    l.line_number           AS line_number,
    l.operator_code         AS operator_code,
    l.region_code           AS line_region_code,
    l.color_hex             AS color_hex,
    l.text_color_hex        AS text_color_hex,
    l.parent_line_id        AS line_parent_line_id,
    l.station_list_label    AS line_station_list_label,
    l.suppress_branch_tag   AS line_suppress_branch_tag,
    l.is_active             AS line_is_active,
    l.sort_order            AS line_sort_order
  FROM station_line sl
  JOIN station s ON s.station_id = sl.station_id
  JOIN line l ON l.line_id = sl.line_id
`

export const STATION_ALIAS_QUERY = `SELECT station_id, normalized_alias FROM station_alias`
export const LINE_ALIAS_QUERY = `SELECT line_id, normalized_alias FROM line_alias`

export const SCOPE_OPTION_QUERY = `
  SELECT scope_code, kind, name_ko, status, sort_order, region_code, train_service_code
  FROM scope_option
  ORDER BY sort_order ASC
`

/** 특정 운행 범위(region_code)에 실제로 존재하는 노선 목록. "노선 선택" 드롭다운용. */
export const LINES_BY_REGION_QUERY = `
  SELECT line_id, line_code, official_name, display_name, icon_label, line_number, operator_code,
         region_code, train_service_code, color_hex, text_color_hex, is_active, sort_order
  FROM line
  WHERE region_code = ? AND is_active = 1
  ORDER BY sort_order ASC
`
