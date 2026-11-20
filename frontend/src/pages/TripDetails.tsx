import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchGeocode, analyzeRoutes } from '../api/client'
import type { PlaceResult } from '../api/types'
import { TruckLoader } from '../components/TruckLoader'
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
  ArrowRight
} from 'lucide-react'

const DEFAULT_ORIGIN = 'Chicago, IL'
const DEFAULT_DESTINATION = 'Denver, CO'
const DEFAULT_WEIGHT = 38000
const DEFAULT_INTERVAL = 25
const DEFAULT_TIMEZONE: USTimeZone = 'America/Chicago' // Central Time (CT)

export const TripDetails: React.FC = () => {
  const navigate = useNavigate()

  // Form inputs with prefilled defaults matching Stitch Spec
  const [originQuery, setOriginQuery] = useState(DEFAULT_ORIGIN)
  const [destinationQuery, setDestinationQuery] = useState(DEFAULT_DESTINATION)
  const [selectedTimeZone, setSelectedTimeZone] = useState<USTimeZone>(DEFAULT_TIMEZONE)

  const [departureTime, setDepartureTime] = useState(() => {
    return getLocalInputStringForTimeZone(new Date(), DEFAULT_TIMEZONE)
  })

  const [loadWeight, setLoadWeight] = useState<number>(DEFAULT_WEIGHT)
  const [intervalMiles, setIntervalMiles] = useState<number>(DEFAULT_INTERVAL)

  // Autocomplete states & focus tracking
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
    if (!originQuery.trim()) errs.origin = 'Origin location is required.'
    if (!destinationQuery.trim()) errs.destination = 'Destination location is required.'
    if (!departureTime) errs.departureTime = 'Departure date and time is required.'
    if (!loadWeight || loadWeight <= 0) errs.loadWeight = 'Valid load weight (lb) is required.'
    if (loadWeight > 100000) errs.loadWeight = 'Load weight cannot exceed 100,000 lb.'
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
      navigate('/results')
    } catch (err: any) {
      setErrors({ form: err.message || 'Error calculating routes. Please try again.' })
    } finally {
      setIsLoading(false)
    }
  }

  const activeTzObj = US_TIMEZONES.find((z) => z.id === selectedTimeZone) || US_TIMEZONES[0]

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 relative">
      {/* Full-Screen Loading Overlay with Truck on Road Animation */}
      {isLoading && (
        <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <TruckLoader
            message="Calculating Weather-Aware Routes..."
            subMessage={`Evaluating corridors and crosswinds in ${activeTzObj.label}`}
          />
        </div>
      )}

      {/* Centered Form Card (Stitch Visual Specification) */}
      <div className="w-full max-w-lg bg-surface rounded-xl border border-border p-6 shadow-sm relative z-10">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="w-3 h-3 rounded-full bg-primary" />
            <h1 className="text-xl font-bold text-text-primary tracking-tight">Trip Details</h1>
          </div>
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
                className={`w-full h-11 pl-3 pr-10 border rounded text-sm text-text-primary focus:outline-none focus:border-primary ${
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
                className={`w-full h-11 pl-3 pr-10 border rounded text-sm text-text-primary focus:outline-none focus:border-primary ${
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
                  className="w-full h-11 px-3 border border-border rounded text-sm text-text-primary focus:outline-none focus:border-primary tabular-nums"
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
                  className="w-full bg-transparent text-sm font-semibold text-text-primary focus:outline-none cursor-pointer"
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

          {/* Cargo Load Weight (Clean Left Icon, No overlap with spinner) */}
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1">
              Cargo Load Weight (lb)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Weight size={16} className="text-text-muted" />
              </div>
              <input
                type="number"
                value={loadWeight || ''}
                onChange={(e) => setLoadWeight(Number(e.target.value))}
                placeholder="e.g. 38000"
                step="500"
                min="0"
                max="100000"
                className="w-full h-11 pl-9 pr-3 border border-border rounded text-sm text-text-primary focus:outline-none focus:border-primary tabular-nums"
              />
            </div>
            {errors.loadWeight && (
              <p className="text-xs text-risk-severe mt-1">{errors.loadWeight}</p>
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
  )
}
