/**
 * data/reference/rail-line-colors-source.json (수동으로 확인해 둔 출처 스냅샷)을 읽어
 * data/reference/rail-line-colors.csv 를 생성한다.
 *
 * 규칙(9장):
 * - 앱 실행 중에는 절대 외부 페이지를 호출하지 않는다. 이 스크립트도 네트워크를
 *   호출하지 않고, 사람이 위키백과 문서를 확인해 미리 옮겨 둔 로컬 JSON만 읽는다.
 * - 색상은 #RRGGBB 대문자로 정규화한다.
 * - 누락된 색상은 임의 값으로 채우지 않는다 (여기서는 seed 자체에 값이 없으면 실패시킨다).
 * - 같은 line_code 에 다른 색이 있으면 오류로 처리한다.
 * - WCAG 명암비를 계산해 글자색(#000000/#FFFFFF)을 정한다.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeHexColor, pickReadableTextColor } from '../../src/lib/color'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
const SOURCE_PATH = resolve(ROOT, 'data/reference/rail-line-colors-source.json')
const OUTPUT_PATH = resolve(ROOT, 'data/reference/rail-line-colors.csv')

interface SourceMeta {
  source_id: string
  source_name: string
  source_url: string
  source_revision: string | null
  retrieved_at: string
}

interface SourceEntry {
  source_id: string
  scope_code: string
  operator_code: string
  line_code: string
  line_name: string
  color_hex: string
  notes: string
}

interface SourceFile {
  /** 색상 근거가 두 곳 이상일 수 있어(위키백과, 사용자가 지정한 참고 사이트 등)
   * 출처를 배열로 두고, 각 entry가 source_id로 자신의 출처를 가리킨다. */
  sources: SourceMeta[]
  entries: SourceEntry[]
}

const CSV_COLUMNS = [
  'scope_code',
  'operator_code',
  'line_code',
  'line_name',
  'color_hex',
  'text_color_hex',
  'source_name',
  'source_url',
  'source_revision',
  'verified_at',
  'notes',
] as const

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function generateLineColorsCsv(): { rows: number; outputPath: string } {
  const raw = readFileSync(SOURCE_PATH, 'utf-8')
  const data = JSON.parse(raw) as SourceFile

  const sourceById = new Map(data.sources.map((s) => [s.source_id, s]))

  const seenLineCodes = new Map<string, string>()
  const lines: string[] = [CSV_COLUMNS.join(',')]

  for (const entry of data.entries) {
    const normalizedColor = normalizeHexColor(entry.color_hex)
    if (!normalizedColor) {
      throw new Error(`유효하지 않은 HEX 색상: ${entry.line_code} = ${entry.color_hex}`)
    }

    const source = sourceById.get(entry.source_id)
    if (!source) {
      throw new Error(`존재하지 않는 source_id: ${entry.line_code} → ${entry.source_id}`)
    }

    const previous = seenLineCodes.get(entry.line_code)
    if (previous && previous !== normalizedColor) {
      throw new Error(
        `line_code 충돌: ${entry.line_code} 에 서로 다른 색상 ${previous} / ${normalizedColor}`,
      )
    }
    seenLineCodes.set(entry.line_code, normalizedColor)

    const textColor = pickReadableTextColor(normalizedColor)

    const row = [
      entry.scope_code,
      entry.operator_code,
      entry.line_code,
      entry.line_name,
      normalizedColor,
      textColor,
      source.source_name,
      source.source_url,
      source.source_revision ?? '',
      source.retrieved_at,
      entry.notes ?? '',
    ]
    lines.push(row.map((v) => csvEscape(String(v))).join(','))
  }

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(OUTPUT_PATH, lines.join('\n') + '\n', 'utf-8')

  return { rows: data.entries.length, outputPath: OUTPUT_PATH }
}

// 스크립트로 직접 실행될 때만 파일을 생성한다 (테스트에서 함수만 import 할 수 있도록).
if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const { rows, outputPath } = generateLineColorsCsv()
  console.log(`✅ 노선 색상 CSV 생성 완료: ${rows}행 → ${outputPath}`)
}
