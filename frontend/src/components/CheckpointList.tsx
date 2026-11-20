import React from 'react'
import type { Checkpoint } from '../api/types'
import { RiskBadge } from './RiskBadge'
import { Wind, CloudRain, Snowflake } from 'lucide-react'
import type { USTimeZone } from '../lib/timezone'
import { formatInTimeZone } from '../lib/timezone'

interface CheckpointListProps {
  checkpoints: Checkpoint[]
  selectedCheckpointIndex: number | null
  onSelectCheckpoint: (index: number) => void
  selectedTimeZone?: USTimeZone
}

export const CheckpointList: React.FC<CheckpointListProps> = ({
  checkpoints,
  selectedCheckpointIndex,
  onSelectCheckpoint,
  selectedTimeZone = 'America/Chicago',
}) => {
  return (
    <div className="divide-y divide-border max-h-[420px] overflow-y-auto rounded border border-border bg-surface">
      {checkpoints.map((cp) => {
        const isSelected = selectedCheckpointIndex === cp.index
        const timeFormatted = formatInTimeZone(cp.eta, selectedTimeZone)

        return (
          <div
            key={cp.index}
            onClick={() => onSelectCheckpoint(cp.index)}
            className={`p-3 cursor-pointer transition-colors flex flex-col gap-1.5 ${
              isSelected ? 'bg-primary-light/40 border-l-4 border-l-primary' : 'hover:bg-background'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-border text-text-muted tabular-nums">
                  Mi {cp.mile}
                </span>
                <span className="font-medium text-sm text-text-primary">{cp.label}</span>
              </div>
              <RiskBadge level={cp.risk_level} size="sm" />
            </div>

            <div className="flex items-center justify-between text-xs text-text-muted tabular-nums">
              <span className="font-medium">ETA: {timeFormatted}</span>
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1" title="Wind speed">
                  <Wind size={12} className="text-text-muted" />
                  <span>{cp.wind_mph.toFixed(0)} mph</span>
                </span>
                <span className={`flex items-center gap-1 ${cp.rain_in_hr > 0 ? 'text-blue-500 font-semibold' : 'text-text-muted/60'}`} title="Rainfall rate">
                  <CloudRain size={12} />
                  <span>{cp.rain_in_hr.toFixed(2)} in/h</span>
                </span>
                <span className={`flex items-center gap-1 ${cp.snow_in_hr > 0 ? 'text-cyan-400 font-semibold' : 'text-text-muted/60'}`} title="Snowfall rate">
                  <Snowflake size={12} />
                  <span>{cp.snow_in_hr.toFixed(1)} in/h</span>
                </span>
              </div>
            </div>

            {cp.reason && (
              <p className="text-[11px] text-text-muted bg-border/40 px-2 py-1 rounded">
                {cp.reason}
              </p>
            )}
          </div>
        )
      })}
    </div>
  )
}
