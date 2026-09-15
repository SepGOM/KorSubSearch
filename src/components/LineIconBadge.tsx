interface LineIconBadgeProps {
  iconLabel: string
  displayName: string
  colorHex: string | null
  lineCode: string
}

/**
 * 대구 1~3호선만 원이 아니라 사각형 배지로 그린다(2026-09-15 사용자 확인:
 * "대구 1~3호선의 경우 네모난 알 내에 흰 숫자로 변경" — 참고 이미지가 보여준
 * 빨간 사각형 안 흰 숫자 스타일). 대경선(KR-DAEGYEONG)은 번호가 없는 일반
 * 노선이라 대상이 아니고, 다른 지역 1~3호선(서울·부산·광주 등)도 이 요청은
 * "대구의 경우"로 한정했으므로 원형을 그대로 유지한다.
 */
const SQUARE_BADGE_LINE_CODES = new Set(['DT-1', 'DT-2', 'DT-3'])

/**
 * 여러 배지가 한 줄에 나열되는 곳(환승역 배지 등)에 쓰는 작은 원형 아이콘.
 * 노선 이름 전체를 담은 알약(pill) 모양 배지(`LineBadge`)는 노선이 많이 겹치는
 * 역(특히 KTX 도입 이후)에서 한 줄이 너무 길어지거나 줄바꿈이 지저분해지는
 * 문제가 있었다 — 사용자가 캡처해 준 참고 사이트(metrotyping.kr)의 노선 선택
 * 화면처럼, 원 안에 짧은 글자만 넣고 전체 이름은 title(호버 시 툴팁)로 뺀다.
 *
 * 높이는 24px(h-6)로 고정하고 너비는 내용에 맞춰 늘어난다(min-w-6 + 가로
 * padding). "1"·"KTX"·"인1"처럼 짧은 라벨은 지금까지처럼 정원(24×24)이 되고,
 * "무궁화"처럼 한글 3자라 24px 폭에 한 줄로 못 들어가는 라벨만 알약 모양으로
 * 자연스럽게 넓어져 두 줄로 접히지 않는다(확장 25 직후 사용자 확인: "무궁화호의
 * 아이콘이 그닥 맘에 안드네" — 폰트만 줄이면 한글 3자가 여전히 읽기 힘들어지므로
 * 너비를 늘리는 쪽을 택했다).
 */
export function LineIconBadge({ iconLabel, displayName, colorHex, lineCode }: LineIconBadgeProps) {
  const style = colorHex
    ? { backgroundColor: colorHex, color: '#FFFFFF' }
    : { backgroundColor: '#E5E7EB', color: '#374151' }
  const isSquare = SQUARE_BADGE_LINE_CODES.has(lineCode)

  return (
    <span
      role="img"
      aria-label={displayName}
      title={displayName}
      className={[
        'inline-flex h-6 min-w-6 shrink-0 items-center justify-center whitespace-nowrap px-1 text-[10px] font-bold leading-none',
        isSquare ? 'rounded-md' : 'rounded-full',
      ].join(' ')}
      style={style}
    >
      {iconLabel}
    </span>
  )
}
