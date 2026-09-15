/**
 * data/generated/korsub.sqlite3 에 대한 검증 (규칙 11장).
 * 오류가 있으면 종료 코드 1로 실패시켜 빌드를 막는다.
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDatabase, loadAllStationLines } from '../db/nodeRepository'
import { parseLineColorsCsv, validateLineColors } from '../../src/lib/data/loadLineColors'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
const DB_PATH = resolve(ROOT, 'data/generated/korsub.sqlite3')
const LINE_COLORS_PATH = resolve(ROOT, 'data/reference/rail-line-colors.csv')

const errors: string[] = []
const warnings: string[] = []

function fail(message: string): void {
  errors.push(message)
}
function warn(message: string): void {
  warnings.push(message)
}

const db = openDatabase(DB_PATH)

// 1. 존재하지 않는 역·노선 참조 (외래키 무결성)
db.exec('PRAGMA foreign_keys = ON')
const fkViolations = db.prepare('PRAGMA foreign_key_check').all()
if (fkViolations.length > 0) {
  fail(`외래키 위반 ${fkViolations.length}건: ${JSON.stringify(fkViolations.slice(0, 5))}`)
}

// 2. 내부 ID 중복은 PRIMARY KEY 제약으로 삽입 시점에 이미 막힌다. 개수만 교차 확인한다.
const stationCount = (db.prepare('SELECT COUNT(*) c FROM station').get() as { c: number }).c
const distinctStationIds = (db.prepare('SELECT COUNT(DISTINCT station_id) c FROM station').get() as { c: number }).c
if (stationCount !== distinctStationIds) fail('station_id 중복 발견')

// 3. 출처 누락
const stationsWithoutSource = (
  db.prepare('SELECT COUNT(*) c FROM station WHERE source_id IS NULL').get() as { c: number }
).c
if (stationsWithoutSource > 0) fail(`출처(source_id) 없는 station ${stationsWithoutSource}건`)

const linesWithoutSource = (
  db.prepare('SELECT COUNT(*) c FROM line WHERE source_id IS NULL').get() as { c: number }
).c
if (linesWithoutSource > 0) fail(`출처(source_id) 없는 line ${linesWithoutSource}건`)

// 4. 필수 검색 문자열 누락
const missingSearchFields = (
  db
    .prepare(
      "SELECT COUNT(*) c FROM station WHERE normalized_name IS NULL OR normalized_name = '' OR initials IS NULL OR initials = ''",
    )
    .get() as { c: number }
).c
if (missingSearchFields > 0) fail(`normalized_name/initials 누락 station ${missingSearchFields}건`)

// 5. 같은 line_id 안에서 source_station_code 중복.
//    station_line_id/station_id 같은 실제 식별 키가 아니라, 화면에 참고로만 쓰는
//    "외부 코드"(예: 역번호) 필드다. 이 코드 자체가 원본에 잘못 기재된 경우(예:
//    부산 2호선 역번호 209가 "수영"·"광안" 두 역에 중복 기재됨 — 전화번호 끝자리로
//    보면 수영이 208이어야 할 오타로 보인다)가 있어도 원본을 고치지 않고 경고로만
//    남긴다. station_id/line_id 조합 자체의 유일성은 스키마 UNIQUE 제약이 보장한다.
//    1호선(150~159)·3호선(309~318)은 서로 다른 두 운영기관이 같은 코드를 완전히
//    다른 두 구간에 각각 매겨 놓아, 이 코드만으로는 실제 노선 순서를 복원할 수
//    없다 — 화면 표시 순서(station_line.sequence)는 원본 코드 자체를 고치지 않고
//    data/overrides/station-line-sequence.csv 로 사람이 확인해 바로잡았다(원본
//    source_station_code 값은 여전히 중복이며, 이 경고는 그 사실만 알린다).
const dupSourceCodes = db
  .prepare(
    `SELECT line_id, source_station_code, COUNT(*) c
     FROM station_line
     WHERE source_station_code IS NOT NULL
     GROUP BY line_id, source_station_code
     HAVING c > 1`,
  )
  .all()
if (dupSourceCodes.length > 0) {
  warn(`같은 노선 내 외부 코드(source_station_code) 중복 ${dupSourceCodes.length}건 (원본 결함, 원본은 수정하지 않음 — 화면 표시 순서는 data/overrides/station-line-sequence.csv 로 바로잡음): ${JSON.stringify(dupSourceCodes.slice(0, 5))}`)
}

// 6. 좌표 범위 오류 (있는 경우만 검사 — 이번 원본에는 좌표가 없음)
const badCoordinates = (
  db
    .prepare(
      'SELECT COUNT(*) c FROM station WHERE (latitude IS NOT NULL AND (latitude < -90 OR latitude > 90)) OR (longitude IS NOT NULL AND (longitude < -180 OR longitude > 180))',
    )
    .get() as { c: number }
).c
if (badCoordinates > 0) fail(`좌표 범위 오류 ${badCoordinates}건`)
const stationsWithCoords = (
  db.prepare('SELECT COUNT(*) c FROM station WHERE latitude IS NOT NULL').get() as { c: number }
).c
if (stationsWithCoords === 0) {
  warn('이번 원본 데이터에는 좌표가 전혀 없다 — 자동 병합 대부분이 잠정(NAME_ONLY_PROVISIONAL) 상태다.')
}

// 7. 수동 예외가 참조하는 원본 ID 누락 — 이 검사는 scripts/import/run-import.ts 가
//    가져오기 시점에 이미 수행한다(병합 후 station 테이블에는 그룹 대표 id 하나만
//    남아, 최종 DB만 보고 검사하면 병합된 나머지 id를 오탐으로 잡아낸다).

// 8. 노선 색상 CSV: 잘못된 HEX / line_code 별 색상 충돌
const colorRows = parseLineColorsCsv(readFileSync(LINE_COLORS_PATH, 'utf-8'))
const colorErrors = validateLineColors(colorRows)
for (const e of colorErrors) fail(`[색상 CSV] ${e.line_code}: ${e.message}`)

// line 테이블의 모든 활성 노선이 색상 CSV에 있는지 (임의 색 채우기 방지 확인)
const linesWithoutColor = db
  .prepare('SELECT line_code FROM line WHERE is_active = 1 AND color_hex IS NULL')
  .all() as { line_code: string }[]
if (linesWithoutColor.length > 0) {
  warn(`색상이 아직 없는 활성 노선 ${linesWithoutColor.length}건 (임의 색 채우지 않음): ${linesWithoutColor.map((l) => l.line_code).join(', ')}`)
}

// 9. 폐역/비활성 노선이 있다면, 검색 엔진 기본 정렬에서 뒤로 밀리는지는
//    tests/unit/search-engine.test.ts 에서 합성 데이터로 검증한다 (실 데이터엔 현재 비활성 레코드 없음).
const inactiveCount = (
  db.prepare('SELECT COUNT(*) c FROM station_line WHERE is_active = 0').get() as { c: number }
).c
if (inactiveCount > 0) {
  warn(`비활성 station_line ${inactiveCount}건 존재 — 검색 결과에서 활성 레코드보다 뒤로 정렬되어야 한다.`)
}

// 10. 원본 자체의 인코딩 손상 의심 문자 ('?') — 자동으로 고치지 않고 경고만 남긴다.
//     예: "4703" 전철역코드의 원본 필드가 "4?19민주묘지" 로 되어 있음 (아마도 "4·19민주묘지").
//     원본 데이터는 수정하지 않는다는 규칙에 따라 raw는 그대로 두고 검수 대상으로만 알린다.
const suspiciousNames = db
  .prepare("SELECT station_id, official_name, source_record_id FROM station WHERE official_name LIKE '%?%'")
  .all() as { station_id: string; official_name: string; source_record_id: string }[]
if (suspiciousNames.length > 0) {
  warn(
    `원본 인코딩 손상 의심 역명 ${suspiciousNames.length}건 (raw는 수정하지 않음, 수동 확인 필요): ${suspiciousNames
      .map((s) => `${s.official_name}(원본코드 ${s.source_record_id})`)
      .join(', ')}`,
  )
}

// 11. 전체 로딩이 실제로 동작하는지 (매핑 함수 스모크 테스트)
const records = loadAllStationLines(db)
if (records.length === 0) fail('station_line 레코드를 하나도 불러오지 못함')

db.close()

console.log(`검증 대상: station_line ${records.length}건`)
if (warnings.length > 0) {
  console.warn(`⚠️  경고 ${warnings.length}건`)
  for (const w of warnings) console.warn(`  - ${w}`)
}

if (errors.length > 0) {
  console.error(`❌ 검증 실패 (${errors.length}건)`)
  for (const e of errors) console.error(`  - ${e}`)
  process.exit(1)
}

console.log('✅ 데이터 검증 통과')
