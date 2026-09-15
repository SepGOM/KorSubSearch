import { useId, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { searchGrouped, type StationSearchGroup } from '@/lib/search/engine'
import type { StationLineRecord } from '@/lib/search/types'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { tokenizeQuery } from '@/lib/normalize/tokenize'
import { formatStationDisplayName } from '@/lib/displayName'
import { highlightMatch } from '@/lib/highlightMatch'
import { LineIconBadge } from './LineIconBadge'

interface SearchBoxProps {
  candidates: StationLineRecord[]
  /**
   * 환승 배지 계산용 전체(비범위) station_line. 검색 대상 자체는 candidates
   * (지금 고른 범위·노선)로 좁혀지지만, 결과에 붙는 환승 노선 배지는 이
   * 전체 배열을 기준으로 계산해 지금 범위 밖의 환승(예: KTX 범위에서 지하철·
   * SRT 환승)도 놓치지 않는다 — "이 노선의 역 보기"와 같은 원칙(사용자 확인).
   */
  allStationLines: StationLineRecord[]
  lineId: string | null
  disabled?: boolean
  disabledReason?: string
}

const DEBOUNCE_MS = 150

/**
 * 역명 검색 자동완성 콤보박스. WAI-ARIA combobox/listbox 패턴을 따른다.
 * 역 단위로 결과를 묶어 표시한다 — 실제 환승역(같은 station_id)은 한 행에
 * 노선 배지 여러 개로, 이름만 같은 동명이역은 여전히 별도 행으로 나온다.
 */
export function SearchBox({ candidates, allStationLines, lineId, disabled, disabledReason }: SearchBoxProps) {
  const [query, setQuery] = useState('')
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS)
  const [isOpen, setIsOpen] = useState(false)
  // null = 키보드로 아직 이동하지 않음 → 결과가 있으면 0번째를 기본 활성 항목으로 본다.
  const [manualActiveIndex, setManualActiveIndex] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listboxId = useId()

  const isPendingDebounce = query.trim().length > 0 && query !== debouncedQuery

  const groups: StationSearchGroup[] = useMemo(() => {
    if (disabled) return []
    return searchGrouped(candidates, debouncedQuery, { lineId, allStationLines })
  }, [candidates, debouncedQuery, lineId, disabled, allStationLines])

  const activeIndex = groups.length === 0 ? -1 : Math.min(manualActiveIndex ?? 0, groups.length - 1)
  const tokens = useMemo(() => tokenizeQuery(debouncedQuery), [debouncedQuery])

  function selectResult(group: StationSearchGroup): void {
    // 목록 표시와 마찬가지로 "역" 접미사 없이 채운다.
    setQuery(formatStationDisplayName(group.displayStationName))
    setIsOpen(false)
    inputRef.current?.blur()
  }

  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    const value = event.target.value
    setQuery(value)
    setIsOpen(value.trim().length > 0)
    setManualActiveIndex(null)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'ArrowDown' && !isOpen && query.trim().length > 0) {
      setIsOpen(true)
      return
    }
    if (!isOpen) return

    // Escape는 결과가 없어도(로딩/결과 없음 상태 포함) 항상 목록을 닫을 수 있어야 한다.
    if (event.key === 'Escape') {
      event.preventDefault()
      setIsOpen(false)
      return
    }
    if (groups.length === 0) return

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setManualActiveIndex((activeIndex + 1) % groups.length)
        break
      case 'ArrowUp':
        event.preventDefault()
        setManualActiveIndex((activeIndex - 1 + groups.length) % groups.length)
        break
      case 'Enter':
        event.preventDefault()
        if (activeIndex >= 0 && activeIndex < groups.length) selectResult(groups[activeIndex])
        break
    }
  }

  const showListbox = isOpen && !disabled

  return (
    <div className="relative">
      <label
        htmlFor="station-search-input"
        className="mb-2 block text-sm font-semibold text-slate-600 dark:text-slate-300"
      >
        역명 검색
      </label>
      <input
        id="station-search-input"
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={showListbox}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined}
        autoComplete="off"
        disabled={disabled}
        placeholder={
          disabled
            ? (disabledReason ?? '이 범위는 아직 지원하지 않습니다')
            : '역명, 노선 번호, 초성으로 검색'
        }
        value={query}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={() => query.trim().length > 0 && setIsOpen(true)}
        onBlur={() => setIsOpen(false)}
        className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-base text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      />

      {showListbox && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="역 검색 결과"
          className="absolute z-10 mt-1 max-h-96 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800"
        >
          {isPendingDebounce ? (
            <li className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
              검색 중…
            </li>
          ) : groups.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400" aria-live="polite">
              검색 결과가 없습니다.
            </li>
          ) : (
            groups.map((group, index) => {
              // 목록에는 "역" 접미사 없이 역명만 보여준다(예: "방학역" → "방학").
              const displayName = formatStationDisplayName(group.displayStationName)
              const segments = highlightMatch(displayName, tokens)
              const isActive = index === activeIndex
              return (
                <li
                  key={group.stationId}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={isActive}
                  onMouseEnter={() => setManualActiveIndex(index)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    selectResult(group)
                  }}
                  className={[
                    'flex cursor-pointer items-center justify-between gap-3 px-4 py-2.5',
                    isActive ? 'bg-blue-50 dark:bg-slate-700/70' : '',
                  ].join(' ')}
                >
                  <span className="truncate font-medium text-slate-800 dark:text-slate-100">
                    {segments.map((seg, i) =>
                      seg.matched ? (
                        <mark key={i} className="rounded-sm bg-yellow-200 px-0.5 text-inherit dark:bg-yellow-500/40">
                          {seg.text}
                        </mark>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      ),
                    )}
                  </span>
                  {/* 환승역은 노선 배지가 여러 개 붙는다 — 실제 병합된 역만 그렇다. 서울역·
                      오송역처럼 배지가 10개 넘게 겹치면 한 줄에 다 못 들어가는데, max-w
                      없이는 shrink-0가 줄바꿈 자체를 막아 화면 밖으로 잘려 나가 버린다
                      (역명이 잘리지 않도록 이쪽만 너비를 제한해 여러 줄로 접히게 한다) —
                      사용자 확인: "서울역, 오송역 같이 환승이 많은 역은 칸이 부족할거야". */}
                  <span className="flex max-w-[60%] shrink-0 flex-wrap items-center justify-end gap-1">
                    {group.lines.map((l) => (
                      <LineIconBadge
                        key={l.stationLineId}
                        iconLabel={l.line.iconLabel}
                        displayName={l.line.displayName}
                        colorHex={l.line.colorHex}
                        lineCode={l.line.lineCode}
                      />
                    ))}
                  </span>
                </li>
              )
            })
          )}
        </ul>
      )}
    </div>
  )
}
