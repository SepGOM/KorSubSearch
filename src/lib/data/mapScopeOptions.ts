import type { ScopeOption } from './types'

export interface ScopeOptionRow {
  scope_code: string
  kind: 'ALL' | 'REGION' | 'TRAIN_SERVICE'
  name_ko: string
  status: 'AVAILABLE' | 'COMING_SOON'
  sort_order: number
  region_code: string | null
  train_service_code: string | null
}

export function mapScopeOptionRows(rows: ScopeOptionRow[]): ScopeOption[] {
  return rows.map((row) => ({
    scopeCode: row.scope_code,
    kind: row.kind,
    nameKo: row.name_ko,
    status: row.status,
    sortOrder: row.sort_order,
    regionCode: row.region_code,
    trainServiceCode: row.train_service_code,
  }))
}
