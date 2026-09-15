/**
 * 중복역·환승역 자동 병합 판정 (규칙 7.2 / 7.3). 순수 함수.
 *
 * 정규화 역명이 같다는 이유만으로 즉시 병합하지 않는다. 아래 네 조건을
 * 모두 만족해야 자동 병합하고, 그 외에는 수동 검수 대상으로 남긴다.
 */

import { haversineDistanceMeters } from '../geo'

export interface MergeCandidate {
  normalizedName: string
  regionCode: string
  latitude?: number | null
  longitude?: number | null
  /** 공식 환승 관계가 확인되었는지 (양쪽 모두 확인되어야 인정). */
  officialTransferConfirmed?: boolean
  /** "서로 다른 역이라는 반대 증거"가 있으면 true. */
  hasConflictingEvidence?: boolean
}

export type MergeBasis = 'COORDINATE' | 'OFFICIAL_TRANSFER'

export interface MergeDecision {
  shouldAutoMerge: boolean
  basis: MergeBasis | null
  reason: string
  distanceMeters?: number
}

export const AUTO_MERGE_DISTANCE_METERS = 500

/** 같은 지역이거나 인접 행정구역인지 판단하는 기본 구현. 같은 region_code만 인정한다. */
export function isSameOrAdjacentRegion(regionA: string, regionB: string): boolean {
  return regionA === regionB
}

export function decideMerge(
  a: MergeCandidate,
  b: MergeCandidate,
  isAdjacent: (regionA: string, regionB: string) => boolean = isSameOrAdjacentRegion,
): MergeDecision {
  if (a.normalizedName !== b.normalizedName) {
    return { shouldAutoMerge: false, basis: null, reason: '정규화 역명이 다름' }
  }
  if (a.hasConflictingEvidence || b.hasConflictingEvidence) {
    return { shouldAutoMerge: false, basis: null, reason: '서로 다른 역이라는 반대 증거가 있음' }
  }
  if (!isAdjacent(a.regionCode, b.regionCode)) {
    return { shouldAutoMerge: false, basis: null, reason: '같은 지역 또는 인접 행정구역이 아님' }
  }
  if (a.officialTransferConfirmed && b.officialTransferConfirmed) {
    return { shouldAutoMerge: true, basis: 'OFFICIAL_TRANSFER', reason: '공식 환승 관계가 확인됨' }
  }
  if (a.latitude != null && a.longitude != null && b.latitude != null && b.longitude != null) {
    const distanceMeters = haversineDistanceMeters(a.latitude, a.longitude, b.latitude, b.longitude)
    if (distanceMeters <= AUTO_MERGE_DISTANCE_METERS) {
      return {
        shouldAutoMerge: true,
        basis: 'COORDINATE',
        reason: `좌표 거리 ${distanceMeters.toFixed(0)}m (500m 이내)`,
        distanceMeters,
      }
    }
    return {
      shouldAutoMerge: false,
      basis: null,
      reason: `좌표 거리 500m 초과 (${distanceMeters.toFixed(0)}m)`,
      distanceMeters,
    }
  }
  return {
    shouldAutoMerge: false,
    basis: null,
    reason: '좌표 정보가 한쪽 또는 양쪽에 없고 공식 환승 관계도 확인되지 않음 — 수동 검수 필요',
  }
}
