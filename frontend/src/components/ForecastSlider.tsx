import React, { useEffect, useState } from 'react'
import { Play, Pause, RotateCcw, Clock } from 'lucide-react'

interface ForecastSliderProps {
  currentHourIndex: number
  totalHours: number
  displayTime: string
  onChangeHour: (hourIndex: number) => void
  departureTimeStr?: string
  arrivalTimeStr?: string
}

export const ForecastSlider: React.FC<ForecastSliderProps> = ({
  currentHourIndex,
  totalHours = 49,
  displayTime,
  onChangeHour,
  departureTimeStr,
  arrivalTimeStr,
}) => {
  const [isPlaying, setIsPlaying] = useState(false)

  useEffect(() => {
    let interval: any = null
    if (isPlaying) {
      interval = setInterval(() => {
        onChangeHour((currentHourIndex >= totalHours - 1 ? 0 : currentHourIndex + 1))
      }, 750)
    }
    return () => clearInterval(interval)
  }, [isPlaying, totalHours, currentHourIndex, onChangeHour])

  return (
    <div className="p-4 bg-surface rounded-lg border border-border flex flex-col gap-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={16} className="text-primary" />
          <span className="font-semibold text-sm text-text-primary">Forecast Horizon:</span>
          <span className="text-sm font-bold text-primary tabular-nums">{displayTime}</span>
          <span className="text-xs text-text-muted tabular-nums">(+{currentHourIndex}h)</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-primary text-white hover:bg-primary-dark transition"
          >
            {isPlaying ? <Pause size={13} /> : <Play size={13} />}
            <span>{isPlaying ? 'Pause' : 'Play'}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setIsPlaying(false)
              onChangeHour(0)
            }}
            className="p-1.5 rounded border border-border text-text-muted hover:bg-background transition"
            title="Reset to departure hour"
          >
            <RotateCcw size={14} />
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

      {(departureTimeStr || arrivalTimeStr) && (
        <div className="flex items-center justify-between text-xs text-text-muted pt-1 border-t border-border">
          {departureTimeStr && <span>Trip Dep: {departureTimeStr}</span>}
          {arrivalTimeStr && <span>Est. Arr: {arrivalTimeStr}</span>}
        </div>
      )}
    </div>
  )
}
