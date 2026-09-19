import { useMemo, useState } from 'react'
import { useSearchIndex } from '@/hooks/useSearchIndex'
import { deriveSelectableLines, deriveDescendantLines } from '@/lib/data/deriveLines'
import { ScopeSelector } from '@/components/ScopeSelector'
import { LineSelector } from '@/components/LineSelector'
import { SearchBox } from '@/components/SearchBox'
import { LineStationsPanel } from '@/components/LineStationsPanel'
import type { StationLineRecord } from '@/lib/search/types'

const DEFAULT_SCOPE_CODE = 'SEOUL_METRO'

function App() {
  const indexState = useSearchIndex()
  // null = 아직 사용자가 직접 고르지 않았다 → 데이터가 준비되면 기본값(서울·수도권)을 그 자리에서 계산한다.
  const [chosenScopeCode, setSelectedScopeCode] = useState<string | null>(null)
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null)

  const selectedScopeCode =
    chosenScopeCode ??
    (indexState.status === 'ready'
      ? (indexState.index.scopeOptions.find((s) => s.scopeCode === DEFAULT_SCOPE_CODE)?.scopeCode ??
        indexState.index.scopeOptions[0]?.scopeCode ??
        null)
      : null)

  const selectedScope =
    indexState.status === 'ready'
      ? (indexState.index.scopeOptions.find((s) => s.scopeCode === selectedScopeCode) ?? null)
      : null

  const candidatesForScope: StationLineRecord[] = useMemo(() => {
    if (indexState.status !== 'ready' || !selectedScope) return []
    if (selectedScope.kind === 'ALL') return indexState.index.stationLines
    // KTX/SRT처럼 "열차 종류"로 좁혀야 하는 범위는 line.trainServiceCode로 거른다
    // — line.regionCode가 아니다. KTX와 SRT는 실제로 같은 물리적 역을 많이
    // 공유해서 같은 pseudo-region("KTX")을 쓰고 그 덕에 자동으로 병합되지만,
    // 화면에서는 서로 다른 버튼(브랜드)으로 봐야 하므로 regionCode만으로는
    // 두 범위를 구분할 수 없다. trainServiceCode가 없는 범위(도시 지역)는
    // 기존대로 line.regionCode로 거른다.
    //
    // station.regionCode가 아니라 line.regionCode/line.trainServiceCode를 쓰는
    // 이유: KTX 서울역처럼 "도시 지역 노선 + KTX 노선"이 한 역에서 만나는
    // 환승역은 station 자체는 병합 대표(예: SEOUL_METRO 서울역)의 지역 하나만
    // 갖지만, 그 역에 딸린 개별 station_line(예: "KTX-경부")은 자기 노선이 속한
    // 범위를 그대로 유지한다. station 쪽 값으로 필터링하면 그런 환승역의 행이
    // 통째로 빠져 버린다.
    // 데이터가 없는 열차 종류는 그 코드를 가진 line이 없어 자연히 빈 배열이 된다.
    if (selectedScope.trainServiceCode) {
      return indexState.index.stationLines.filter(
        (r) => r.line.trainServiceCode === selectedScope.trainServiceCode,
      )
    }
    // 도시 지역 범위에서는 열차 종류(trainServiceCode)가 있는 노선을 뺀다 — ITX-청춘은
    // 경춘선과 같은 서울·수도권 region을 써서(그래야 경춘선·1호선 등과 자동으로 같은
    // 역으로 합쳐진다) regionCode만 보면 "서울·수도권" 노선 선택에 섞여 들어온다.
    if (selectedScope.regionCode) {
      return indexState.index.stationLines.filter(
        (r) => r.line.regionCode === selectedScope.regionCode && !r.line.trainServiceCode,
      )
    }
    return []
  }, [indexState, selectedScope])

  const linesForScope = useMemo(() => deriveSelectableLines(candidatesForScope), [candidatesForScope])
  const selectedLine = linesForScope.find((l) => l.lineId === selectedLineId) ?? null

  // 지선(예: 경춘선의 망우선)은 "노선 선택"에는 안 나오지만, 본선을 고르면
  // 본선 패널 아래에 자기 패널로 함께 나온다(사용자 확인) — 지금 고른 범위와
  // 무관하게 항상 나오도록 전체 station_line에서 찾는다(확장 12·14와 같은 원칙).
  // 지선의 지선(예: 1호선 경부/장항선 안에서 다시 갈라지는 경부고속선·병점기지선,
  // 확장 24)까지 몇 단계든 모두 함께 나오도록 재귀적으로 모은다.
  const childLines = useMemo(() => {
    if (!selectedLine || indexState.status !== 'ready') return []
    return deriveDescendantLines(indexState.index.stationLines, selectedLine.lineId)
  }, [selectedLine, indexState])

  function handleSelectScope(scopeCode: string): void {
    setSelectedScopeCode(scopeCode)
    setSelectedLineId(null)
  }

  const isSearchDisabled = indexState.status !== 'ready' || selectedScope?.status !== 'AVAILABLE'
  const disabledReason =
    indexState.status === 'loading'
      ? '데이터를 불러오는 중입니다…'
      : indexState.status === 'error'
        ? '데이터를 불러오지 못했습니다.'
        : selectedScope?.status !== 'AVAILABLE'
          ? `${selectedScope?.nameKo ?? '이 범위'}는 추후 지원 예정입니다.`
          : undefined

  return (
    <div className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 bg-slate-50 px-4 py-8 text-slate-900 dark:bg-slate-900 dark:text-slate-50">
      <header>
        <h1 className="text-2xl font-bold">대한민국 역명 통합 검색</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          지역과 노선을 넘나드는 전철·철도역 이름을 하나로 통합해 검색합니다.
        </p>
      </header>

      {indexState.status === 'error' && (
        <div role="alert" className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          데이터를 불러오지 못했습니다: {indexState.message}
        </div>
      )}

      {indexState.status === 'ready' && (
        <ScopeSelector
          scopeOptions={indexState.index.scopeOptions}
          selectedScopeCode={selectedScopeCode}
          onSelect={handleSelectScope}
        />
      )}

      {indexState.status === 'ready' && selectedScope?.status === 'AVAILABLE' && (
        <LineSelector lines={linesForScope} selectedLineId={selectedLineId} onSelect={setSelectedLineId} />
      )}

      {indexState.status === 'ready' && selectedScope?.status === 'AVAILABLE' && selectedLine && (
        <div className="flex flex-col gap-3">
          <LineStationsPanel allStationLines={indexState.index.stationLines} line={selectedLine} />
          {childLines.map((child) => (
            <LineStationsPanel key={child.lineId} allStationLines={indexState.index.stationLines} line={child} />
          ))}
        </div>
      )}

      <SearchBox
        candidates={candidatesForScope}
        allStationLines={indexState.status === 'ready' ? indexState.index.stationLines : []}
        lineId={selectedLineId}
        disabled={isSearchDisabled}
        disabledReason={disabledReason}
      />

      <footer className="mt-auto pt-8 text-xs text-slate-400 dark:text-slate-500">
        데이터 출처: 공공데이터포털(data.go.kr) 국가철도공단/한국철도공사 자료, 위키백과 노선색 문서. 자세한 내용은
        README와 docs/data-integration-rules.md 를 참고하세요.
      </footer>
    </div>
  )
}

export default App
