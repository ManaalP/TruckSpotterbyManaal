import React from 'react'
import type { RouteOption } from '../api/types'
import { RiskBadge } from './RiskBadge'
import { RiskBar } from './RiskBar'
import { Award, Clock } from 'lucide-react'
import type { USTimeZone } from '../lib/timezone'
import { formatInTimeZone } from '../lib/timezone'

interface RouteCardProps {
  route: RouteOption
  isSelected: boolean
  isRecommended: boolean
  onSelect: () => void
  selectedTimeZone?: USTimeZone
}

function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.round((seconds % 3600) / 60)
  return `${hrs}h ${mins}m`
}

export const RouteCard: React.FC<RouteCardProps> = ({
  route,
  isSelected,
  isRecommended,
  onSelect,
  selectedTimeZone = 'America/Chicago',
}) => {
  const { summary } = route

  const formattedETA = formatInTimeZone(summary.arrival_time, selectedTimeZone)

  return (
    <div
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect()
        }
      }}
      className={`relative p-4 rounded-lg bg-surface border cursor-pointer transition-all ${
        isSelected
          ? 'border-2 border-primary shadow-sm'
          : 'border-border hover:border-text-muted'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-text-primary text-sm">{route.name}</span>
          {isRecommended && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-primary text-white">
              <Award size={12} />
              Recommended
            </span>
          )}
        </div>
        <RiskBadge level={summary.worst_level} size="sm" />
      </div>

      <div className="flex items-baseline gap-4 mb-3 tabular-nums">
        <div>
          <span className="text-xl font-bold text-text-primary">
            {formatDuration(summary.duration_seconds)}
          </span>
          <span className="text-xs text-text-muted ml-1.5">
            ({summary.distance_miles.toFixed(0)} mi)
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-text-muted ml-auto font-medium">
          <Clock size={13} />
          <span>ETA: {formattedETA}</span>
        </div>
      </div>

      <RiskBar
        milesByLevel={summary.miles_by_level}
        totalMiles={summary.distance_miles}
      />

      {summary.worst_checkpoint && summary.worst_level !== 'Low' && (
        <div className="mt-3 pt-2.5 border-t border-border text-xs text-text-muted">
          <span className="font-semibold text-text-primary">Hazard spot: </span>
          <span>{summary.worst_checkpoint.label} — {summary.worst_checkpoint.reason}</span>
        </div>
      )}
    </div>
  )
}
