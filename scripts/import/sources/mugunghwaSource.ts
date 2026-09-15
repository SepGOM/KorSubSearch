/**
 * data/raw/mugunghwa/{mugunghwa_stations,mugunghwa_patterns,mugunghwa_pattern_stops}.csv
 * 로더 (확장 25). KTX(ktxGameLineSource.ts)와 달리 이 원본은 사용자가 미리
 * 조인해 둔 파일이 없어, 이 로더가 세 파일을 직접 조인한다:
 *
 *   mugunghwa_pattern_stops.csv (pattern_id, stop_order, station_id)
 *     × mugunghwa_stations.csv (station_id, station_name)  → 역 이름
 *     × mugunghwa_patterns.csv (pattern_id, group_name, pattern_name) → 노선 매핑
 *
 * rawLineLabel은 pattern_id를 그대로 쓴다 — mugunghwaDefinitions.ts의
 * LineDefinition.rawLabel과 1:1로 대응한다.
 *
 * 여러 계통(pattern)이 같은 구간을 공유해도 중복을 제거하지 않는다 — 각 계통의
 * 역 목록을 pattern_stops 파일 순서 그대로 반영해야 하기 때문이다(사용자 확인:
 * "각 운행 방식에 따른 역을 확인하기 위해 중복에 대해서는 신경쓰지 말고
 * pattern-stops 파일의 순서대로 토글에 반영해줘").
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'csv-parse/sync'
import type { RawStationInput, SourceAdapterResult } from './types'
import { MUGUNGHWA_LINE_DEFINITIONS, MUGUNGHWA_REGION_CODE, MUGUNGHWA_SOURCE_ID } from './mugunghwaDefinitions'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..', '..')
const RAW_DIR = resolve(ROOT, 'data/raw/mugunghwa')

interface StationRow {
  station_id: string
  station_name: string
}

interface PatternRow {
  pattern_id: string
  group_name: string
  pattern_name: string
  route_text: string
  train_type: string
}

interface PatternStopRow {
  pattern_id: string
  stop_order: string
  station_id: string
}

/**
 * 엑셀 등으로 다시 저장하면 파일 맨 앞에 UTF-8 BOM(U+FEFF)이 붙곤 한다 — csv-parse는
 * 이걸 자동으로 벗겨내지 않아서, BOM이 첫 컬럼명(예: "pattern_id")에 그대로 붙어버려
 * row.pattern_id가 매번 undefined가 되는 조용한 오류로 이어진다(2026-09-16 raw
 * 전면 재수정 때 실제로 겪음). 읽자마자 벗겨내 어느 쪽으로 저장해도 안전하게 한다.
 */
function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

export function loadMugunghwaSource(): SourceAdapterResult {
  const stationsText = stripBom(readFileSync(resolve(RAW_DIR, 'mugunghwa_stations.csv'), 'utf-8'))
  const patternsText = stripBom(readFileSync(resolve(RAW_DIR, 'mugunghwa_patterns.csv'), 'utf-8'))
  const stopsText = stripBom(readFileSync(resolve(RAW_DIR, 'mugunghwa_pattern_stops.csv'), 'utf-8'))

  const stationRows = parse(stationsText, { columns: true, skip_empty_lines: true }) as StationRow[]
  const patternRows = parse(patternsText, { columns: true, skip_empty_lines: true }) as PatternRow[]
  const stopRows = parse(stopsText, { columns: true, skip_empty_lines: true }) as PatternStopRow[]

  const stationNameById = new Map(stationRows.map((r) => [r.station_id, r.station_name]))
  const patternById = new Map(patternRows.map((r) => [r.pattern_id, r]))

  const result: RawStationInput[] = stopRows.map((row) => {
    const stationName = stationNameById.get(row.station_id)
    if (!stationName) {
      throw new Error(`mugunghwa_pattern_stops.csv가 존재하지 않는 station_id를 참조합니다: ${row.station_id}`)
    }
    if (!patternById.has(row.pattern_id)) {
      throw new Error(`mugunghwa_pattern_stops.csv가 존재하지 않는 pattern_id를 참조합니다: ${row.pattern_id}`)
    }
    return {
      sourceId: MUGUNGHWA_SOURCE_ID,
      sourceRecordId: `MG-${row.pattern_id}-${row.station_id}`,
      regionCode: MUGUNGHWA_REGION_CODE,
      rawLineLabel: row.pattern_id,
      officialNameRaw: stationName,
      sourceStationCode: row.stop_order,
    }
  })

  return {
    sourceId: MUGUNGHWA_SOURCE_ID,
    provider: {
      providerName: '한국철도공사 (사용자 가공 — 운행계통 기준)',
      datasetName: 'mugunghwa_patterns / mugunghwa_pattern_stops / mugunghwa_stations',
      sourceUrl: null,
      sourceRevision: null,
      referenceDate: '2026-09-15',
      retrievedAt: '2026-09-15',
      license: '공공데이터포털 표준 이용약관 추정 (원문 확인 필요)',
      notes: [
        '사용자가 프로젝트 데이터 디렉터리에 직접 추가한 파일(확장 25). KTX와 같은 위치 구조(patterns/pattern_stops/stations)를 따르지만, KTX와 달리 노선별로 미리 조인된 파일이 없어 이 로더가 세 파일을 직접 조인한다.',
        '노선 구분(group_name)·아이콘("무궁화")·배지 색은 참고 사이트(metrotyping.kr) "무궁화호" 지역 선택 화면을 그대로 따랐다(사용자 확인: "무궁화의 노선 구분은 사진과 같이 해주면 돼"). 이 사이트에 없는 전라선/중앙선/동해선/경전선 4개 그룹의 색은 같은 팔레트 계열로 임의 지정했다 — 공식 색상 아님, 추후 확인 필요.',
        '무궁화호는 KTX/SRT와 같은 pseudo-region을 쓰지 않고 별도 region("MUGUNGHWA")을 쓴다 — 타 지역(KTX/SRT/도시철도)과의 환승은 확실하지 않으면 자동 병합하지 않기 위해서다(사용자 확인: "무궁화호 내 제외 타 지역별 환승역에 대해서 확실하지 않은 부분은 환승역이라고 우선 표기하지 말고"). 무궁화호 안에서 이름이 같은 역은 기존 자동/잠정 병합 규칙대로 계속 병합된다.',
      ],
    },
    lineDefinitions: MUGUNGHWA_LINE_DEFINITIONS,
    rows: result,
  }
}
