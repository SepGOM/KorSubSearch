/**
 * 검색어 토큰화. 공백으로 구분된 토큰은 AND 조건으로 처리한다 (규칙 8.3).
 */

export function tokenizeQuery(query: string): string[] {
  return query
    .normalize('NFC')
    .trim()
    .split(/\s+/)
    .filter((token) => token.length > 0)
}
