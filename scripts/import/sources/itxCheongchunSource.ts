/**
 * data/raw/itx_cheongchun/{cheongchun_stations,itx_cheongchun_pattern_stops}.csv
 * 로더 (확장 32). 무궁화호·ITX-새마을 로더와 같은 방식으로 조인하되, patterns.csv가
 * 없다 — 계통이 IC01 하나뿐이라 노선 정의(itxCheongchunDefinitions.ts)가 그 자리를
 * 대신한다.
 *
 *   itx_cheongchun_pattern_stops.csv (pattern_id, stop_order, station_id)
 *     × cheongchun_stations.csv (station_id, station_name)  → 역 이름
 *
 * sourceRecordId는 "ITXC-<pattern_id>-<station_id>"다. 역 목록은 pattern_stops 파일
 * 순서(stop_order) 그대로 반영한다.
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'csv-parse/sync'
import type { RawStationInput, SourceAdapterResult } from './types'
import {
  ITX_CHEONGCHUN_LINE_DEFINITIONS,
  ITX_CHEONGCHUN_REGION_CODE,
  ITX_CHEONGCHUN_SOURCE_ID,
} from './itxCheongchunDefinitions'
import { stripBom } from './mugunghwaSource'
import type { PatternStopRow, StationRow } from './mugunghwaSource'

const __dirname = dirname(fileURLToPath(import.meta.url))
const RAW_DIR = resolve(__dirname, '..', '..', '..', 'data/raw/itx_cheongchun')

export function loadItxCheongchunSource(): SourceAdapterResult {
  const stationsText = stripBom(readFileSync(resolve(RAW_DIR, 'cheongchun_stations.csv'), 'utf-8'))
  const stopsText = stripBom(readFileSync(resolve(RAW_DIR, 'itx_cheongchun_pattern_stops.csv'), 'utf-8'))

  const stationRows = parse(stationsText, { columns: true, skip_empty_lines: true }) as StationRow[]
  const stopRows = parse(stopsText, { columns: true, skip_empty_lines: true }) as PatternStopRow[]

  const stationNameById = new Map(stationRows.map((r) => [r.station_id, r.station_name]))
  const knownPatternIds = new Set(ITX_CHEONGCHUN_LINE_DEFINITIONS.map((d) => d.rawLabel))

  const rows: RawStationInput[] = stopRows.map((row) => {
    const stationName = stationNameById.get(row.station_id)
    if (!stationName) {
      throw new Error(`itx_cheongchun_pattern_stops.csv가 존재하지 않는 station_id를 참조합니다: ${row.station_id}`)
    }
    if (!knownPatternIds.has(row.pattern_id)) {
      throw new Error(`itx_cheongchun_pattern_stops.csv가 노선 정의에 없는 pattern_id를 참조합니다: ${row.pattern_id}`)
    }
    return {
      sourceId: ITX_CHEONGCHUN_SOURCE_ID,
      sourceRecordId: `ITXC-${row.pattern_id}-${row.station_id}`,
      regionCode: ITX_CHEONGCHUN_REGION_CODE,
      rawLineLabel: row.pattern_id,
      officialNameRaw: stationName,
      sourceStationCode: row.stop_order,
    }
  })

  return {
    sourceId: ITX_CHEONGCHUN_SOURCE_ID,
    provider: {
      providerName: '한국철도공사 (사용자 가공 — 운행계통 기준)',
      datasetName: 'itx_cheongchun_pattern_stops / cheongchun_stations',
      sourceUrl: null,
      sourceRevision: null,
      referenceDate: '2026-09-19',
      retrievedAt: '2026-09-19',
      license: '공공데이터포털 표준 이용약관 추정 (원문 확인 필요)',
      notes: [
        '사용자가 프로젝트 데이터 디렉터리에 직접 추가한 파일(확장 32). ITX-청춘은 수도권 전철 경춘선의 선로와 역을 공용한다(사용자 확인).',
        '서울·수도권 region("SEOUL_METRO")을 그대로 쓴다 — 같은 region+같은 역명 자동 병합으로 경춘선·1호선·경의중앙선 등 기존 역과 하나로 합쳐진다. 화면의 ITX 범위 구분은 line.train_service_code("ITX")로 한다.',
        '노선 색상은 이전에 제공된 Railmap 전국 노선도의 경춘선 색을 썼다(게임 화면의 청춘 아이콘 색은 ITX-새마을-경전과 비슷해 구분되지 않는다는 사용자 지적).',
      ],
    },
    lineDefinitions: ITX_CHEONGCHUN_LINE_DEFINITIONS,
    rows,
  }
}
