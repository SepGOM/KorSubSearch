import type { Repository, SearchIndex } from './types'

/**
 * 브라우저 미리보기(`pnpm dev`)와 Playwright 테스트에서 쓰는 저장소 구현.
 * public/korsub-dataset.json 은 scripts/import/export-search-index.ts 가
 * data/generated/korsub.sqlite3 로부터 만들어낸 정적 스냅샷이다 — 네트워크
 * 요청이 아니라 같은 출처(same-origin)의 로컬 정적 파일을 읽으므로 오프라인이다.
 */
export function createBrowserJsonRepository(url = '/korsub-dataset.json'): Repository {
  return {
    async loadSearchIndex(): Promise<SearchIndex> {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`검색 데이터를 불러오지 못했습니다 (HTTP ${response.status})`)
      }
      return (await response.json()) as SearchIndex
    },
  }
}
