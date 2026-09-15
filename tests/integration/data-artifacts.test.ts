// @vitest-environment node
/** 통합 테스트 — 색상 CSV 로딩과 검수 리포트 생성 산출물을 검증한다. */

import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'csv-parse/sync'
import { describe, expect, it } from 'vitest'
import { parseLineColorsCsv, validateLineColors } from '@/lib/data/loadLineColors'

const ROOT = resolve(__dirname, '../..')
const LINE_COLORS_PATH = resolve(ROOT, 'data/reference/rail-line-colors.csv')
const REVIEW_REPORT_PATH = resolve(ROOT, 'data/generated/station-resolution-review.csv')
const IMPORT_SUMMARY_PATH = resolve(ROOT, 'data/generated/import-summary.json')

describe('색상 CSV 로딩', () => {
  it('data/reference/rail-line-colors.csv 를 읽고 검증을 통과한다', () => {
    expect(existsSync(LINE_COLORS_PATH)).toBe(true)
    const rows = parseLineColorsCsv(readFileSync(LINE_COLORS_PATH, 'utf-8'))
    expect(rows.length).toBeGreaterThan(0)
    const errors = validateLineColors(rows)
    expect(errors).toEqual([])
  })

  it('서울·수도권 노선 색상이 우선 포함되어 있다', () => {
    const rows = parseLineColorsCsv(readFileSync(LINE_COLORS_PATH, 'utf-8'))
    const seoulRows = rows.filter((r) => r.scope_code === 'SEOUL_METRO')
    expect(seoulRows.length).toBeGreaterThanOrEqual(20)
  })

  it('모든 행에 출처 URL과 확인일이 있다 (근거 없는 값 없음)', () => {
    const rows = parseLineColorsCsv(readFileSync(LINE_COLORS_PATH, 'utf-8'))
    for (const row of rows) {
      expect(row.source_url).toBeTruthy()
      expect(row.verified_at).toBeTruthy()
    }
  })
})

describe('검수 리포트 생성', () => {
  it('가져오기 파이프라인이 station-resolution-review.csv 를 생성한다', () => {
    expect(existsSync(REVIEW_REPORT_PATH)).toBe(true)
    const rows = parse(readFileSync(REVIEW_REPORT_PATH, 'utf-8'), {
      columns: true,
      skip_empty_lines: true,
    }) as Array<{ action: string; left_source_id: string; right_source_id: string; reason: string }>
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      expect(row.action).toBe('REVIEW')
      expect(row.left_source_id).toBeTruthy()
      expect(row.right_source_id).toBeTruthy()
      expect(row.reason).toContain('좌표')
    }
  })

  it('가져오기 요약(import-summary.json)이 병합/검수 건수를 기록한다', () => {
    expect(existsSync(IMPORT_SUMMARY_PATH)).toBe(true)
    const summary = JSON.parse(readFileSync(IMPORT_SUMMARY_PATH, 'utf-8'))
    expect(summary.reviewPairCount).toBeGreaterThan(0)
    expect(summary.mergedGroupCount).toBeGreaterThan(0)
    expect(summary.stationCount).toBeGreaterThan(0)
  })
})
