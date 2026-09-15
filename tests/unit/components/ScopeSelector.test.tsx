import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScopeSelector } from '@/components/ScopeSelector'
import type { ScopeOption } from '@/lib/data/types'

const scopeOptions: ScopeOption[] = [
  { scopeCode: 'ALL', kind: 'ALL', nameKo: '전체', status: 'AVAILABLE', sortOrder: 0, regionCode: null, trainServiceCode: null },
  { scopeCode: 'SEOUL_METRO', kind: 'REGION', nameKo: '서울·수도권', status: 'AVAILABLE', sortOrder: 1, regionCode: 'SEOUL_METRO', trainServiceCode: null },
  { scopeCode: 'BUSAN', kind: 'REGION', nameKo: '부산', status: 'COMING_SOON', sortOrder: 2, regionCode: 'BUSAN', trainServiceCode: null },
  { scopeCode: 'KTX', kind: 'TRAIN_SERVICE', nameKo: 'KTX', status: 'COMING_SOON', sortOrder: 6, regionCode: null, trainServiceCode: 'KTX' },
]

describe('ScopeSelector', () => {
  it('운행 범위를 하나만 선택할 수 있다 (라디오 그룹)', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ScopeSelector scopeOptions={scopeOptions} selectedScopeCode="SEOUL_METRO" onSelect={onSelect} />)

    expect(screen.getByRole('radio', { name: '서울·수도권' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: '전체' })).toHaveAttribute('aria-checked', 'false')

    await user.click(screen.getByRole('radio', { name: '전체' }))
    expect(onSelect).toHaveBeenCalledWith('ALL')
  })

  it('아직 데이터가 없는 범위는 "추후 지원" 배지와 함께 비활성화된다', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ScopeSelector scopeOptions={scopeOptions} selectedScopeCode="SEOUL_METRO" onSelect={onSelect} />)

    const busanButton = screen.getByRole('radio', { name: /부산/ })
    expect(busanButton).toBeDisabled()
    expect(screen.getAllByText('추후 지원').length).toBeGreaterThan(0)

    await user.click(busanButton)
    expect(onSelect).not.toHaveBeenCalled()

    const ktxButton = screen.getByRole('radio', { name: /KTX/ })
    expect(ktxButton).toBeDisabled()
  })
})
