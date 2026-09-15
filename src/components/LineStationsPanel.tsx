import { useMemo, useState } from 'react'
import { listStationsOnLine } from '@/lib/search/engine'
import type { LineRecord, StationLineRecord } from '@/lib/search/types'
import { formatStationDisplayName } from '@/lib/displayName'
import { LineBadge } from './LineBadge'
import { LineIconBadge } from './LineIconBadge'

interface LineStationsPanelProps {
  /**
   * 현재 고른 범위로 좁힌 목록이 아니라 전체 station_line이어야 한다 — 그래야
   * 환승 배지가 지금 범위 바깥의 노선(예: KTX 범위에서 보고 있어도 지하철·SRT
   * 환승)까지 놓치지 않고 보여준다(사용자 확인). "이 노선"의 역 목록 자체는
   * line.lineId로 특정되므로 범위와 무관하게 항상 같다 — 영향받는 건 각 역에
   * 붙는 다른 노선 배지뿐이다.
   */
  allStationLines: StationLineRecord[]
  line: LineRecord
}

/**
 * 범위 + 노선을 고른 뒤 "이 노선의 역 보기"를 누르면 펼쳐지는 패널.
 * 노선 안 역을 물리적 순서(원본 STIN_CD 자연 정렬 기준, station_line.sequence)로
 * 나열한다. 환승역은 갈아탈 수 있는 다른 노선 배지를 함께 보여준다 — 지금 고른
 * 범위 밖의 노선(예: KTX 범위에서 보는 중이어도 지하철·SRT 환승)도 포함된다.
 */
export function LineStationsPanel({ allStationLines, line }: LineStationsPanelProps) {
  const [isOpen, setIsOpen] = useState(false)

  const stations = useMemo(
    () => listStationsOnLine(allStationLines, line.lineId),
    [allStationLines, line.lineId],
  )

  return (
    <section aria-labelledby="line-stations-heading">
      <button
        type="button"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-blue-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
      >
        <span className="flex items-center gap-2">
          {/* "노선 선택" 버튼과 달리, 이 패널의 배지만 stationListLabel이 있으면
              그걸 쓴다 — 지선이 있는 본선의 정체성을 여기서만 구체적으로 밝히기
              위해서다(사용자 확인: "밑에 리스트를 변경해달라는거였지, 위의 노선
              명을 바꾸라곤 안했어"). 없으면 다른 곳과 똑같이 displayName. */}
          <LineBadge label={line.stationListLabel ?? line.displayName} colorHex={line.colorHex} />
          <span id="line-stations-heading">
            {isOpen ? '이 노선의 역 접기' : '이 노선의 역 보기'} ({stations.length}개 역)
          </span>
        </span>
        <span aria-hidden="true" className={['transition-transform', isOpen ? 'rotate-180' : ''].join(' ')}>
          ▾
        </span>
      </button>

      {isOpen && (
        <ol className="mt-2 max-h-96 overflow-auto rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          {stations.length === 0 ? (
            <li className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">이 노선에 등록된 역이 없습니다.</li>
          ) : (
            stations.map((station, index) => (
              <li
                key={station.stationLineId}
                className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-2 last:border-b-0 dark:border-slate-700"
              >
                <span className="flex items-center gap-3 truncate">
                  <span className="w-8 shrink-0 text-right text-xs tabular-nums text-slate-400 dark:text-slate-500">
                    {index + 1}
                  </span>
                  <span className="truncate font-medium text-slate-800 dark:text-slate-100">
                    {formatStationDisplayName(station.displayStationName)}
                  </span>
                  {/* 지선이 갈라지는 분기역 표시 — 환승 배지(원형)와는 다르게
                      점선 태그로 구분해서, 본선-지선 사이는 "환승"이 아니라
                      "갈림"이라는 걸 드러낸다(사용자 확인). */}
                  {station.branchLines.map((l) => (
                    <span
                      key={l.lineId}
                      title={`${l.displayName} 갈림`}
                      className="shrink-0 rounded border border-dashed border-slate-300 px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap text-slate-500 dark:border-slate-600 dark:text-slate-400"
                    >
                      ↳ {l.displayName}
                    </span>
                  ))}
                </span>
                {station.transferLines.length > 0 && (
                  // 서울역·오송역처럼 배지가 10개 넘게 겹치면 한 줄에 다 못 들어가는데, max-w
                  // 없이는 shrink-0가 줄바꿈 자체를 막아 화면 밖으로 잘려 나가 버린다(역명이
                  // 잘리지 않도록 이쪽만 너비를 제한해 여러 줄로 접히게 한다) — 사용자 확인:
                  // "서울역, 오송역 같이 환승이 많은 역은 칸이 부족할거야".
                  <span className="flex max-w-[60%] shrink-0 flex-wrap items-center justify-end gap-1">
                    {station.transferLines.map((l) => (
                      <LineIconBadge key={l.lineId} iconLabel={l.iconLabel} displayName={l.displayName} colorHex={l.colorHex} lineCode={l.lineCode} />
                    ))}
                  </span>
                )}
              </li>
            ))
          )}
        </ol>
      )}
    </section>
  )
}
