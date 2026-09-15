/** data/reference/rail-line-colors.csv 를 검증한다. 오류가 있으면 종료 코드 1로 실패시킨다. */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseLineColorsCsv, validateLineColors } from '../../src/lib/data/loadLineColors'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
const CSV_PATH = resolve(ROOT, 'data/reference/rail-line-colors.csv')

const content = readFileSync(CSV_PATH, 'utf-8')
const rows = parseLineColorsCsv(content)
const errors = validateLineColors(rows)

if (errors.length > 0) {
  console.error(`❌ 노선 색상 CSV 검증 실패 (${errors.length}건)`)
  for (const e of errors) {
    console.error(`  - [${e.line_code}] ${e.message}`)
  }
  process.exit(1)
}

console.log(`✅ 노선 색상 CSV 검증 통과: ${rows.length}행`)
