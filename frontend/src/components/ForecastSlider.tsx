import React, { useEffect, useState } from 'react'
import { Play, Pause, RotateCcw, Clock } from 'lucide-react'
import type { USTimeZone } from '../lib/timezone'
import { formatInTimeZone } from '../lib/timezone'

interface ForecastSliderProps {
  currentHourIndex: number
  totalHours: number
  displayTime: string
  timeIso?: string
  selectedTimeZone?: USTimeZone
  onChangeHour: (hourIndex: number) => void
  departureTimeStr?: string
  arrivalTimeStr?: string
}

export const ForecastSlider: React.FC<ForecastSliderProps> = ({
  currentHourIndex,
  totalHours = 49,
  displayTime,
  timeIso,
  selectedTimeZone = 'America/Chicago',
  onChangeHour,
  departureTimeStr,
  arrivalTimeStr,
}) => {
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    let interval: any = null
    if (isPlaying) {
      interval = setInterval(() => {
        onChangeHour(currentHourIndex >= totalHours - 1 ? 0 : currentHourIndex + 1)
      }, 750)
    }
    return () => clearInterval(interval)
  }, [isPlaying, totalHours, currentHourIndex, onChangeHour])

  // Formatted horizon string using exact synchronized US timezone
  const formattedHorizon = timeIso
    ? formatInTimeZone(timeIso, selectedTimeZone, { showDate: true })
    : displayTime

  const formattedDep = departureTimeStr
    ? formatInTimeZone(departureTimeStr, selectedTimeZone)
    : undefined

  const formattedArr = arrivalTimeStr
    ? formatInTimeZone(arrivalTimeStr, selectedTimeZone)
    : undefined

  return (
    <div className="p-4 bg-surface rounded-lg border border-border flex flex-col gap-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <Clock size={15} className="text-primary flex-shrink-0" />
          <span className="font-semibold text-xs text-text-muted uppercase tracking-wider">
            Corridor Time:
          </span>
          <span className="text-xs font-bold text-primary tabular-nums">
            {formattedHorizon}
          </span>
          <span className="text-[11px] text-text-muted tabular-nums">
            (+{currentHourIndex}h)
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-primary text-white hover:bg-primary-dark transition shadow-2xs"
          >
            {isPlaying ? <Pause size={12} /> : <Play size={12} />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false)
              onChangeHour(0)
            }}
            className="p-1 rounded border border-border text-text-muted hover:bg-background transition"
            title="Reset to departure hour"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      <div className="relative flex flex-col gap-1">
        <input
          type="range"
          min={0}
          max={totalHours - 1}
          value={currentHourIndex}
          onChange={(e) => onChangeHour(Number(e.target.value))}
          className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
        />

        <div className="flex justify-between text-[11px] text-text-muted tabular-nums">
          <span>Departure (0h)</span>
          <span>+24h</span>
          <span>+48h</span>
        </div>
      </div>

      {(formattedDep || formattedArr) && (
        <div className="flex items-center justify-between text-[11px] text-text-muted pt-2 border-t border-border">
          {formattedDep && <span>Trip Dep: {formattedDep}</span>}
          {formattedArr && <span>Est. Arr: {formattedArr}</span>}
        </div>
      )}
    </div>
  )
}
