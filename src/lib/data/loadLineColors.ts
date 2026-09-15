/**
 * data/reference/rail-line-colors.csv 로더 + 검증.
 * 앱은 이 CSV를 로컬에서만 읽는다 (실행 중 외부 호출 없음).
 */

import { parse } from 'csv-parse/sync'
import { isValidHexColor } from '../color'

export interface LineColorRow {
  scope_code: string
  operator_code: string
  line_code: string
  line_name: string
  color_hex: string
  text_color_hex: string
  source_name: string
  source_url: string
  source_revision: string
  verified_at: string
  notes: string
}

export interface LineColorValidationError {
  line_code: string
  message: string
}

export function parseLineColorsCsv(csvContent: string): LineColorRow[] {
  const rows = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
  }) as LineColorRow[]
  return rows
}

/**
 * 검증 규칙(9장, 11장):
 * - HEX 형식이 올바른가 (#RRGGBB)
 * - text_color_hex 가 #000000 또는 #FFFFFF 인가
 * - 같은 line_code 에 서로 다른 color_hex 가 있는가 (충돌)
 * - 필수 컬럼(line_code, color_hex, source_url)이 비어 있지 않은가
 */
export function validateLineColors(rows: LineColorRow[]): LineColorValidationError[] {
  const errors: LineColorValidationError[] = []
  const colorByLineCode = new Map<string, string>()

  for (const row of rows) {
    if (!row.line_code) {
      errors.push({ line_code: '(없음)', message: 'line_code 가 비어 있음' })
      continue
    }
    if (!isValidHexColor(row.color_hex)) {
      errors.push({ line_code: row.line_code, message: `유효하지 않은 color_hex: ${row.color_hex}` })
    }
    if (row.text_color_hex !== '#000000' && row.text_color_hex !== '#FFFFFF') {
      errors.push({ line_code: row.line_code, message: `text_color_hex 는 #000000/#FFFFFF 만 허용: ${row.text_color_hex}` })
    }
    if (!row.source_url) {
      errors.push({ line_code: row.line_code, message: '출처 URL(source_url)이 비어 있음' })
    }

    const existing = colorByLineCode.get(row.line_code)
    if (existing && existing !== row.color_hex) {
      errors.push({
        line_code: row.line_code,
        message: `같은 line_code 에 서로 다른 색상: ${existing} vs ${row.color_hex}`,
      })
    }
    colorByLineCode.set(row.line_code, row.color_hex)
  }

  return errors
}

export function findLineColor(rows: LineColorRow[], lineCode: string): LineColorRow | undefined {
  return rows.find((r) => r.line_code === lineCode)
}
