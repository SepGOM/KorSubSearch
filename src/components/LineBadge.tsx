interface LineBadgeProps {
  label: string
  colorHex: string | null
}

/**
 * 노선 색상 배지. 실제 지하철 노선 배지 관행처럼 색이 있으면 항상 흰 글자를 쓴다
 * (명암비 계산으로 검정/흰색을 고르지 않는다 — 사용자 요청). 색상이 없는 노선
 * (아직 미확인)은 중립 회색 바탕에 어두운 글자로 표시한다.
 */
export function LineBadge({ label, colorHex }: LineBadgeProps) {
  const style = colorHex
    ? { backgroundColor: colorHex, color: '#FFFFFF' }
    : { backgroundColor: '#E5E7EB', color: '#374151' }

  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold"
      style={style}
    >
      {label}
    </span>
  )
}
