import { describe, expect, it } from 'vitest'
import { haversineDistanceMeters, isWithinMeters } from '@/lib/geo'

describe('haversineDistanceMeters (좌표 거리 계산)', () => {
  it('같은 좌표는 거리 0', () => {
    expect(haversineDistanceMeters(37.5665, 126.978, 37.5665, 126.978)).toBeCloseTo(0, 3)
  })

  it('서울시청과 광화문 사이 거리는 대략 1~1.5km 사이다', () => {
    // 서울시청(37.5663, 126.9779) ↔ 광화문(37.5759, 126.9769)
    const distance = haversineDistanceMeters(37.5663, 126.9779, 37.5759, 126.9769)
    expect(distance).toBeGreaterThan(900)
    expect(distance).toBeLessThan(1500)
  })

  it('isWithinMeters는 500m 경계를 올바르게 판단한다', () => {
    // 위도로 약 450m 떨어진 두 점
    const lat1 = 37.5665
    const lat2 = 37.5665 + 450 / 111_000
    expect(isWithinMeters(lat1, 126.978, lat2, 126.978, 500)).toBe(true)
    expect(isWithinMeters(lat1, 126.978, lat2, 126.978, 400)).toBe(false)
  })
})
