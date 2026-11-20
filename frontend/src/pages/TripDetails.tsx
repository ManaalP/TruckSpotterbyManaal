import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchGeocode, analyzeRoutes } from '../api/client'
import type { PlaceResult } from '../api/types'
import { TruckLoader } from '../components/TruckLoader'
import { useTheme } from '../lib/theme'
import {
  US_TIMEZONES,
  type USTimeZone,
  getLocalInputStringForTimeZone,
  parseLocalInputToUTCISO,
} from '../lib/timezone'
import {
  Navigation,
  Weight,
  Sliders,
  AlertCircle,
  Globe,
  ArrowRight,
  Sun,
  Moon,
  ArrowUpDown,
} from 'lucide-react'

const DEFAULT_ORIGIN = 'Chicago, IL'
const DEFAULT_DESTINATION = 'Denver, CO'
const DEFAULT_WEIGHT = 38000
const DEFAULT_INTERVAL = 25
const DEFAULT_TIMEZONE: USTimeZone = 'America/Chicago' // Central Time (CT)

export const TripDetails: React.FC = () => {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()

  // Form inputs with prefilled defaults matching Stitch Spec
  const [originQuery, setOriginQuery] = useState(DEFAULT_ORIGIN)
  const [destinationQuery, setDestinationQuery] = useState(DEFAULT_DESTINATION)
  const [selectedTimeZone, setSelectedTimeZone] = useState<USTimeZone>(DEFAULT_TIMEZONE)

  const [departureTime, setDepartureTime] = useState(() => {
    return getLocalInputStringForTimeZone(new Date(), DEFAULT_TIMEZONE)
  })

  const [loadWeight, setLoadWeight] = useState<number>(DEFAULT_WEIGHT)
  const [intervalMiles, setIntervalMiles] = useState<number>(DEFAULT_INTERVAL)

  const handleSwapLocations = () => {
    setOriginQuery(destinationQuery)
    setDestinationQuery(originQuery)
  }
  const [originSuggestions, setOriginSuggestions] = useState<PlaceResult[]>([])
  const [destSuggestions, setDestSuggestions] = useState<PlaceResult[]>([])
  const [showOriginMenu, setShowOriginMenu] = useState(false)
  const [showDestMenu, setShowDestMenu] = useState(false)

  // Submission & Validation states
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)

  const originContainerRef = useRef<HTMLDivElement>(null)
  const destContainerRef = useRef<HTMLDivElement>(null)

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (originContainerRef.current && !originContainerRef.current.contains(e.target as Node)) {
        setShowOriginMenu(false)
      }
      if (destContainerRef.current && !destContainerRef.current.contains(e.target as Node)) {
        setShowDestMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced geocoding search for origin
  useEffect(() => {
    if (originQuery.trim().length < 2) {
      setOriginSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await searchGeocode(originQuery)
        setOriginSuggestions(res)
      } catch (err) {}
    }, 200)
    return () => clearTimeout(timer)
  }, [originQuery])

  // Debounced geocoding search for destination
  useEffect(() => {
    if (destinationQuery.trim().length < 2) {
      setDestSuggestions([])
      return
    }
    const timer = setTimeout(async () => {
      try {
        const res = await searchGeocode(destinationQuery)
        setDestSuggestions(res)
      } catch (err) {}
    }, 200)
    return () => clearTimeout(timer)
  }, [destinationQuery])

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!originQuery.trim()) {
      errs.origin = 'Please enter an origin city, state, or logistics hub.'
    }
    if (!destinationQuery.trim()) {
      errs.destination = 'Please enter a destination city, state, or logistics hub.'
    }
    if (originQuery.trim() && destinationQuery.trim() && originQuery.trim().toLowerCase() === destinationQuery.trim().toLowerCase()) {
      errs.destination = 'Origin and destination must be different locations.'
    }
    if (!departureTime) {
      errs.departureTime = 'Please select a scheduled departure date and time.'
    } else {
      const depDate = new Date(departureTime)
      if (isNaN(depDate.getTime())) {
        errs.departureTime = 'Please provide a valid departure date and time.'
      } else {
        const now = new Date()
        const daysDiff = (now.getTime() - depDate.getTime()) / (1000 * 3600 * 24)
        if (daysDiff > 14) {
          errs.departureTime = 'Historical weather verification is supported up to 14 days in the past.'
        }
      }
    }
    if (!loadWeight || isNaN(loadWeight) || loadWeight < 1000) {
      errs.loadWeight = 'Cargo load weight must be at least 1,000 lb (standard freight threshold).'
    } else if (loadWeight > 90000) {
      errs.loadWeight = 'Cargo load weight cannot exceed 90,000 lb (max highway permit limit).'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsLoading(true)
    try {
      const utcDeparture = parseLocalInputToUTCISO(departureTime, selectedTimeZone)
      const payload = {
        origin: originQuery,
        destination: destinationQuery,
        departure_time: utcDeparture,
        load_weight_lb: Number(loadWeight),
        interval_miles: intervalMiles,
      }

      const results = await analyzeRoutes(payload)
      sessionStorage.setItem('spotter_route_data', JSON.stringify(results))
      sessionStorage.setItem('spotter_timezone', selectedTimeZone)
      sessionStorage.setItem('spotter_departure_input', departureTime)
      navigate('/results')
    } catch (err: any) {
      setErrors({ form: err.message || 'Error calculating routes. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  const activeTzObj = US_TIMEZONES.find((z) => z.id === selectedTimeZone) || US_TIMEZONES[0]

  return (
    <div className="min-h-screen bg-background flex flex-col relative">
      {/* Top Application Header with Brand & Theme Toggle */}
      <header className="border-b border-border bg-surface px-6 py-3 flex items-center justify-between z-20 shadow-xs">
        <div className="flex items-center gap-2.5">
          <span className="w-3.5 h-3.5 rounded-full bg-primary" />
          <span className="text-sm font-bold text-text-primary tracking-tight">TruckSpotter AI</span>
        </div>
        <button
          type="button"
          onClick={toggleTheme}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-background text-text-primary hover:bg-surface transition-colors text-xs font-semibold"
          title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
        >
          {theme === 'dark' ? (
            <>
              <Sun size={14} className="text-amber-400" />
              <span>Light Mode</span>
            </>
          ) : (
            <>
              <Moon size={14} className="text-slate-600" />
              <span>Dark Mode</span>
            </>
          )}
        </button>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {/* Full-Screen Loading Overlay with Truck on Road Animation */}
        {isLoading && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <TruckLoader
              message="Calculating Weather-Aware Routes..."
              subMessage={`Evaluating corridors and crosswinds in ${activeTzObj.label}`}
            />
          </div>
        )}

        {/* Centered Form Card (Stitch Visual Specification) */}
        <div className="w-full max-w-lg bg-surface rounded-xl border border-border p-6 shadow-sm relative z-10">
          <div className="mb-6">
            <h1 className="text-xl font-bold text-text-primary tracking-tight mb-1">Trip Details</h1>
            <p className="text-xs text-text-muted leading-relaxed">
              Configure origin, destination, departure time, and cargo weight to calculate weather-safe truck routes.
            </p>
          </div>

        {errors.form && (
          <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-xs text-risk-severe flex items-center gap-2">
            <AlertCircle size={15} />
            <span>{errors.form}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Origin & Destination with Interchange Button */}
          <div className="relative flex flex-col gap-3">
            {/* Origin */}
            <div ref={originContainerRef} className="relative">
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Origin Location
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={originQuery}
                  onFocus={() => setShowOriginMenu(true)}
                  onChange={(e) => {
                    setOriginQuery(e.target.value)
                    setShowOriginMenu(true)
                  }}
                  placeholder="City or logistics hub (e.g. Chicago, IL)"
                  className={`w-full h-11 pl-3 pr-10 border rounded text-sm bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary ${
                    errors.origin ? 'border-risk-severe' : 'border-border'
                  }`}
                />
                <Navigation size={15} className="absolute right-3.5 top-3.5 text-text-muted pointer-events-none" />
              </div>
              {errors.origin && <p className="text-xs text-risk-severe mt-1">{errors.origin}</p>}

              {/* Suggestions dropdown */}
              {showOriginMenu && originSuggestions.length > 0 && (
                <ul className="absolute z-20 w-full mt-1 bg-surface border border-border rounded shadow-lg max-h-48 overflow-y-auto divide-y divide-border/50">
                  {originSuggestions.map((s, idx) => (
                    <li
                      key={idx}
                      onMouseDown={() => {
                        setOriginQuery(s.label)
                        setShowOriginMenu(false)
                      }}
                      className="p-2.5 text-xs text-text-primary hover:bg-background cursor-pointer flex items-center gap-2"
                    >
                      <Navigation size={12} className="text-primary flex-shrink-0" />
                      <span className="truncate">{s.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Interchange (Swap) Button */}
            <div className="absolute right-3 top-[54px] z-10">
              <button
                type="button"
                onClick={handleSwapLocations}
                className="w-8 h-8 rounded-full border border-border bg-surface text-text-primary shadow-sm hover:bg-background hover:border-primary flex items-center justify-center transition-all cursor-pointer group"
                title="Swap Origin and Destination"
              >
                <ArrowUpDown size={14} className="text-text-muted group-hover:text-primary transition-colors" />
              </button>
            </div>

            {/* Destination */}
            <div ref={destContainerRef} className="relative">
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Destination Location
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={destinationQuery}
                  onFocus={() => setShowDestMenu(true)}
                  onChange={(e) => {
                    setDestinationQuery(e.target.value)
                    setShowDestMenu(true)
                  }}
                  placeholder="City or logistics hub (e.g. Denver, CO)"
                  className={`w-full h-11 pl-3 pr-10 border rounded text-sm bg-surface text-text-primary placeholder:text-text-muted focus:outline-none focus:border-primary ${
                    errors.destination ? 'border-risk-severe' : 'border-border'
                  }`}
                />
                <Navigation size={15} className="absolute right-3.5 top-3.5 text-text-muted pointer-events-none" />
              </div>
              {errors.destination && (
                <p className="text-xs text-risk-severe mt-1">{errors.destination}</p>
              )}

              {/* Suggestions dropdown */}
              {showDestMenu && destSuggestions.length > 0 && (
                <ul className="absolute z-20 w-full mt-1 bg-surface border border-border rounded shadow-lg max-h-48 overflow-y-auto divide-y divide-border/50">
                  {destSuggestions.map((s, idx) => (
                    <li
                      key={idx}
                      onMouseDown={() => {
                        setDestinationQuery(s.label)
                        setShowDestMenu(false)
                      }}
                      className="p-2.5 text-xs text-text-primary hover:bg-background cursor-pointer flex items-center gap-2"
                    >
                      <Navigation size={12} className="text-primary flex-shrink-0" />
                      <span className="truncate">{s.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Departure Date/Time & USA Timezone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                Departure Time
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className="w-full h-11 px-3 border border-border rounded text-sm bg-surface text-text-primary focus:outline-none focus:border-primary tabular-nums"
                />
              </div>
              {errors.departureTime && (
                <p className="text-xs text-risk-severe mt-1">{errors.departureTime}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">
                USA Timezone
              </label>
              <div className="relative flex items-center border border-border rounded h-11 px-3 bg-surface focus-within:border-primary">
                <Globe size={15} className="text-primary mr-2 flex-shrink-0" />
                <select
                  value={selectedTimeZone}
                  onChange={(e) => setSelectedTimeZone(e.target.value as USTimeZone)}
                  className="w-full bg-surface text-sm font-semibold text-text-primary focus:outline-none cursor-pointer"
                >
                  {US_TIMEZONES.map((tz) => (
                    <option key={tz.id} value={tz.id}>
                      {tz.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Cargo Load Weight with Direct Numerical Input + Dynamic Slider */}
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Cargo Load Weight (lb)
            </label>
            <div className="relative mb-2">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Weight size={15} className="text-text-muted" />
              </div>
              <input
                type="number"
                value={loadWeight || ''}
                onChange={(e) => setLoadWeight(Number(e.target.value))}
                placeholder="e.g. 38000"
                step="500"
                min="1000"
                max="90000"
                className="w-full h-11 pl-9 pr-12 border border-border rounded text-sm bg-surface text-text-primary focus:outline-none focus:border-primary tabular-nums font-semibold"
              />
              <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs font-bold text-text-muted pointer-events-none">
                LB
              </span>
            </div>

            {/* Slider directly linked to the input above */}
            <input
              type="range"
              min="5000"
              max="80000"
              step="500"
              value={loadWeight || 38000}
              onChange={(e) => setLoadWeight(Number(e.target.value))}
              className="w-full h-2 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
              title="Slide to adjust load weight"
            />

            {errors.loadWeight && (
              <p className="text-xs text-risk-severe mt-1.5 flex items-center gap-1">
                <AlertCircle size={12} />
                <span>{errors.loadWeight}</span>
              </p>
            )}
          </div>

          {/* Weather Sampling Interval Selector (Advanced Segmented Control) */}
          <div className="pt-2 border-t border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-primary flex items-center gap-1.5">
                <Sliders size={13} className="text-text-muted" />
                Weather Sampling Interval
              </span>
              <span className="text-xs text-text-muted">Every {intervalMiles} miles</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[10, 25, 50].map((intv) => (
                <button
                  key={intv}
                  type="button"
                  onClick={() => setIntervalMiles(intv)}
                  className={`h-9 rounded text-xs font-semibold transition ${
                    intervalMiles === intv
                      ? 'bg-primary text-white shadow-xs'
                      : 'border border-border text-text-primary hover:bg-background'
                  }`}
                >
                  {intv} miles
                </button>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full h-12 mt-1 rounded bg-primary text-white font-semibold text-sm hover:bg-primary-dark transition flex items-center justify-center gap-2 shadow-sm cursor-pointer"
          >
            <span>Analyze Safe Routes</span>
            <ArrowRight size={16} />
          </button>
        </form>
      </div>
    </div>
  </div>
  )
}
