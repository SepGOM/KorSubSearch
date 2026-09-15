import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LineSelector } from '@/components/LineSelector'
import { makeLine } from '../../fixtures/stationLines'

describe('LineSelector', () => {
  it('범위가 바뀌면(=lines prop이 바뀌면) 노선 목록도 갱신된다', () => {
    const line3 = makeLine({ officialName: '수도권 전철 3호선', displayName: '3호선', lineNumber: 3, colorHex: '#EF7C1C' })
    const { rerender } = render(<LineSelector lines={[line3]} selectedLineId={null} onSelect={() => {}} />)
    expect(screen.getByText('3호선')).toBeInTheDocument()
    expect(screen.queryByText('부산 1호선')).not.toBeInTheDocument()

    const busan1 = makeLine({ officialName: '부산 도시철도 1호선', displayName: '부산 1호선', lineNumber: 1 })
    rerender(<LineSelector lines={[busan1]} selectedLineId={null} onSelect={() => {}} />)
    expect(screen.queryByText('3호선')).not.toBeInTheDocument()
    expect(screen.getByText('부산 1호선')).toBeInTheDocument()
  })

  it('노선을 클릭하면 onSelect가 해당 lineId로 호출된다', async () => {
    const user = userEvent.setup()
    const line3 = makeLine({ officialName: '수도권 전철 3호선', displayName: '3호선', lineNumber: 3 })
    const onSelect = vi.fn()
    render(<LineSelector lines={[line3]} selectedLineId={null} onSelect={onSelect} />)

    await user.click(screen.getByText('3호선'))
    expect(onSelect).toHaveBeenCalledWith(line3.lineId)

    await user.click(screen.getByText('전체 노선'))
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('이미 선택된 노선을 다시 클릭하면 전체 노선(null)로 돌아간다', async () => {
    const user = userEvent.setup()
    const line3 = makeLine({ officialName: '수도권 전철 3호선', displayName: '3호선', lineNumber: 3, colorHex: '#EF7C1C' })
    const onSelect = vi.fn()
    render(<LineSelector lines={[line3]} selectedLineId={line3.lineId} onSelect={onSelect} />)

    await user.click(screen.getByText('3호선'))
    expect(onSelect).toHaveBeenCalledWith(null)
  })

  it('선택된 노선의 글자는 흰색 볼드체로 표시된다', () => {
    const line3 = makeLine({ officialName: '수도권 전철 3호선', displayName: '3호선', lineNumber: 3, colorHex: '#EF7C1C' })
    render(<LineSelector lines={[line3]} selectedLineId={line3.lineId} onSelect={() => {}} />)

    const button = screen.getByText('3호선').closest('button')!
    expect(button).toHaveClass('font-bold', 'text-white')
    expect(button).toHaveStyle({ backgroundColor: '#EF7C1C' })
  })

  it('노선이 하나도 없으면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(<LineSelector lines={[]} selectedLineId={null} onSelect={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
})
