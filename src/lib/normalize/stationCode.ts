/**
 * 노선별 역사고유번호(STIN_CD) 원본 표기를 물리적 순서로 비교하기 위한
 * 자연 정렬(natural sort) 비교자.
 *
 * 원본 STIN_CD는 노선마다 자릿수·형식이 다르다 — 순수 숫자("100", "751"),
 * 앞자리 0으로 채운 숫자("0115", "0001"), 알파벳 접두사("S07"), 지선을 나타내는
 * 하이픈 표기("100-1", "100-2")까지 섞여 있다. 단순 문자열 비교로는 "100-1"이
 * "101"보다 뒤로 밀리는 등 실제 역 순서와 어긋날 수 있어, 숫자로 이어진 구간은
 * 숫자값으로, 그 외 구간은 문자로 비교하는 방식을 쓴다.
 */

interface Token {
  text: string
  isNumeric: boolean
  numericValue: number
}

function tokenize(code: string): Token[] {
  const tokens: Token[] = []
  const pattern = /\d+|\D+/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(code)) !== null) {
    const text = match[0]
    const isNumeric = /^\d+$/.test(text)
    tokens.push({ text, isNumeric, numericValue: isNumeric ? Number(text) : Number.NaN })
  }
  return tokens
}

/** a가 b보다 물리적으로 앞이면 음수, 뒤면 양수, 같으면 0을 반환한다. */
export function compareStationCode(a: string, b: string): number {
  const tokensA = tokenize(a)
  const tokensB = tokenize(b)
  const length = Math.max(tokensA.length, tokensB.length)

  for (let i = 0; i < length; i++) {
    const tokenA = tokensA[i]
    const tokenB = tokensB[i]
    // 앞부분까지는 같고 한쪽이 더 짧으면(예: "100" vs "100-1") 짧은 쪽이 먼저다.
    if (tokenA === undefined) return -1
    if (tokenB === undefined) return 1

    if (tokenA.isNumeric && tokenB.isNumeric) {
      if (tokenA.numericValue !== tokenB.numericValue) return tokenA.numericValue - tokenB.numericValue
      if (tokenA.text.length !== tokenB.text.length) return tokenA.text.length - tokenB.text.length
      continue
    }

    if (tokenA.text !== tokenB.text) return tokenA.text < tokenB.text ? -1 : 1
  }

  return 0
}
