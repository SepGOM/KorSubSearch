import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  // 데이터(정적 JSON) 로딩과 기본 운행 범위(서울·수도권) 선택이 끝날 때까지 대기.
  await expect(page.getByRole('radio', { name: '서울·수도권' })).toHaveAttribute('aria-checked', 'true')
})

test('운행 범위는 한 번에 하나만 선택된다', async ({ page }) => {
  const all = page.getByRole('radio', { name: '전체' })
  const seoul = page.getByRole('radio', { name: '서울·수도권' })

  await expect(seoul).toHaveAttribute('aria-checked', 'true')
  await expect(all).toHaveAttribute('aria-checked', 'false')

  await all.click()
  await expect(all).toHaveAttribute('aria-checked', 'true')
  await expect(seoul).toHaveAttribute('aria-checked', 'false')
})

test('아직 데이터가 없는 열차 종류(ITX)는 "추후 지원" 상태로 비활성화되어 있다', async ({ page }) => {
  const itx = page.getByRole('radio', { name: 'ITX' })
  await expect(itx).toBeDisabled()
  await expect(page.getByText('추후 지원').first()).toBeVisible()

  // 비활성 범위를 눌러도 선택은 바뀌지 않는다.
  await itx.click({ force: true })
  await expect(page.getByRole('radio', { name: '서울·수도권' })).toHaveAttribute('aria-checked', 'true')
})

test('5개 지역(서울·수도권/부산/대구/광주/대전)과 KTX/무궁화호가 모두 활성화되어 있다(2026-09-16 2차: SRT는 KTX로 통합돼 별도 버튼이 없다)', async ({
  page,
}) => {
  for (const name of ['서울·수도권', '부산', '대구', '광주', '대전', 'KTX', '무궁화호']) {
    await expect(page.getByRole('radio', { name })).toBeEnabled()
  }
  await expect(page.getByRole('radio', { name: 'SRT' })).toHaveCount(0)
})

test('범위를 바꾸면 노선 선택 목록도 갱신된다', async ({ page }) => {
  await expect(page.getByRole('button', { name: '3호선', exact: true })).toHaveCount(1)

  // 부산으로 바꾸면 서울 노선은 사라지고 부산 노선이 나타난다.
  await page.getByRole('radio', { name: '부산' }).click()
  await expect(page.getByRole('button', { name: '수인분당선' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '부산김해경전철' })).toBeVisible()

  // "전체"로 바꾸면 서울·부산 노선이 함께 나타난다. 서울·수도권 외 지역의 숫자
  // 노선은 지역명을 붙여 구분한다("부산 3호선") — 서울 "3호선"과 헷갈리지 않는다.
  await page.getByRole('radio', { name: '전체' }).click()
  await expect(page.getByRole('button', { name: '3호선', exact: true })).toHaveCount(1)
  await expect(page.getByRole('button', { name: '부산 3호선', exact: true })).toBeVisible()
})

test('오금은 실제 환승역이므로 한 행에 3호선·5호선 배지가 함께 표시된다', async ({ page }) => {
  // 2026-09-14: 오금은 5호선 본선이 아니라 지선(마천지선) 소속으로 재분류됐지만,
  // 지선은 검색 배지에서 항상 본선 이름으로 치환된다(사용자 확인: "큰 노선만
  // 하나만 표기") — 그래서 "마천지선"이 아니라 "5호선"으로 나온다.
  await page.getByRole('combobox').fill('오금')

  const listbox = page.getByRole('listbox')
  await expect(listbox).toBeVisible()
  const options = listbox.getByRole('option')
  await expect(options).toHaveCount(1) // 같은 역이므로 한 행으로 합쳐진다

  // 배지는 원형 아이콘(짧은 글자)만 보여주고 전체 노선명은 접근성 라벨(aria-label)로 남긴다.
  await expect(listbox.getByRole('img', { name: '3호선' })).toBeVisible()
  await expect(listbox.getByRole('img', { name: '5호선' })).toBeVisible()
  await expect(listbox.getByRole('img', { name: '마천지선' })).toHaveCount(0)

  const line3Badge = listbox.getByRole('img', { name: '3호선' })
  await expect(line3Badge).toHaveCSS('background-color', 'rgb(239, 124, 28)') // #EF7C1C
})

test('신촌은 동명이역이라 2호선·경의1선이 서로 다른 행으로 표시된다', async ({ page }) => {
  await page.getByRole('combobox').fill('신촌')

  const listbox = page.getByRole('listbox')
  await expect(listbox).toBeVisible()
  const options = listbox.getByRole('option')
  await expect(options).toHaveCount(2) // 실제로는 환승되지 않는 별개의 역이므로 합치지 않는다
})

test('키보드로 자동완성을 조작할 수 있다 (방향키 이동, Enter 선택, Escape 닫기)', async ({ page }) => {
  const input = page.getByRole('combobox')
  await input.fill('오금')
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(1)

  await input.press('ArrowDown')
  await input.press('Enter')
  await expect(input).toHaveValue('오금') // "역" 접미사 없이 채워진다
  await expect(page.getByRole('listbox')).toHaveCount(0)

  await input.fill('무악재')
  await expect(page.getByRole('listbox')).toBeVisible()
  await input.press('Escape')
  await expect(page.getByRole('listbox')).toHaveCount(0)
})

test('3 ㅁㅇㅈ 는 무악재역 3호선만 반환한다', async ({ page }) => {
  await page.getByRole('combobox').fill('3 ㅁㅇㅈ')
  const listbox = page.getByRole('listbox')
  const options = listbox.getByRole('option')
  await expect(options).toHaveCount(1)
  await expect(options.first()).toContainText('무악재')
  await expect(options.first().getByRole('img', { name: '3호선' })).toBeVisible()
})

test('부산 범위를 선택하면 부산 역만 검색된다 (서면은 환승역이라 1호선·2호선이 한 행에)', async ({ page }) => {
  await page.getByRole('radio', { name: '부산' }).click()
  await expect(page.getByRole('radio', { name: '부산' })).toHaveAttribute('aria-checked', 'true')

  await page.getByRole('combobox').fill('서면')
  const listbox = page.getByRole('listbox')
  const options = listbox.getByRole('option')
  await expect(options).toHaveCount(1)
  await expect(listbox.getByRole('img', { name: '부산 1호선' })).toBeVisible()
  await expect(listbox.getByRole('img', { name: '부산 2호선' })).toBeVisible()

  // 서울 역명으로 검색하면 결과가 없어야 한다 (지역이 섞이지 않는다).
  await page.getByRole('combobox').fill('오금')
  await expect(page.getByText('검색 결과가 없습니다.')).toBeVisible()
})

test('"전체" 범위에서 "1"만 입력하면 수도권 1호선만 나오고, 지역 전용 키워드("인1")로는 인천 1호선만 나온다(사용자 확인: "1만 입력해도 인천, 부산, 대구, 광주 다 뜨기 때문")', async ({
  page,
}) => {
  await page.getByRole('radio', { name: '전체' }).click()

  await page.getByRole('combobox').fill('1')
  const listbox = page.getByRole('listbox')
  await expect(listbox.getByRole('option').first()).toBeVisible()
  // 결과에 뜬 노선 배지가 전부 "1호선"(수도권)이어야 하고, 인천/부산/대구/광주/대전
  // 1호선 배지는 하나도 섞이면 안 된다.
  await expect(listbox.getByRole('img', { name: '1호선', exact: true }).first()).toBeVisible()
  for (const name of ['인천 1호선', '부산 1호선', '대구 1호선', '광주 1호선', '대전 1호선']) {
    await expect(listbox.getByRole('img', { name })).toHaveCount(0)
  }

  await page.getByRole('combobox').fill('인1')
  await expect(listbox.getByRole('option').first()).toBeVisible()
  await expect(listbox.getByRole('img', { name: '인천 1호선' }).first()).toBeVisible()
  await expect(listbox.getByRole('img', { name: '1호선', exact: true })).toHaveCount(0)
})

test('"부산" 범위로 좁히면 접두어 없는 "1"만으로도 부산 1호선이 검색된다(사용자 확인: "운행 범위를 부산으로 지정 시, 1만 적어도 부산 1호선이 검색되어야 한다")', async ({
  page,
}) => {
  await page.getByRole('radio', { name: '부산' }).click()
  await page.getByRole('combobox').fill('1')
  const listbox = page.getByRole('listbox')
  await expect(listbox.getByRole('option').first()).toBeVisible()
  await expect(listbox.getByRole('img', { name: '부산 1호선' }).first()).toBeVisible()
})

test('지선 자신의 이름으로는 필터링되지 않는다 — "마천지선"·"경의1선"은 검색 결과가 없다(사용자 확인: "마천지선 또는 경의1선과 같은걸로는 필터링 되지 않게")', async ({
  page,
}) => {
  const combobox = page.getByRole('combobox')
  await combobox.fill('마천지선')
  await expect(page.getByText('검색 결과가 없습니다.')).toBeVisible()

  await combobox.fill('경의1선')
  await expect(page.getByText('검색 결과가 없습니다.')).toBeVisible()
})

test('대구 범위: 반월당은 1호선·2호선 환승역으로 한 행에 표시된다', async ({ page }) => {
  await page.getByRole('radio', { name: '대구' }).click()
  await page.getByRole('combobox').fill('반월당')

  const listbox = page.getByRole('listbox')
  const options = listbox.getByRole('option')
  await expect(options).toHaveCount(1)
  await expect(listbox.getByRole('img', { name: '대구 1호선' })).toBeVisible()
  await expect(listbox.getByRole('img', { name: '대구 2호선' })).toBeVisible()
})

test('광주·대전 범위에서도 검색된다', async ({ page }) => {
  await page.getByRole('radio', { name: '광주' }).click()
  await expect(page.getByRole('button', { name: '광주 1호선' })).toBeVisible()
  await page.getByRole('combobox').fill('금남로')
  await expect(page.getByRole('listbox')).toBeVisible()
  await expect(page.getByRole('listbox').getByRole('option').first()).toBeVisible()

  await page.getByRole('radio', { name: '대전' }).click()
  await expect(page.getByRole('button', { name: '대전 1호선' })).toBeVisible()
})

test('부산 동래역: 1·4호선은 환승으로 합쳐지고 동해선은 별도 행이다', async ({ page }) => {
  await page.getByRole('radio', { name: '부산' }).click()
  await page.getByRole('combobox').fill('동래')

  const listbox = page.getByRole('listbox')
  const options = listbox.getByRole('option')
  await expect(options).toHaveCount(2)

  const transferRow = options.filter({ has: page.getByRole('img', { name: '부산 1호선' }) })
  await expect(transferRow).toHaveCount(1)
  await expect(transferRow.getByRole('img', { name: '부산 4호선' })).toBeVisible()

  const donghaeRow = options.filter({ has: page.getByRole('img', { name: '동해선' }) })
  await expect(donghaeRow).toHaveCount(1)
  await expect(donghaeRow.getByRole('img', { name: '부산 1호선' })).toHaveCount(0)
})

test('"전체 노선"에서는 노선 역 목록 버튼이 없고, 노선을 고르면 나타난다', async ({ page }) => {
  await expect(page.getByRole('button', { name: /이 노선의 역 보기/ })).toHaveCount(0)

  // "노선 선택" 버튼 자체는 그대로 "2호선"이다(사용자 확인: "밑에 리스트를
  // 변경해달라는거였지, 위의 노선 명을 바꾸라곤 안했어") — "이 노선의 역 보기"
  // 패널 안에서만 "을지로순환선(본선)"으로 표시된다.
  await page.getByRole('button', { name: '2호선', exact: true }).click()
  // 2호선을 고르면 본선 + 성수지선 + 신정지선 세 패널 버튼이 함께 나온다.
  const toggle = page.getByRole('button', { name: /을지로순환선\(본선\).*이 노선의 역 보기/ })
  await expect(toggle).toBeVisible()

  // 다시 "전체 노선"으로 돌아가면 버튼도 사라진다.
  await page.getByRole('button', { name: '전체 노선' }).click()
  await expect(page.getByRole('button', { name: /이 노선의 역/ })).toHaveCount(0)
})

test('2호선(패널 안에서는 "을지로순환선(본선)") 역 목록은 실제 순환선 순서(시청→을지로입구→을지로3가)대로 나오고, 성수·신정 두 지선 패널이 함께 나온다', async ({
  page,
}) => {
  await page.getByRole('button', { name: '2호선', exact: true }).click()

  // "노선 선택" 목록엔 성수지선·신정지선이 없다.
  await expect(page.getByRole('button', { name: '성수지선', exact: true })).not.toBeVisible()
  await expect(page.getByRole('button', { name: '신정지선', exact: true })).not.toBeVisible()

  const mainPanelButton = page.getByRole('button', { name: /을지로순환선\(본선\).*이 노선의 역 (보기|접기)/ })
  await mainPanelButton.click()

  const panel = page.getByRole('list').first()
  const items = panel.getByRole('listitem')

  await expect(items.nth(0)).toContainText('시청')
  await expect(items.nth(0).getByRole('img', { name: '1호선' })).toBeVisible() // 시청은 1호선 환승역
  await expect(items.nth(1)).toContainText('을지로입구')
  await expect(items.nth(2)).toContainText('을지로3가')
  await expect(items.nth(2).getByRole('img', { name: '3호선' })).toBeVisible()

  // 본선 목록의 성수·신도림 행에는 원형 환승 배지가 아니라 분기 표시(점선 태그)가 붙는다.
  const seongsuRow = items.filter({ hasText: '성수' })
  await expect(seongsuRow.getByText('성수지선', { exact: false })).toBeVisible()
  await expect(seongsuRow.getByRole('img', { name: '성수지선' })).toHaveCount(0)

  const sindorimRow = items.filter({ hasText: '신도림' })
  await expect(sindorimRow.getByText('신정지선', { exact: false })).toBeVisible()
  await expect(sindorimRow.getByRole('img', { name: '신정지선' })).toHaveCount(0)

  // 성수지선 패널: 4개 역, 성수→용답→신답→용두→신설동.
  const seongsuPanelButton = page.getByRole('button', { name: /성수지선.*이 노선의 역 (보기|접기)/ })
  await expect(seongsuPanelButton).toContainText('5개 역')
  await seongsuPanelButton.click()
  const seongsuItems = page.getByRole('list').nth(1).getByRole('listitem')
  await expect(seongsuItems.nth(0)).toContainText('성수')
  await expect(seongsuItems.nth(1)).toContainText('용답')
  await expect(seongsuItems.nth(2)).toContainText('신답')
  await expect(seongsuItems.nth(3)).toContainText('용두')
  await expect(seongsuItems.nth(4)).toContainText('신설동')

  // 신정지선 패널: 5개 역, 신도림→도림천→양천구청→신정네거리→까치산.
  const sinjeongPanelButton = page.getByRole('button', { name: /신정지선.*이 노선의 역 (보기|접기)/ })
  await expect(sinjeongPanelButton).toContainText('5개 역')
  await sinjeongPanelButton.click()
  const sinjeongItems = page.getByRole('list').nth(2).getByRole('listitem')
  await expect(sinjeongItems.nth(0)).toContainText('신도림')
  await expect(sinjeongItems.nth(1)).toContainText('도림천')
  await expect(sinjeongItems.nth(2)).toContainText('양천구청')
  await expect(sinjeongItems.nth(3)).toContainText('신정네거리')
  await expect(sinjeongItems.nth(4)).toContainText('까치산')
  // 까치산은 5호선과 실제 환승역이니 그 배지는 그대로 남아 있어야 한다.
  await expect(sinjeongItems.nth(4).getByRole('img', { name: '5호선' })).toBeVisible()

  // 접기 버튼을 다시 누르면 본선 목록이 사라진다.
  await mainPanelButton.click()
  await expect(page.getByRole('list')).toHaveCount(2)
})

test('KTX 범위: 서울역 검색 시 행신착발 6개 노선 배지가 한 행에 모인다', async ({ page }) => {
  await page.getByRole('radio', { name: 'KTX' }).click()
  await expect(page.getByRole('button', { name: 'KTX-경부-행신착발', exact: true })).toBeVisible()

  await page.getByRole('combobox').fill('서울')
  const listbox = page.getByRole('listbox')
  const seoulOption = listbox.getByRole('option').first()
  await expect(seoulOption).toContainText('서울')
  // KTX 노선 배지는 전부 아이콘 안에 "KTX"만 보이고(참고 사이트와 동일한 표기,
  // 2026-09-16 2차 확인으로 옛 SRT 배지도 "KTX"로 통일됨), 노선별 전체 이름은
  // 접근성 라벨로 구분한다.
  for (const label of ['KTX-경부-행신착발', 'KTX-호남-행신착발', 'KTX-전라-행신착발', 'KTX-강릉', 'KTX-중앙', 'KTX-경전-행신착발']) {
    await expect(seoulOption.getByRole('img', { name: label, exact: true })).toBeVisible()
  }
})

test('KTX-경부-행신착발 역 목록은 원본 순번 그대로(행신→서울→영등포→광명→수원) 나온다', async ({ page }) => {
  await page.getByRole('radio', { name: 'KTX' }).click()
  await page.getByRole('button', { name: 'KTX-경부-행신착발', exact: true }).click()
  await page.getByRole('button', { name: /이 노선의 역 보기/ }).click()

  const items = page.getByRole('list').getByRole('listitem')
  await expect(items.nth(0)).toContainText('행신')
  await expect(items.nth(1)).toContainText('서울')
  await expect(items.nth(2)).toContainText('영등포')
  await expect(items.nth(3)).toContainText('광명')
  await expect(items.nth(4)).toContainText('수원')
})

test('KTX 범위: 수서역 검색 시 수서착발 5개 노선 배지가 한 행에 모인다(2026-09-16 2차: SRT는 별도 범위가 아니라 KTX 안의 착발 구분이다)', async ({
  page,
}) => {
  await page.getByRole('radio', { name: 'KTX' }).click()
  await expect(page.getByRole('button', { name: 'KTX-경부-수서착발', exact: true })).toBeVisible()

  await page.getByRole('combobox').fill('수서')
  const listbox = page.getByRole('listbox')
  const suseoOption = listbox.getByRole('option').first()
  await expect(suseoOption).toContainText('수서')
  for (const label of ['KTX-경부-수서착발', 'KTX-호남-수서착발', 'KTX-전라-수서착발', 'KTX-경부-동해-수서착발', 'KTX-경전-수서착발']) {
    await expect(suseoOption.getByRole('img', { name: label })).toBeVisible()
  }
})

test('KTX-경부-수서착발 역 목록은 수서에서 시작한다(수서→동탄→평택지제→...)', async ({ page }) => {
  await page.getByRole('radio', { name: 'KTX' }).click()
  await page.getByRole('button', { name: 'KTX-경부-수서착발', exact: true }).click()
  await page.getByRole('button', { name: /이 노선의 역 보기/ }).click()

  const items = page.getByRole('list').getByRole('listitem')
  await expect(items.nth(0)).toContainText('수서')
  await expect(items.nth(1)).toContainText('동탄')
  await expect(items.nth(2)).toContainText('평택지제')
})

test('"이 노선의 역 보기"는 현재 범위 밖 노선과의 환승도 보여준다 (KTX 범위에서 지하철·수서착발 환승 배지)', async ({
  page,
}) => {
  await page.getByRole('radio', { name: 'KTX' }).click()
  // 2026-09-16 명칭 변경: "동해선 전구간"(부전~강릉) 노선이 "KTX-동해"가 됐다.
  await page.getByRole('button', { name: 'KTX-동해', exact: true }).click()
  await page.getByRole('button', { name: /이 노선의 역 보기/ }).click()

  const items = page.getByRole('list').getByRole('listitem')

  // 부전은 KTX 범위 안(KTX-중앙)뿐 아니라 부산 동해선(지하철, 다른 범위)·부산
  // 1호선(2026-09-16 사용자 확인으로 환승 가능 정정)·무궁화호 동해선(확장 25
  // 직후 환승역 정리, 2026-09-15)과도 환승된다. "동해선"은 "무궁화-동해선"의
  // 부분 문자열이라 exact 매칭으로 구분한다.
  const bujeon = items.filter({ hasText: '부전' })
  await expect(bujeon.getByRole('img', { name: '동해선', exact: true })).toBeVisible()
  await expect(bujeon.getByRole('img', { name: '무궁화-동해선', exact: true })).toBeVisible()
  await expect(bujeon.getByRole('img', { name: '부산 1호선' })).toBeVisible()
  await expect(bujeon.getByRole('img', { name: 'KTX-중앙' })).toBeVisible()

  // 경주는 KTX-경부/KTX-중앙뿐 아니라 수서착발(같은 KTX 범위 안의 다른 계통)과도 환승된다.
  const gyeongju = items.filter({ hasText: '경주' })
  await expect(gyeongju.getByRole('img', { name: 'KTX-경부-수서착발' })).toBeVisible()
})

test('검색 자동완성도 현재 범위·노선 밖의 환승 노선 배지를 보여준다 (KTX-경부-수서착발 범위에서 오송 검색 시 행신착발 배지도 표시)', async ({
  page,
}) => {
  await page.getByRole('radio', { name: 'KTX' }).click()
  await page.getByRole('button', { name: 'KTX-경부-수서착발', exact: true }).click()

  await page.getByRole('combobox', { name: /검색/ }).fill('오송')
  const listbox = page.getByRole('listbox')
  const option = listbox.getByRole('option')

  // 검색 대상은 KTX-경부-수서착발 범위에서 매칭됐지만, 오송은 실제로 다른
  // 계통과도 공용하는 역이라 지금 고른 노선 밖의 행신착발 배지도 함께 나와야 한다.
  await expect(option.getByRole('img', { name: 'KTX-경부-수서착발' })).toBeVisible()
  await expect(option.getByRole('img', { name: 'KTX-경부-행신착발', exact: true })).toBeVisible()
  await expect(option.getByRole('img', { name: 'KTX-호남-행신착발' })).toBeVisible()
})

test('1호선 "아산"과 KTX/SRT "천안아산"은 환승 정보는 공유하되 이름은 각자 그대로 검색·표시된다', async ({
  page,
}) => {
  await page.getByRole('radio', { name: '전체' }).click()

  // "아산"으로 검색하면 제목도 "아산"이고, KTX 환승 배지가 함께 나온다. 무궁화호
  // 장항선(확장 25)에도 이름이 같은 별개의 "아산"역이 있어(다른 pseudo-region이라
  // 자동 병합되지 않음) 배지("1호선")로 원하는 쪽을 정확히 짚는다.
  const combobox = page.getByRole('combobox', { name: /검색/ })
  await combobox.fill('아산')
  const asanOption = page
    .getByRole('listbox')
    .getByRole('option')
    .filter({ hasText: '아산' })
    .filter({ has: page.getByRole('img', { name: '1호선' }) })
  await expect(asanOption).toContainText('아산')
  await expect(asanOption.getByRole('img', { name: '1호선' })).toBeVisible()
  await expect(asanOption.getByRole('img', { name: 'KTX-경부-행신착발', exact: true })).toBeVisible()

  // "천안아산"으로 검색하면 제목이 "아산"으로 바뀌지 않고 "천안아산"으로 나오고,
  // 같은 역이라 1호선 환승 배지도 함께 나온다(역명은 동기화하지 않되 환승 정보는 공유).
  await combobox.fill('')
  await combobox.fill('천안아산')
  const cheonanAsanOption = page.getByRole('listbox').getByRole('option').first()
  await expect(cheonanAsanOption).toContainText('천안아산')
  await expect(cheonanAsanOption.getByRole('img', { name: '1호선' })).toBeVisible()
  await expect(cheonanAsanOption.getByRole('img', { name: 'KTX-경부-행신착발', exact: true })).toBeVisible()
})

test('총신대입구(이수)는 검색 대표 이름으로 고정되지만, 4호선·7호선 각자의 역 목록에서는 노선별 표기가 따로 나온다', async ({
  page,
}) => {
  await page.getByRole('radio', { name: '전체' }).click()
  const combobox = page.getByRole('combobox', { name: /검색/ })

  // "이수"로 검색해도 대표 이름 "총신대입구(이수)"로 나온다(역명 동기화가 아니라
  // 검색 대표를 고정하기로 한 사용자 확인).
  await combobox.fill('이수')
  await expect(page.getByRole('listbox').getByText('총신대입구(이수)')).toBeVisible()

  // 4호선 목록: "총신대입구(이수)"
  await combobox.fill('')
  await page.getByRole('button', { name: '4호선', exact: true }).click()
  await page.getByRole('button', { name: /4호선.*이 노선의 역 (보기|접기)/ }).click()
  await expect(page.getByRole('list').first()).toContainText('총신대입구(이수)')

  // 7호선 목록: "이수(총신대입구)" — 노선별 원래 표기 그대로.
  await page.getByRole('button', { name: '4호선', exact: true }).click() // 4호선 선택 해제
  await page.getByRole('button', { name: '7호선', exact: true }).click()
  await page.getByRole('button', { name: /7호선.*이 노선의 역 (보기|접기)/ }).click()
  await expect(page.getByRole('list').first()).toContainText('이수(총신대입구)')
})

test('부역명을 화면에 남기기로 한 역은 그 부역명만으로도 검색된다 (예: "구미"→김천(구미), "통도사"→울산(통도사))', async ({
  page,
}) => {
  await page.getByRole('radio', { name: '전체' }).click()
  const combobox = page.getByRole('combobox', { name: /검색/ })

  await combobox.fill('구미')
  await expect(page.getByRole('listbox').getByText('김천(구미)')).toBeVisible()

  await combobox.fill('')
  await combobox.fill('통도사')
  await expect(page.getByRole('listbox').getByText('울산(통도사)')).toBeVisible()
})

test('경춘선을 고르면 지선(망우선) 패널이 아래에 함께 나온다 — 망우선은 "노선 선택"에는 없다', async ({ page }) => {
  await page.getByRole('button', { name: '경춘선', exact: true }).click()

  // "노선 선택" 목록엔 망우선이 없다.
  await expect(page.getByRole('button', { name: '망우선', exact: true })).not.toBeVisible()

  // 경춘선 본선 패널: 24개 역, 청량리부터 시작(광운대는 빠짐).
  const mainPanelButton = page.getByRole('button', { name: /경춘선.*이 노선의 역 (보기|접기)/ })
  await expect(mainPanelButton).toContainText('24개 역')
  await mainPanelButton.click()
  const mainItems = page.getByRole('list').first().getByRole('listitem')
  await expect(mainItems.first()).toContainText('청량리')
  await expect(page.getByRole('list').first()).not.toContainText('광운대')

  // 경춘선 본선의 상봉 행에는 망우선 환승 배지(원형)가 안 붙고, 대신 지선
  // 분기 표시(사각 태그)가 붙는다(사용자 확인: "환승 알을 표기할 필요 없어").
  const sangbongInMain = mainItems.filter({ hasText: '상봉' })
  await expect(sangbongInMain.getByRole('img', { name: '망우선' })).toHaveCount(0)
  await expect(sangbongInMain.getByText('망우선')).toBeVisible()

  // 망우선 지선 패널: 2개 역, 광운대→상봉.
  const branchPanelButton = page.getByRole('button', { name: /망우선.*이 노선의 역 (보기|접기)/ })
  await expect(branchPanelButton).toContainText('2개 역')
  await branchPanelButton.click()
  const branchItems = page.getByRole('list').nth(1).getByRole('listitem')
  await expect(branchItems.nth(0)).toContainText('광운대')
  await expect(branchItems.nth(1)).toContainText('상봉')

  // 망우선 자기 목록의 상봉 행에는 본선(경춘선) 배지가 없다 — 지선이 본선과
  // 만나는 건 당연해서 굳이 표시하지 않는다(사용자 확인). 7호선 등 다른
  // 환승은 그대로 보인다.
  const sangbongInBranch = branchItems.nth(1)
  await expect(sangbongInBranch.getByRole('img', { name: '경춘선' })).toHaveCount(0)
  await expect(sangbongInBranch.getByRole('img', { name: '7호선' })).toBeVisible()
})

test('경의중앙선을 고르면 지선(경의1선) 패널이 아래에 함께 나온다 — 경의1선은 "노선 선택"에는 없다', async ({
  page,
}) => {
  await page.getByRole('button', { name: '경의중앙선', exact: true }).click()

  // "노선 선택" 목록엔 경의1선이 없다.
  await expect(page.getByRole('button', { name: '경의1선', exact: true })).not.toBeVisible()

  // 경의중앙선 본선 패널: 서울역·신촌은 빠지고 도라산은 그대로 있다.
  const mainPanelButton = page.getByRole('button', { name: /경의중앙선.*이 노선의 역 (보기|접기)/ })
  await mainPanelButton.click()
  const mainList = page.getByRole('list').first()
  await expect(mainList).not.toContainText('서울역')
  await expect(mainList).toContainText('도라산')

  // 경의1선 지선 패널: 3개 역, 가좌→신촌→서울역.
  const branchPanelButton = page.getByRole('button', { name: /경의1선.*이 노선의 역 (보기|접기)/ })
  await expect(branchPanelButton).toContainText('3개 역')
  await branchPanelButton.click()
  const branchItems = page.getByRole('list').nth(1).getByRole('listitem')
  await expect(branchItems.nth(0)).toContainText('가좌')
  await expect(branchItems.nth(1)).toContainText('신촌')
  await expect(branchItems.nth(2)).toContainText('서울역')

  // 경의1선 자기 목록의 가좌 행에는 본선(경의중앙선) 배지가 없다.
  const gajwaInBranch = branchItems.nth(0)
  await expect(gajwaInBranch.getByRole('img', { name: '경의중앙선' })).toHaveCount(0)

  // 버그 수정 확인: 서울역은 본선(경의중앙선) 레코드가 없고 지선(경의1선)
  // 레코드만 갖지만, "노선 선택"에서 경의중앙선(본선)을 고른 채로도 검색되어야
  // 한다(사용자 확인: "서울역과 같이 지선에있는 역들은 검색이 안되네").
  await page.getByPlaceholder('역명, 노선 번호, 초성으로 검색').fill('서울역')
  await expect(page.getByText('서울역', { exact: true })).toBeVisible()
})

test('5호선을 고르면 지선(마천지선) 패널이 아래에 함께 나온다 — 마천지선은 "노선 선택"에는 없다', async ({
  page,
}) => {
  await page.getByRole('button', { name: '5호선', exact: true }).click()

  // "노선 선택" 목록엔 마천지선이 없다.
  await expect(page.getByRole('button', { name: '마천지선', exact: true })).not.toBeVisible()

  // 5호선 본선 패널: 49개 역, 둔촌동은 빠짐.
  const mainPanelButton = page.getByRole('button', { name: /5호선.*이 노선의 역 (보기|접기)/ })
  await expect(mainPanelButton).toContainText('49개 역')
  await mainPanelButton.click()
  const mainList = page.getByRole('list').first()
  await expect(mainList).not.toContainText('둔촌동')

  // 마천지선 지선 패널: 8개 역, 강동→둔촌동→...→마천.
  const branchPanelButton = page.getByRole('button', { name: /마천지선.*이 노선의 역 (보기|접기)/ })
  await expect(branchPanelButton).toContainText('8개 역')
  await branchPanelButton.click()
  const branchItems = page.getByRole('list').nth(1).getByRole('listitem')
  await expect(branchItems.nth(0)).toContainText('강동')
  await expect(branchItems.nth(1)).toContainText('둔촌동')
  await expect(branchItems.nth(7)).toContainText('마천')

  // 마천지선 자기 목록의 강동 행에는 본선(5호선) 배지가 없다.
  const gangdongInBranch = branchItems.nth(0)
  await expect(gangdongInBranch.getByRole('img', { name: '5호선' })).toHaveCount(0)
})

test('1호선을 고르면 경부/장항선 패널과, 그 안에서 다시 갈라지는 경부고속선·병점기지선 패널까지 한꺼번에 나온다(지선의 지선, 확장 24)', async ({
  page,
}) => {
  await page.getByRole('button', { name: '1호선', exact: true }).click()

  // "노선 선택" 목록엔 셋 다 없다.
  await expect(page.getByRole('button', { name: '경부/장항선', exact: true })).not.toBeVisible()
  await expect(page.getByRole('button', { name: '경부고속선', exact: true })).not.toBeVisible()
  await expect(page.getByRole('button', { name: '병점기지선', exact: true })).not.toBeVisible()

  // 1호선 본선 패널: "경원/종로/경인선(본선)"으로 표시되고, 구로에서 끝난다.
  const mainPanelButton = page.getByRole('button', { name: /경원\/종로\/경인선\(본선\).*이 노선의 역 (보기|접기)/ })
  await expect(mainPanelButton).toBeVisible()
  await mainPanelButton.click()
  const mainList = page.getByRole('list').first()
  await expect(mainList).toContainText('구로')
  await expect(mainList).not.toContainText('금천구청')
  // 구로 행에는 "↳ 경부/장항선" 분기 표시가 붙는다.
  const guroRow = mainList.getByRole('listitem').filter({ hasText: '구로' })
  await expect(guroRow.getByText('경부/장항선', { exact: false })).toBeVisible()

  // 경부/장항선 패널: 구로에서 시작해 신창까지 이어지고, 그 안의 금천구청·병점
  // 행에는 경부고속선·병점기지선 분기 표시가 붙는다.
  const gyeongbuPanelButton = page.getByRole('button', { name: /경부\/장항선.*이 노선의 역 (보기|접기)/ })
  await expect(gyeongbuPanelButton).toBeVisible()
  await gyeongbuPanelButton.click()
  const gyeongbuList = page.getByRole('list').nth(1)
  await expect(gyeongbuList.getByRole('listitem').first()).toContainText('구로')
  await expect(gyeongbuList).toContainText('신창')
  const geumcheonRow = gyeongbuList.getByRole('listitem').filter({ hasText: '금천구청' })
  await expect(geumcheonRow.getByText('경부고속선', { exact: false })).toBeVisible()

  // 경부고속선 패널: 금천구청→광명 2개 역.
  const gyeongbugosokPanelButton = page.getByRole('button', { name: /경부고속선.*이 노선의 역 (보기|접기)/ })
  await expect(gyeongbugosokPanelButton).toContainText('2개 역')
  await gyeongbugosokPanelButton.click()
  const gyeongbugosokItems = page.getByRole('list').nth(2).getByRole('listitem')
  await expect(gyeongbugosokItems.nth(0)).toContainText('금천구청')
  await expect(gyeongbugosokItems.nth(1)).toContainText('광명')

  // 병점기지선 패널: 병점→서동탄 2개 역.
  const byeongjeomPanelButton = page.getByRole('button', { name: /병점기지선.*이 노선의 역 (보기|접기)/ })
  await expect(byeongjeomPanelButton).toContainText('2개 역')
  await byeongjeomPanelButton.click()
  const byeongjeomItems = page.getByRole('list').nth(3).getByRole('listitem')
  await expect(byeongjeomItems.nth(0)).toContainText('병점')
  await expect(byeongjeomItems.nth(1)).toContainText('서동탄')
})

test('무궁화호 "충북선"을 고르면 대표(동대구-영주) 패널과 자식(서울-영주) 패널이 함께 나오고, 겹치는 역엔 분기 표시가 안 붙는다(확장 25, 2026-09-16 raw 재수정으로 경부선→충북선 예시 교체)', async ({
  page,
}) => {
  await page.getByRole('radio', { name: '무궁화호' }).click()

  // "노선 선택"에는 group_name(대표)만 나온다 — 자식 계통("서울-영주")은
  // 독립적으로 고를 수 있는 노선이 아니다(사용자 확인: "노선 선택 토글에서는
  // 무궁화-장항선의 이전 KTX와 동일한 방식으로 진행해주면 돼").
  await expect(page.getByRole('button', { name: '서울-영주', exact: true })).not.toBeVisible()
  await page.getByRole('button', { name: '무궁화-충북선', exact: true }).click()

  // 대표 패널: 그룹명 없이 "동대구-영주"로만 표시된다(station_list_label,
  // 사용자 확인: "지선 처리가 되어있는 무궁화호 노선일 경우, 토글박스의 아이콘
  // 명은 경유하는 역만 작성", "괄호는 빼줘").
  const carrierPanelButton = page.getByRole('button', { name: /^동대구-영주.*이 노선의 역 (보기|접기)/ })
  await expect(carrierPanelButton).toBeVisible()
  await carrierPanelButton.click()
  const carrierList = page.getByRole('list').first()
  await expect(carrierList).toContainText('오송')
  // 대표와 자식이 겹치는 오송 행에는 "↳ 갈림" 분기 표시가 붙지 않는다(운행계통
  // 변형이지 물리적 분기가 아니라서 — 사용자 확인: "운행방식에 대한 환승 알은
  // 표기하지 않아").
  const osongRow = carrierList.getByRole('listitem').filter({ hasText: '오송' })
  await expect(osongRow.getByText(/^↳/)).toHaveCount(0)

  // 자식 패널: "서울-영주"도 그룹명 없이 같은 화면에 함께 나온다.
  const childPanelButton = page.getByRole('button', { name: /^서울-영주.*이 노선의 역 (보기|접기)/ })
  await expect(childPanelButton).toBeVisible()
  await childPanelButton.click()
  const childList = page.getByRole('list').nth(1)
  await expect(childList).toContainText('서울')
})
