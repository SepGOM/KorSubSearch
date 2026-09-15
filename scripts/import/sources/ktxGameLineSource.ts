/**
 * data/raw/ktx-game-lines/game_line_stations.csv 로더.
 *
 * 이 파일은 사용자가 patterns.csv/pattern_stops.csv/stations.csv/game_line_patterns.csv
 * 를 미리 조인해 노선(game_line)+출발 계열(origin_type)별로 역 목록을 순서대로
 * 계산해 둔 결과물이다 — 우리 파이프라인은 이 파일 하나만 읽는다(나머지 4개는
 * 이 파일을 만든 근거 자료로 data/raw/ktx-game-lines/ 에 함께 보관한다).
 *
 * 컬럼: game_line, origin_type, stop_order, station_id, station_name
 *
 * 알려진 원본 결함 하나만 이 로더에서 보정한다: "동해선" × "SRT"의 마지막 역
 * (포항, station_id=S085)이 stop_order=9여야 하는데 원본에 "1"로 잘못 찍혀
 * 있다(이미 앞에 stop_order 1~8이 있어 그대로 두면 포항이 맨 앞으로 정렬되는
 * 명백한 오류). 사용자 확인: 이 한 줄만 보정하고, "동해선 전구간"의 더 복잡한
 * 문제(원본에 SRT 데이터 자체가 없고 KTX 쪽도 패턴 하나만 반영됨)는 원본 그대로
 * 둔다 — 새 데이터가 오면 다시 확인.
 */

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'csv-parse/sync'
import type { RawStationInput, SourceAdapterResult } from './types'
import { KTX_GAME_LINE_DEFINITIONS, KTX_REGION_CODE, KTX_SOURCE_ID } from './ktxGameLineDefinitions'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..', '..', '..')
const RAW_PATH = resolve(ROOT, 'data/raw/ktx-game-lines/game_line_stations.csv')

interface GameLineStationRow {
  game_line: string
  origin_type: string
  stop_order: string
  station_id: string
  station_name: string
}

/** 원본 결함 보정: 동해선×SRT의 포항(S085) stop_order "1" → "9". */
function correctedStopOrder(row: GameLineStationRow): string {
  if (row.game_line === '동해선' && row.origin_type === 'SRT' && row.station_id === 'S085') {
    return '9'
  }
  return row.stop_order
}

export function loadKtxGameLineSource(): SourceAdapterResult {
  const text = readFileSync(RAW_PATH, 'utf-8')
  const rows = parse(text, { columns: true, skip_empty_lines: true }) as GameLineStationRow[]

  const result: RawStationInput[] = rows.map((row) => ({
    sourceId: KTX_SOURCE_ID,
    sourceRecordId: `GL-${row.game_line}-${row.origin_type}-${row.station_id}`,
    regionCode: KTX_REGION_CODE,
    rawLineLabel: `${row.game_line}|${row.origin_type}`,
    officialNameRaw: row.station_name,
    sourceStationCode: correctedStopOrder(row),
  }))

  return {
    sourceId: KTX_SOURCE_ID,
    provider: {
      providerName: '한국철도공사/에스알(주) (사용자 가공 — 운행계통 기준)',
      datasetName: 'game_line_stations (patterns/pattern_stops/stations/game_line_patterns 조인 결과)',
      sourceUrl: null,
      sourceRevision: null,
      referenceDate: '2026-09-08',
      retrievedAt: '2026-09-08',
      license: '공공데이터포털 표준 이용약관 추정 (원문 확인 필요)',
      notes: [
        '사용자가 프로젝트 데이터 디렉터리에 직접 추가한 파일. 2026-09-07 세션에 썼던 단순 "노선명+순번" 평면 KTX CSV(data/raw/_archive/한국철도공사_KTX 노선별 역정보_20251121.csv)를 완전히 대체한다.',
        '노선(game_line, 9개)과 출발 계열(origin_type: KTX=서울·용산발, SRT=수서발)을 함께 키로 쓴다. 2026-09-01부로 SRT가 KTX 브랜드에 통합돼 회사 차원의 "SRT"는 이제 없지만(사용자 확인), 이 앱은 사용자가 "수서발"/"서울·용산발"을 구분해 검색할 수 있어야 해서 origin_type을 그대로 살렸다.',
        '함께 받은 patterns.csv/pattern_stops.csv/stations.csv/game_line_patterns.csv는 이 파일을 만든 근거 자료로 보관만 하고 파이프라인에서 직접 읽지는 않는다.',
        'stations.csv의 "진부"는 정식 명칭이 "진부(오대산)"으로 바뀐 걸 반영해 사용자 확인 후 직접 갱신했다(이 파일 자체는 이미 "진부(오대산)"으로 올바르게 들어있었다).',
        '"동해선"×SRT의 포항(S085) stop_order 오류(9여야 하는데 1로 표기됨)는 이 로더가 보정한다. "동해선 전구간"×KTX는 부전~강릉 패턴(P22)만 반영돼 있고 서울~동대구~포항 구간(P05)은 빠져 있으며, "동해선 전구간"×SRT는 데이터 자체가 없다 — 사용자 확인에 따라 원본 그대로 둔다(보정하지 않음).',
      ],
    },
    lineDefinitions: KTX_GAME_LINE_DEFINITIONS,
    rows: result,
  }
}
