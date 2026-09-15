/**
 * 노선 색상 HEX 검증과 WCAG 명암비 계산 순수 함수 모음.
 * data/reference/rail-line-colors.csv 생성기와 검증기, 그리고 UI 배지 렌더링에서 공용으로 쓴다.
 */

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_PATTERN.test(value)
}

/** 임의 표기의 HEX 색상을 "#RRGGBB" 대문자로 정규화한다. 유효하지 않으면 null. */
export function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim()
  const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`
  if (!HEX_COLOR_PATTERN.test(withHash)) return null
  return withHash.toUpperCase()
}

function hexToRgb(hex: string): [number, number, number] {
  const normalized = normalizeHexColor(hex)
  if (!normalized) throw new Error(`유효하지 않은 HEX 색상: ${hex}`)
  const r = Number.parseInt(normalized.slice(1, 3), 16)
  const g = Number.parseInt(normalized.slice(3, 5), 16)
  const b = Number.parseInt(normalized.slice(5, 7), 16)
  return [r, g, b]
}

function channelToLinear(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/** WCAG 상대 휘도(relative luminance). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * channelToLinear(r) + 0.7152 * channelToLinear(g) + 0.0722 * channelToLinear(b)
}

/** WCAG 명암비. 두 색 순서와 무관하게 항상 1 이상 값을 반환한다. */
export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA)
  const lumB = relativeLuminance(hexB)
  const lighter = Math.max(lumA, lumB)
  const darker = Math.min(lumA, lumB)
  return (lighter + 0.05) / (darker + 0.05)
}

/** 배경색에 대해 검정/흰색 중 명암비가 더 높은 글자색을 고른다. */
export function pickReadableTextColor(backgroundHex: string): '#000000' | '#FFFFFF' {
  const contrastWithBlack = contrastRatio(backgroundHex, '#000000')
  const contrastWithWhite = contrastRatio(backgroundHex, '#FFFFFF')
  return contrastWithBlack >= contrastWithWhite ? '#000000' : '#FFFFFF'
}
