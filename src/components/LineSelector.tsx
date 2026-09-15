import type { LineRecord } from '@/lib/search/types'

interface LineSelectorProps {
  lines: LineRecord[]
  selectedLineId: string | null
  onSelect: (lineId: string | null) => void
}

type DeparturePoint = '행신착발' | '수서착발'

/**
 * displayName이 "...-행신착발"/"...-수서착발"로 끝나면 그 접미어와 나머지
 * 부분(base, 예: "KTX-경부")을 분리한다. 아니면 null(착발 구분이 없는 노선).
 */
function parseDeparturePoint(displayName: string): { base: string; point: DeparturePoint } | null {
  const match = /^(.+)-(행신착발|수서착발)$/.exec(displayName)
  if (!match) return null
  return { base: match[1], point: match[2] as DeparturePoint }
}

/**
 * "노선 선택" 목록에 실제로 존재하는 노선만 보여주며, 노선 목록 자체는
 * 데이터베이스에서 읽은 값을 그대로 렌더링한다 (하드코딩하지 않음).
 */
export function LineSelector({ lines, selectedLineId, onSelect }: LineSelectorProps) {
  if (lines.length === 0) return null

  // 2026-09-15 사용자 확인("노선 구분 시 수서 및 행신 착발 노선에 대해서
  // 그룹화 하는건 어때?"): 데이터는 여전히 flat한 14개 KTX 노선 그대로지만,
  // 같은 계통의 행신착발/수서착발 짝이 둘 다 있으면 화면에서만 캡슐 하나로
  // 묶어 보여준다 — lineCode·override·색상 등 데이터 모델은 전혀 안 건드리는
  // 프론트 전용 표시 개선이다(ktxGameLineDefinitions.ts 참고).
  const pairsByBase = new Map<string, Partial<Record<DeparturePoint, LineRecord>>>()
  for (const line of lines) {
    const parsed = parseDeparturePoint(line.displayName)
    if (!parsed) continue
    const entry = pairsByBase.get(parsed.base) ?? {}
    entry[parsed.point] = line
    pairsByBase.set(parsed.base, entry)
  }

  const consumedLineIds = new Set<string>()

  return (
    <section aria-labelledby="line-selector-heading">
      <h2 id="line-selector-heading" className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
        노선 선택
      </h2>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          aria-pressed={selectedLineId === null}
          onClick={() => onSelect(null)}
          className={[
            'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
            selectedLineId === null
              ? 'border-blue-600 bg-blue-600 text-white'
              : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100',
          ].join(' ')}
        >
          전체 노선
        </button>
        {lines.map((line) => {
          if (consumedLineIds.has(line.lineId)) return null

          const parsed = parseDeparturePoint(line.displayName)
          const pair = parsed ? pairsByBase.get(parsed.base) : undefined
          const haengsin = pair?.['행신착발']
          const suseo = pair?.['수서착발']

          if (parsed && haengsin && suseo) {
            consumedLineIds.add(haengsin.lineId)
            consumedLineIds.add(suseo.lineId)
            return (
              <DeparturePointGroup
                key={`group-${parsed.base}`}
                base={parsed.base}
                haengsin={haengsin}
                suseo={suseo}
                selectedLineId={selectedLineId}
                onSelect={onSelect}
              />
            )
          }

          return <LinePillButton key={line.lineId} line={line} selectedLineId={selectedLineId} onSelect={onSelect} />
        })}
      </div>
    </section>
  )
}

interface LinePillButtonProps {
  line: LineRecord
  selectedLineId: string | null
  onSelect: (lineId: string | null) => void
}

/** 착발 짝이 없는 보통 노선 — 기존과 동일한 단독 알약(pill) 버튼. */
function LinePillButton({ line, selectedLineId, onSelect }: LinePillButtonProps) {
  const isSelected = line.lineId === selectedLineId
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      // 이미 선택된 노선을 다시 누르면 "전체 노선"으로 되돌아간다.
      onClick={() => onSelect(isSelected ? null : line.lineId)}
      className={[
        'flex items-center justify-center rounded-full border px-3 py-1 text-sm transition-all duration-200',
        isSelected
          ? 'border-blue-600 font-bold text-white ring-2 ring-blue-300'
          : 'border-slate-300 font-medium hover:border-blue-400 dark:border-slate-600',
      ].join(' ')}
      style={line.colorHex && isSelected ? { backgroundColor: line.colorHex } : undefined}
    >
      {/* 선택되면 동그란 색상 점을 접어 없애고, 노선 배경색 하나로 텍스트가
          가운데 정렬되도록 부드럽게 움직인다. */}
      <span
        aria-hidden="true"
        className={[
          'inline-block shrink-0 rounded-full transition-all duration-200 ease-out',
          isSelected ? 'mr-0 h-0 w-0 opacity-0' : 'mr-1.5 h-2.5 w-2.5 opacity-100',
        ].join(' ')}
        style={{ backgroundColor: line.colorHex ?? '#9CA3AF' }}
      />
      {line.displayName}
    </button>
  )
}

interface DeparturePointGroupProps {
  base: string
  haengsin: LineRecord
  suseo: LineRecord
  selectedLineId: string | null
  onSelect: (lineId: string | null) => void
}

/**
 * 같은 계통(base, 예: "KTX-경부")의 행신착발/수서착발을 캡슐 하나로 묶어
 * 보여준다. 왼쪽엔 base 이름표, 오른쪽엔 착발 두 개를 반쪽씩 붙여서 그린다 —
 * 실제 색은 두 착발이 서로 다르므로(예: KTX-경부 파랑 vs SRT-경부 보라)
 * 각자 자기 colorHex를 그대로 유지한다. 접근성 이름(aria-label)은 기존
 * displayName 전체("KTX-경부-행신착발")를 그대로 남겨 다른 화면(검색 결과
 * 배지 등)과 이름이 어긋나지 않게 한다.
 *
 * 2026-09-15 추가 사용자 확인 두 가지를 반영했다:
 * (1) "사진처럼 토글이 된 색상에 맞춰서 테두리 색 동기화" — 캡슐 테두리가
 *     일반 파랑(border-blue-600) 대신, 지금 선택된 착발의 실제 colorHex를
 *     그대로 쓴다(단독 pill이 선택되면 자기 색으로 꽉 차는 것과 같은 원리).
 * (2) "단일 노선과 동일하게, 색상 알이 미토글 상태에도 존재하게, 단 착발
 *     별 색상이 다르므로, 원 하나를 반반으로 나누어서 착발 별 색상이
 *     존재하게" — 단독 pill의 색상 점처럼 이 그룹에도 점을 두되, 착발 두
 *     색이 다르므로 원 하나를 반으로 갈라 각 절반에 각자의 색을 준다
 *     (linear-gradient 하드 스탑으로 원 안에서 정확히 반반으로 나뉜다).
 */
function DeparturePointGroup({ base, haengsin, suseo, selectedLineId, onSelect }: DeparturePointGroupProps) {
  const selectedLine = selectedLineId === haengsin.lineId ? haengsin : selectedLineId === suseo.lineId ? suseo : null

  return (
    <div
      role="group"
      aria-label={`${base} 착발 선택`}
      className={[
        'flex items-stretch overflow-hidden rounded-full border-2 transition-colors duration-200',
        selectedLine ? '' : 'border-slate-300 dark:border-slate-600',
      ].join(' ')}
      style={selectedLine?.colorHex ? { borderColor: selectedLine.colorHex } : undefined}
    >
      <span
        aria-hidden="true"
        className="flex items-center gap-1.5 whitespace-nowrap bg-slate-50 px-2.5 text-sm font-medium text-slate-500 dark:bg-slate-700/60 dark:text-slate-400"
      >
        <span
          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
          style={{
            background: `linear-gradient(90deg, ${haengsin.colorHex ?? '#9CA3AF'} 50%, ${suseo.colorHex ?? '#9CA3AF'} 50%)`,
          }}
        />
        {base}
      </span>
      <DeparturePointButton line={haengsin} label="행신착발" selectedLineId={selectedLineId} onSelect={onSelect} />
      <DeparturePointButton line={suseo} label="수서착발" selectedLineId={selectedLineId} onSelect={onSelect} borderStart />
    </div>
  )
}

interface DeparturePointButtonProps {
  line: LineRecord
  label: DeparturePoint
  selectedLineId: string | null
  onSelect: (lineId: string | null) => void
  /** 그룹 안에서 이름표/다른 착발 버튼과 맞닿는 쪽에 구분선을 붙인다. */
  borderStart?: boolean
}

/** 캡슐 안에 들어가는 착발 반쪽 버튼 — 자기 노선의 색·전체 이름은 그대로 유지한다. */
function DeparturePointButton({ line, label, selectedLineId, onSelect, borderStart }: DeparturePointButtonProps) {
  const isSelected = line.lineId === selectedLineId
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      aria-label={line.displayName}
      title={line.displayName}
      onClick={() => onSelect(isSelected ? null : line.lineId)}
      className={[
        'whitespace-nowrap px-2.5 py-1 text-sm transition-colors duration-200',
        borderStart ? 'border-l border-slate-300 dark:border-slate-600' : '',
        isSelected ? 'font-bold text-white' : 'font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-700/60',
      ].join(' ')}
      style={line.colorHex && isSelected ? { backgroundColor: line.colorHex } : undefined}
    >
      {label}
    </button>
  )
}
