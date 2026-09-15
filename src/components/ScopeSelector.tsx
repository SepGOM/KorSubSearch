import type { ScopeOption } from '@/lib/data/types'

interface ScopeSelectorProps {
  scopeOptions: ScopeOption[]
  selectedScopeCode: string | null
  onSelect: (scopeCode: string) => void
}

/**
 * 상단 "운행 범위 선택" 그리드. 지역(REGION)과 열차 종류(TRAIN_SERVICE)를 화면에서는
 * 같은 그리드에 두되, 데이터 상 kind 로 구분한다. 한 번에 하나만 선택 가능하다.
 * 데이터가 없는 범위는 "추후 지원" 배지와 함께 비활성화한다.
 */
export function ScopeSelector({ scopeOptions, selectedScopeCode, onSelect }: ScopeSelectorProps) {
  return (
    <section aria-labelledby="scope-selector-heading">
      <h2 id="scope-selector-heading" className="mb-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
        운행 범위 선택
      </h2>
      <div role="radiogroup" aria-labelledby="scope-selector-heading" className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {scopeOptions.map((scope) => {
          const isAvailable = scope.status === 'AVAILABLE'
          const isSelected = scope.scopeCode === selectedScopeCode
          return (
            <button
              key={scope.scopeCode}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={!isAvailable}
              onClick={() => isAvailable && onSelect(scope.scopeCode)}
              className={[
                'relative rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
                isAvailable
                  ? isSelected
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100'
                  : 'cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500',
              ].join(' ')}
            >
              {scope.nameKo}
              {!isAvailable && (
                <span className="absolute -top-2 -right-2 rounded-full bg-slate-400 px-1.5 py-0.5 text-[10px] leading-none text-white dark:bg-slate-600">
                  추후 지원
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
