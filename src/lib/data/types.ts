import type { StationLineRecord } from '../search/types'

export interface ScopeOption {
  scopeCode: string
  kind: 'ALL' | 'REGION' | 'TRAIN_SERVICE'
  nameKo: string
  status: 'AVAILABLE' | 'COMING_SOON'
  sortOrder: number
  regionCode: string | null
  trainServiceCode: string | null
}

export interface LineOption {
  lineId: string
  lineCode: string
  officialName: string
  displayName: string
  lineNumber: number | null
  colorHex: string | null
  textColorHex: string | null
  sortOrder: number
}

/** 검색 화면이 필요로 하는 데이터 전체 — 앱이 시작할 때 한 번 불러온다. */
export interface SearchIndex {
  scopeOptions: ScopeOption[]
  stationLines: StationLineRecord[]
  generatedAt: string
}

/**
 * 데이터 접근 추상화. 데스크톱(Tauri)에서는 SQLite를, 브라우저 미리보기/테스트
 * 환경에서는 정적 JSON 스냅샷(public/korsub-dataset.json)을 읽는다 — 둘 다
 * data/generated/korsub.sqlite3 하나로부터 생성되므로 내용은 항상 같다.
 */
export interface Repository {
  loadSearchIndex(): Promise<SearchIndex>
}
