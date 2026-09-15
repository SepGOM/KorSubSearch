import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SearchBox } from '@/components/SearchBox'
import { makeLine, makeStationLine } from '../../fixtures/stationLines'

const line3 = makeLine({ officialName: '수도권 전철 3호선', displayName: '3호선', lineNumber: 3, colorHex: '#EF7C1C' })
const line5 = makeLine({ officialName: '수도권 전철 5호선', displayName: '5호선', lineNumber: 5, colorHex: '#996CAC' })

// 오금역은 실제 환승역이므로 같은 stationId를 준다(가져오기 단계의 병합 결과를 흉내).
const OGEUM_STATION_ID = 'STN-OGEUM'
const candidates = [
  makeStationLine('오금역', line3, { stationId: OGEUM_STATION_ID }),
  makeStationLine('오금역', line5, { stationId: OGEUM_STATION_ID }),
  makeStationLine('무악재역', line3),
]

describe('SearchBox', () => {
  it('환승역(같은 station_id)은 한 행에 노선 배지 여러 개로 표시된다', async () => {
    const user = userEvent.setup()
    render(<SearchBox candidates={candidates} allStationLines={candidates} lineId={null} />)

    await user.type(screen.getByRole('combobox'), '오금')

    const listbox = await screen.findByRole('listbox')
    const options = await within(listbox).findAllByRole('option')
    expect(options).toHaveLength(1) // 오금역은 한 행으로 합쳐진다

    // 배지는 이제 원형 아이콘(짧은 글자)만 보여주고 전체 이름은 접근성 라벨(title/aria-label)로 남긴다.
    expect(within(listbox).getByRole('img', { name: '3호선' })).toBeInTheDocument()
    expect(within(listbox).getByRole('img', { name: '5호선' })).toBeInTheDocument()
    // 3호선 배지가 실제 노선 색상(#EF7C1C)을 쓰는지 확인
    expect(within(listbox).getByRole('img', { name: '3호선' })).toHaveStyle({ backgroundColor: '#EF7C1C' })
  })

  it('결과가 없으면 "검색 결과가 없습니다" 상태를 보여준다', async () => {
    const user = userEvent.setup()
    render(<SearchBox candidates={candidates} allStationLines={candidates} lineId={null} />)
    await user.type(screen.getByRole('combobox'), '존재하지않는역이름')
    expect(await screen.findByText('검색 결과가 없습니다.')).toBeInTheDocument()
  })

  it('비활성화 상태면 안내 문구를 placeholder로 보여주고 입력할 수 없다', () => {
    render(<SearchBox candidates={[]} allStationLines={[]} lineId={null} disabled disabledReason="이 범위는 추후 지원 예정입니다." />)
    const input = screen.getByRole('combobox')
    expect(input).toBeDisabled()
    expect(input).toHaveAttribute('placeholder', '이 범위는 추후 지원 예정입니다.')
  })

  it('방향키로 이동하고 Enter로 선택할 수 있다 (키보드 자동완성 조작)', async () => {
    const user = userEvent.setup()
    render(<SearchBox candidates={candidates} allStationLines={candidates} lineId={null} />)

    const input = screen.getByRole('combobox')
    // "3"은 3호선 필터만 걸어 무악재역·오금역 두 그룹을 모두 매칭시킨다.
    await user.type(input, '3')
    const options = await screen.findAllByRole('option') // 디바운스가 끝나고 결과가 실제로 뜰 때까지 대기
    expect(options).toHaveLength(2)

    // 가나다순으로 무악재역(0번째) 다음이 오금역(1번째).
    await user.keyboard('{ArrowDown}')
    await user.keyboard('{Enter}')

    expect(input).toHaveValue('오금') // "역" 접미사 없이 채워진다
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('Escape를 누르면 목록이 닫힌다', async () => {
    const user = userEvent.setup()
    render(<SearchBox candidates={candidates} allStationLines={candidates} lineId={null} />)
    await user.type(screen.getByRole('combobox'), '오금')
    await screen.findByRole('listbox') // 로딩 중이어도(결과 없이도) 열려 있어야 한다

    await user.keyboard('{Escape}')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('마우스로 항목을 클릭해 선택할 수 있다', async () => {
    const user = userEvent.setup()
    render(<SearchBox candidates={candidates} allStationLines={candidates} lineId={null} />)
    const input = screen.getByRole('combobox')
    await user.type(input, '무악재')

    const options = await screen.findAllByRole('option')
    const target = options.find((o) => o.textContent?.includes('무악재'))
    expect(target).toBeTruthy()
    await user.click(target!)

    expect(input).toHaveValue('무악재') // "역" 접미사 없이 채워진다
  })

  it('station_id가 다른 동명이역은 별도 행으로 각각 표시된다', async () => {
    const gyeonguiLine = makeLine({ officialName: '수도권 전철 경의·중앙선', displayName: '경의중앙선' })
    const sameNameDifferentStations = [
      makeStationLine('신촌역', line5, { stationId: 'STN-SINCHON-A' }),
      makeStationLine('신촌역', gyeonguiLine, { stationId: 'STN-SINCHON-B' }),
    ]
    const user = userEvent.setup()
    render(<SearchBox candidates={sameNameDifferentStations} allStationLines={sameNameDifferentStations} lineId={null} />)
    await user.type(screen.getByRole('combobox'), '신촌')

    const listbox = await screen.findByRole('listbox')
    const options = await within(listbox).findAllByRole('option')
    expect(options).toHaveLength(2)
    // 각 행에는 노선 배지가 하나씩만 붙는다(환승역이 아니므로 합치지 않는다).
    for (const option of options) {
      expect(within(option).getAllByRole('img')).toHaveLength(1)
    }
  })

  it('범위로 좁힌 candidates에는 없어도, allStationLines에 있는 다른 범위의 환승 노선 배지를 보여준다', async () => {
    // 오금역을 3호선(현재 범위 안)·5호선(다른 범위, candidates에는 없음)이 공용한다고 가정.
    const ogeumInScope = makeStationLine('오금역', line3, { stationId: OGEUM_STATION_ID })
    const ogeumOutOfScope = makeStationLine('오금역', line5, { stationId: OGEUM_STATION_ID })
    const scopedCandidates = [ogeumInScope] // 5호선은 이 범위엔 없다.
    const fullDataset = [ogeumInScope, ogeumOutOfScope]

    const user = userEvent.setup()
    render(<SearchBox candidates={scopedCandidates} allStationLines={fullDataset} lineId={null} />)
    await user.type(screen.getByRole('combobox'), '오금')

    const listbox = await screen.findByRole('listbox')
    await within(listbox).findAllByRole('option') // 디바운스가 끝날 때까지 대기
    // 검색 대상 자체는 범위 안(3호선)에서만 매칭되지만, 배지는 범위 밖 5호선도 함께 보여준다.
    expect(within(listbox).getByRole('img', { name: '3호선' })).toBeInTheDocument()
    expect(within(listbox).getByRole('img', { name: '5호선' })).toBeInTheDocument()
  })
})
