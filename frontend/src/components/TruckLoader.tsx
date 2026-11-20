import React from 'react'
import { Truck } from 'lucide-react'

interface TruckLoaderProps {
  message?: string
  subMessage?: string
}

export const TruckLoader: React.FC<TruckLoaderProps> = ({
  message = 'Calculating Weather-Aware Routes...',
  subMessage = 'Sampling atmospheric forecasts across highway corridors',
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 bg-surface rounded-xl border border-border shadow-2xl max-w-sm w-full mx-auto relative z-50">
      {/* Animated Road & Truck Stage */}
      <div className="relative w-64 h-16 overflow-hidden flex items-end justify-center mb-4">
        {/* Road Surface */}
        <div className="absolute bottom-1 w-full h-2.5 bg-slate-700 rounded-sm overflow-hidden flex items-center">
          {/* Moving Road Center Dashed Line */}
          <div className="w-[200%] h-0.5 border-b-2 border-dashed border-amber-300 animate-road-move" />
        </div>

        {/* Animated Moving Truck */}
        <div className="relative z-10 animate-truck-bob flex flex-col items-center mb-1">
          <Truck size={38} className="text-primary fill-primary/10 drop-shadow-xs" />
          {/* Wheel rotation / road dust effect */}
          <div className="flex justify-between w-7 px-0.5 -mt-1">
            <span className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
            <span className="w-1.5 h-1.5 bg-slate-900 rounded-full" />
          </div>
        </div>
      </div>

      {/* Primary Message */}
      <h3 className="text-sm font-bold text-text-primary text-center tracking-tight mb-1">
        {message}
      </h3>

      {/* Subtitle / Progress Notice */}
      <p className="text-xs text-text-muted text-center max-w-[240px] leading-relaxed">
        {subMessage}
      </p>

      {/* Indeterminate Smooth Progress Bar */}
      <div className="w-48 h-1 bg-border rounded-full overflow-hidden mt-3">
        <div className="h-full bg-primary rounded-full animate-progress-indeterminate" />
      </div>
    </div>
  )
}
