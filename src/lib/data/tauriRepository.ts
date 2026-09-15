import type { Repository, SearchIndex } from './types'
import {
  STATION_LINE_QUERY,
  STATION_ALIAS_QUERY,
  LINE_ALIAS_QUERY,
  SCOPE_OPTION_QUERY,
} from './queries'
import { mapRowsToRecords, type StationLineRow, type AliasRow } from './mapRowsToRecords'
import { mapScopeOptionRows, type ScopeOptionRow } from './mapScopeOptions'

/** Tauri 리소스로 번들된 앱 데이터 디렉터리 안 파일명. src-tauri/src/lib.rs 와 일치해야 한다. */
const BUNDLED_DB_FILENAME = 'korsub.sqlite3'

/**
 * 데스크톱(Tauri) 저장소 구현. 앱 시작 시 번들된 읽기 전용 SQLite를 앱 데이터
 * 디렉터리로 복사(Rust `resolve_database_path` 커맨드)한 뒤, `@tauri-apps/plugin-sql`
 * 로 그 파일을 직접 읽는다. 네트워크를 전혀 쓰지 않는다.
 */
export function createTauriRepository(): Repository {
  return {
    async loadSearchIndex(): Promise<SearchIndex> {
      const [{ invoke }, sqlModule] = await Promise.all([
        import('@tauri-apps/api/core'),
        import('@tauri-apps/plugin-sql'),
      ])
      const Database = sqlModule.default

      // 앱 데이터 디렉터리에 최신 번들 DB가 있는지 확인/복사한다.
      await invoke<string>('resolve_database_path')

      const db = await Database.load(`sqlite:${BUNDLED_DB_FILENAME}`)
      try {
        const [stationLineRows, stationAliasRows, lineAliasRows, scopeRows] = await Promise.all([
          db.select<StationLineRow[]>(STATION_LINE_QUERY),
          db.select<AliasRow[]>(STATION_ALIAS_QUERY),
          db.select<AliasRow[]>(LINE_ALIAS_QUERY),
          db.select<ScopeOptionRow[]>(SCOPE_OPTION_QUERY),
        ])
        return {
          scopeOptions: mapScopeOptionRows(scopeRows),
          stationLines: mapRowsToRecords(stationLineRows, stationAliasRows, lineAliasRows),
          generatedAt: new Date().toISOString(),
        }
      } finally {
        await db.close()
      }
    },
  }
}
