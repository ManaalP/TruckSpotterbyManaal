// Risk constants matching backend risk.py exactly
export const LEVEL_LOW = 'Low' as const
export const LEVEL_MODERATE = 'Moderate' as const
export const LEVEL_HIGH = 'High' as const
export const LEVEL_SEVERE = 'Severe' as const
export const LEVEL_NO_TRAVEL = 'No Travel' as const

export type RiskLevel =
  | typeof LEVEL_LOW
  | typeof LEVEL_MODERATE
  | typeof LEVEL_HIGH
  | typeof LEVEL_SEVERE
  | typeof LEVEL_NO_TRAVEL

export const RISK_COLORS: Record<RiskLevel, { hex: string; bg: string; border: string }> = {
  [LEVEL_LOW]: { hex: '#2E8B57', bg: 'rgba(46, 139, 87, 0.1)', border: 'rgba(46, 139, 87, 0.25)' },
  [LEVEL_MODERATE]: { hex: '#E5B800', bg: 'rgba(229, 184, 0, 0.12)', border: 'rgba(229, 184, 0, 0.3)' },
  [LEVEL_HIGH]: { hex: '#E07A1F', bg: 'rgba(224, 122, 31, 0.12)', border: 'rgba(224, 122, 31, 0.3)' },
  [LEVEL_SEVERE]: { hex: '#C62828', bg: 'rgba(198, 40, 40, 0.12)', border: 'rgba(198, 40, 40, 0.3)' },
  [LEVEL_NO_TRAVEL]: { hex: '#4A0E1A', bg: 'rgba(74, 14, 26, 0.15)', border: 'rgba(74, 14, 26, 0.4)' },
}

export const RISK_SCORES: Record<RiskLevel, number> = {
  [LEVEL_LOW]: 0,
  [LEVEL_MODERATE]: 1,
  [LEVEL_HIGH]: 2,
  [LEVEL_SEVERE]: 3,
  [LEVEL_NO_TRAVEL]: 4,
}
