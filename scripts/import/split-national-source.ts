/**
 * data/raw/운영기관_역사_코드정보_2026.07.11_일반.xlsx (전국 역사고유번호 원본)를
 * 읽어 지역별 정규화 파일(data/normalized/*.csv)로 나눈다.
 *
 * 우선순위 1단계: 지역 분류 + 지역별 파일 재생성 (이 스크립트).
 * 2단계(부역명 정리)는 scripts/import/sources/nationalRegionSource.ts와
 * src/lib/normalize의 기존 파이프라인(괄호 부역명 분리, "역" 접미사 보정,
 * 가운데점·마침표 비교용 제거)이 가져오기 시점에 처리한다 — 이 스크립트는
 * 원문(STIN_NM)을 그대로 보존하고 지역·노선만 분류한다.
 */

import XLSX from 'xlsx'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { writeCsv } from '../db/csv'
import { OPERATOR_LINE_TO_CODE, LINE_CODE_TO_REGION, isExcludedOperatorLine } from './sources/nationalLineDefinitions'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..')
const RAW_XLSX_PATH = resolve(ROOT, 'data/raw/운영기관_역사_코드정보_2026.07.11_일반.xlsx')
const NORMALIZED_DIR = resolve(ROOT, 'data/normalized')

const REGION_FILE_NAMES: Record<string, string> = {
  SEOUL_METRO: 'seoul-metro-stations.csv',
  BUSAN: 'busan-stations.csv',
  DAEGU: 'daegu-stations.csv',
  GWANGJU: 'gwangju-stations.csv',
  DAEJEON: 'daejeon-stations.csv',
}

interface RawRow {
  RAIL_OPR_ISTT_CD: string
  RAIL_OPR_ISTT_NM: string
  LN_CD: string
  LN_NM: string
  STIN_CD: string
  STIN_NM: string
}

interface NormalizedRow {
  region_code: string
  line_code: string
  source_record_id: string
  operator_code_raw: string
  operator_name_raw: string
  line_code_raw: string
  line_name_raw: string
  station_code_raw: string
  station_name_raw: string
}

function main(): void {
  const workbook = XLSX.readFile(RAW_XLSX_PATH)
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets['역사고유번호']) as RawRow[]

  const byRegion = new Map<string, NormalizedRow[]>()
  let excludedCount = 0
  const unmapped = new Set<string>()

  for (const row of rows) {
    const opCd = row.RAIL_OPR_ISTT_CD
    const lnCd = row.LN_CD
    if (isExcludedOperatorLine(opCd, lnCd)) {
      excludedCount += 1
      continue
    }
    const lineCode = OPERATOR_LINE_TO_CODE[`${opCd}|${lnCd}`]
    if (!lineCode) {
      unmapped.add(`${opCd}|${lnCd} (${row.RAIL_OPR_ISTT_NM} ${row.LN_NM})`)
      continue
    }
    const regionCode = LINE_CODE_TO_REGION[lineCode]
    const normalized: NormalizedRow = {
      region_code: regionCode,
      line_code: lineCode,
      source_record_id: `${opCd}-${lnCd}-${row.STIN_CD}`,
      operator_code_raw: opCd,
      operator_name_raw: row.RAIL_OPR_ISTT_NM,
      line_code_raw: lnCd,
      line_name_raw: row.LN_NM,
      station_code_raw: row.STIN_CD,
      station_name_raw: row.STIN_NM,
    }
    const list = byRegion.get(regionCode) ?? []
    list.push(normalized)
    byRegion.set(regionCode, list)
  }

  if (unmapped.size > 0) {
    throw new Error(`매핑되지 않은 (운영기관,노선) 조합이 있습니다 — nationalLineDefinitions.ts의 OPERATOR_LINE_TO_CODE를 갱신하세요:\n${[...unmapped].join('\n')}`)
  }

  mkdirSync(NORMALIZED_DIR, { recursive: true })
  const columns: Array<keyof NormalizedRow> = [
    'region_code',
    'line_code',
    'source_record_id',
    'operator_code_raw',
    'operator_name_raw',
    'line_code_raw',
    'line_name_raw',
    'station_code_raw',
    'station_name_raw',
  ]

  const summary: Record<string, number> = {}
  for (const [regionCode, list] of byRegion) {
    const fileName = REGION_FILE_NAMES[regionCode]
    if (!fileName) throw new Error(`알 수 없는 region_code: ${regionCode}`)
    const outPath = resolve(NORMALIZED_DIR, fileName)
    writeFileSync(outPath, writeCsv(columns, list.map((r) => columns.map((c) => r[c]))), 'utf-8')
    summary[regionCode] = list.length
  }

  console.log('✅ 지역별 정규화 파일 생성 완료')
  console.table({ ...summary, EXCLUDED_자기부상철도: excludedCount, TOTAL_원본행수: rows.length })
}

main()
