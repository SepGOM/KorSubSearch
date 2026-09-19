/**
 * data/raw/mugunghwa-ITXsaemaul/{itx_saemaul_patterns,itx_saemaul_pattern_stops}.csv
 * 로더 (확장 31). 무궁화호 로더(mugunghwaSource.ts)와 똑같은 방식으로 조인하되,
 * 역 이름은 무궁화호와 같은 역 마스터(mugunghwa_stations.csv)를 그대로 쓴다 —
 * ITX-새마을이 무궁화호와 같은 재래선 역들을 쓰기 때문이다(사용자 확인).
 *
 *   itx_saemaul_pattern_stops.csv (pattern_id, stop_order, station_id)
 *     × mugunghwa_stations.csv (station_id, station_name)  → 역 이름
 *     × itx_saemaul_patterns.csv (pattern_id, group_name, pattern_name) → 노선 매핑
 *
 * sourceRecordId는 "ITX-<pattern_id>-<station_id>"로 무궁화호("MG-...")와 겹치지
 * 않게 한다. 계통이 같은 구간을 공유해도 중복을 제거하지 않고 pattern_stops 파일
 * 순서 그대로 반영한다(무궁화호와 같은 규칙).
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'csv-parse/sync'
import type { RawStationInput, SourceAdapterResult } from './types'
import { MUGUNGHWA_REGION_CODE } from './mugunghwaDefinitions'
import { ITX_SAEMAUL_LINE_DEFINITIONS, ITX_SAEMAUL_SOURCE_ID } from './itxSaemaulDefinitions'
import { RAW_DIR, stripBom } from './mugunghwaSource'
import type { PatternRow, PatternStopRow, StationRow } from './mugunghwaSource'

export function loadItxSaemaulSource(): SourceAdapterResult {
  const stationsText = stripBom(readFileSync(resolve(RAW_DIR, 'mugunghwa_stations.csv'), 'utf-8'))
  const patternsText = stripBom(readFileSync(resolve(RAW_DIR, 'itx_saemaul_patterns.csv'), 'utf-8'))
  const stopsText = stripBom(readFileSync(resolve(RAW_DIR, 'itx_saemaul_pattern_stops.csv'), 'utf-8'))

  const stationRows = parse(stationsText, { columns: true, skip_empty_lines: true }) as StationRow[]
  const patternRows = parse(patternsText, { columns: true, skip_empty_lines: true }) as PatternRow[]
  const stopRows = parse(stopsText, { columns: true, skip_empty_lines: true }) as PatternStopRow[]

  const stationNameById = new Map(stationRows.map((r) => [r.station_id, r.station_name]))
  const patternIds = new Set(patternRows.map((r) => r.pattern_id))

  const rows: RawStationInput[] = stopRows.map((row) => {
    const stationName = stationNameById.get(row.station_id)
    if (!stationName) {
      throw new Error(`itx_saemaul_pattern_stops.csv가 존재하지 않는 station_id를 참조합니다: ${row.station_id}`)
    }
    if (!patternIds.has(row.pattern_id)) {
      throw new Error(`itx_saemaul_pattern_stops.csv가 존재하지 않는 pattern_id를 참조합니다: ${row.pattern_id}`)
    }
    return {
      sourceId: ITX_SAEMAUL_SOURCE_ID,
      sourceRecordId: `ITX-${row.pattern_id}-${row.station_id}`,
      regionCode: MUGUNGHWA_REGION_CODE,
      rawLineLabel: row.pattern_id,
      officialNameRaw: stationName,
      sourceStationCode: row.stop_order,
    }
  })

  return {
    sourceId: ITX_SAEMAUL_SOURCE_ID,
    provider: {
      providerName: '한국철도공사 (사용자 가공 — 운행계통 기준)',
      datasetName: 'itx_saemaul_patterns / itx_saemaul_pattern_stops (+ mugunghwa_stations 재사용)',
      sourceUrl: null,
      sourceRevision: null,
      referenceDate: '2026-09-19',
      retrievedAt: '2026-09-19',
      license: '공공데이터포털 표준 이용약관 추정 (원문 확인 필요)',
      notes: [
        '사용자가 프로젝트 데이터 디렉터리에 직접 추가한 파일(확장 31). ITX-새마을이 무궁화호와 같은 재래선 역들을 쓰기 때문에 역 마스터(mugunghwa_stations.csv)를 그대로 재사용하며, 그래서 폴더가 data/raw/mugunghwa-ITXsaemaul로 바뀌었다(사용자 확인).',
        '무궁화호와 같은 pseudo-region("MUGUNGHWA")을 쓴다 — 역 마스터를 공유하므로 같은 region+같은 역명 자동 병합으로 무궁화호의 같은 역과 하나로 합쳐진다. 화면의 ITX 범위 구분은 line.train_service_code("ITX")로 한다.',
        '노선 색상은 사용자 제공 참고 이미지(Railmap 전국 일반여객철도 노선도, 2026.9.1 기준)의 노선 라벨 색을 옮겼다.',
      ],
    },
    lineDefinitions: ITX_SAEMAUL_LINE_DEFINITIONS,
    rows,
  }
}
