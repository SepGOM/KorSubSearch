import { useEffect, useState } from 'react'
import { createRepository } from '@/lib/data/createRepository'
import type { SearchIndex } from '@/lib/data/types'

export type SearchIndexState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; index: SearchIndex }

/** 앱 시작 시 검색 데이터를 한 번 불러온다 (Tauri: SQLite / 브라우저: 정적 JSON). */
export function useSearchIndex(): SearchIndexState {
  const [state, setState] = useState<SearchIndexState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    createRepository()
      .loadSearchIndex()
      .then((index) => {
        if (!cancelled) setState({ status: 'ready', index })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', message: err instanceof Error ? err.message : String(err) })
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  return state
}
