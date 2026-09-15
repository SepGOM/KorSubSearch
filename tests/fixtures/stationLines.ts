/** 검색 엔진 테스트용 StationLineRecord 픽스처 빌더. */

import { normalizeStationName } from '@/lib/normalize/text'
import { normalizeLineName } from '@/lib/normalize/line'
import type { LineRecord, StationLineRecord } from '@/lib/search/types'

let lineSeq = 0
let stationLineSeq = 0

export function makeLine(overrides: Partial<LineRecord> & { officialName: string }): LineRecord {
  lineSeq += 1
  return {
    lineId: overrides.lineId ?? `LN-TEST-${lineSeq}`,
    lineCode: overrides.lineCode ?? `TEST-${lineSeq}`,
    officialName: overrides.officialName,
    displayName: overrides.displayName ?? overrides.officialName,
    iconLabel: overrides.iconLabel ?? (overrides.displayName ?? overrides.officialName).slice(0, 3),
    trainServiceCode: overrides.trainServiceCode ?? null,
    normalizedName: normalizeLineName(overrides.officialName),
    lineNumber: overrides.lineNumber ?? null,
    operatorCode: overrides.operatorCode ?? 'TEST',
    regionCode: overrides.regionCode ?? 'SEOUL_METRO',
    colorHex: overrides.colorHex ?? '#000000',
    textColorHex: overrides.textColorHex ?? '#FFFFFF',
    parentLineId: overrides.parentLineId ?? null,
    stationListLabel: overrides.stationListLabel ?? null,
    suppressBranchTag: overrides.suppressBranchTag ?? false,
    isActive: overrides.isActive ?? true,
    sortOrder: overrides.sortOrder ?? lineSeq,
    aliases: overrides.aliases ?? [],
  }
}

export function makeStationLine(
  officialStationName: string,
  line: LineRecord,
  overrides: Partial<StationLineRecord> = {},
): StationLineRecord {
  stationLineSeq += 1
  const normalized = normalizeStationName(officialStationName)
  return {
    stationLineId: overrides.stationLineId ?? `SL-TEST-${stationLineSeq}`,
    stationId: overrides.stationId ?? `STN-TEST-${stationLineSeq}`,
    displayStationName: overrides.displayStationName ?? normalized.officialName,
    officialStationName: normalized.officialName,
    normalizedStationName: normalized.normalizedName,
    stationInitials: normalized.initials,
    subName: normalized.subName,
    sequence: overrides.sequence ?? null,
    regionCode: overrides.regionCode ?? 'SEOUL_METRO',
    stationIsActive: overrides.stationIsActive ?? true,
    isExpressStop: overrides.isExpressStop ?? false,
    isActive: overrides.isActive ?? true,
    aliases: overrides.aliases ?? [],
    line,
    sourcePriority: overrides.sourcePriority,
  }
}
