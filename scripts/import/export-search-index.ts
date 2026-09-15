/**
 * data/generated/korsub.sqlite3 로부터 public/korsub-dataset.json 을 만든다.
 *
 * 이 JSON은 브라우저 미리보기(pnpm dev)와 Playwright 테스트에서 쓰는 대체 경로다.
 * Tauri 데스크톱 빌드는 이 파일을 쓰지 않고 SQLite를 직접 읽지만, 두 경로 모두
 * 결국 같은 korsub.sqlite3 하나에서 나오므로 내용은 항상 일치한다.
 */

import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase, loadSearchIndex } from '../db/nodeRepository'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
const DB_PATH = resolve(ROOT, 'data/generated/korsub.sqlite3')
const OUTPUT_PATH = resolve(ROOT, 'public/korsub-dataset.json')

export function exportSearchIndex(): { stationLineCount: number; outputPath: string } {
  if (!existsSync(DB_PATH)) {
    throw new Error(`${DB_PATH} 가 없습니다. 먼저 "pnpm db:import" 를 실행하세요.`)
  }
  const db = openDatabase(DB_PATH)
  const index = loadSearchIndex(db)
  db.close()

  mkdirSync(dirname(OUTPUT_PATH), { recursive: true })
  writeFileSync(OUTPUT_PATH, JSON.stringify(index), 'utf-8')
  return { stationLineCount: index.stationLines.length, outputPath: OUTPUT_PATH }
}

if (process.argv[1] && import.meta.url === `file://${process.argv[1]}`) {
  const { stationLineCount, outputPath } = exportSearchIndex()
  console.log(`✅ 검색 인덱스 내보내기 완료: ${stationLineCount}건 → ${outputPath}`)
}
