/**
 * Node(node:sqlite) 로 data/generated/korsub.sqlite3 를 읽는 헬퍼.
 * scripts/validate 와 통합 테스트(tests/integration)에서 공용으로 쓴다.
 * 프런트엔드는 이 파일을 쓰지 않고 @tauri-apps/plugin-sql 로 같은 SQL을 실행한다.
 */

import { DatabaseSync } from 'node:sqlite'
import {
  STATION_LINE_QUERY,
  STATION_ALIAS_QUERY,
  LINE_ALIAS_QUERY,
  SCOPE_OPTION_QUERY,
} from '../../src/lib/data/queries'
import { mapRowsToRecords, type StationLineRow, type AliasRow } from '../../src/lib/data/mapRowsToRecords'
import { mapScopeOptionRows, type ScopeOptionRow } from '../../src/lib/data/mapScopeOptions'
import type { StationLineRecord } from '../../src/lib/search/types'
import type { SearchIndex } from '../../src/lib/data/types'

export type { ScopeOptionRow }

export function openDatabase(path: string): DatabaseSync {
  return new DatabaseSync(path, { readOnly: true })
}

export function loadAllStationLines(db: DatabaseSync): StationLineRecord[] {
  const rows = db.prepare(STATION_LINE_QUERY).all() as unknown as StationLineRow[]
  const stationAliases = db.prepare(STATION_ALIAS_QUERY).all() as unknown as AliasRow[]
  const lineAliases = db.prepare(LINE_ALIAS_QUERY).all() as unknown as AliasRow[]
  return mapRowsToRecords(rows, stationAliases, lineAliases)
}

export function loadScopeOptions(db: DatabaseSync): ScopeOptionRow[] {
  return db.prepare(SCOPE_OPTION_QUERY).all() as unknown as ScopeOptionRow[]
}

export function loadStationLinesByRegion(db: DatabaseSync, regionCode: string): StationLineRecord[] {
  // station.regionCode가 아니라 line.regionCode로 걸러야 한다 — 환승역처럼 한
  // 역에 서로 다른 범위(예: 도시 지역 + KTX)의 노선이 함께 붙어 있을 수 있다.
  return loadAllStationLines(db).filter((r) => r.line.regionCode === regionCode)
}

export function loadSearchIndex(db: DatabaseSync): SearchIndex {
  return {
    scopeOptions: mapScopeOptionRows(loadScopeOptions(db)),
    stationLines: loadAllStationLines(db),
    generatedAt: new Date().toISOString(),
  }
}
