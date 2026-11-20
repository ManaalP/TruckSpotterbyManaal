import React from 'react'
import type { RiskLevel } from '../lib/risk'
import { RISK_COLORS, LEVEL_LOW, LEVEL_MODERATE, LEVEL_HIGH, LEVEL_SEVERE, LEVEL_NO_TRAVEL } from '../lib/risk'

interface RiskBarProps {
  milesByLevel: Record<RiskLevel, number>
  totalMiles: number
  height?: number
}

export const RiskBar: React.FC<RiskBarProps> = ({ milesByLevel, totalMiles, height = 8 }) => {
  const levels: RiskLevel[] = [LEVEL_LOW, LEVEL_MODERATE, LEVEL_HIGH, LEVEL_SEVERE, LEVEL_NO_TRAVEL]
  const safeTotal = totalMiles > 0 ? totalMiles : 1

  return (
    <div className="w-full flex flex-col gap-1.5">
      <div
        className="w-full rounded-full overflow-hidden flex bg-border"
        style={{ height: `${height}px` }}
        role="progressbar"
        aria-label="Route risk miles distribution"
      >
        {levels.map((lvl) => {
          const miles = milesByLevel[lvl] || 0
          const pct = Math.max(0, (miles / safeTotal) * 100)
          if (pct === 0) return null

          return (
            <div
              key={lvl}
              style={{
                width: `${pct}%`,
                backgroundColor: RISK_COLORS[lvl].hex,
              }}
              title={`${lvl}: ${miles.toFixed(1)} mi (${pct.toFixed(0)}%)`}
            />
          )
        })}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-muted tabular-nums">
        {levels.map((lvl) => {
          const miles = milesByLevel[lvl] || 0
          if (miles <= 0) return null
          return (
            <div key={lvl} className="flex items-center gap-1">
              <span
                className="w-2 h-2 rounded-full inline-block"
                style={{ backgroundColor: RISK_COLORS[lvl].hex }}
              />
              <span>{lvl}: {miles.toFixed(0)} mi</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
