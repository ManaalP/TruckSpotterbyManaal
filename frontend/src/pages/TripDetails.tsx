import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { searchGeocode, analyzeRoutes } from '../api/client'
import type { PlaceResult } from '../api/types'
import { Navigation, Weight, Sliders, AlertCircle, Loader2 } from 'lucide-react'

export const TripDetails: React.FC = () => {
  const navigate = useNavigate()

  // Form inputs
  const [originQuery, setOriginQuery] = useState('Chicago, IL')
  const [destinationQuery, setDestinationQuery] = useState('Denver, CO')
  const [departureTime, setDepartureTime] = useState(() => {
    const d = new Date()
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset())
    return d.toISOString().slice(0, 16)
  })
  const [loadWeight, setLoadWeight] = useState<number>(38000)
  const [intervalMiles, setIntervalMiles] = useState<number>(25)

  // Autocomplete states & focus tracking
  const [originSuggestions, setOriginSuggestions] = useState<PlaceResult[]>([])
  const [destSuggestions, setDestSuggestions] = useState<PlaceResult[]>([])
  const [showOriginMenu, setShowOriginMenu] = useState(false)
  const [showDestMenu, setShowDestMenu] = useState(false)

  // Submission & Validation states
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')

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
    }, 250)
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
    }, 250)
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
    setLoadingStep('Finding optimal routes...')

    try {
      setTimeout(() => setLoadingStep('Sampling weather along corridor...'), 800)
      setTimeout(() => setLoadingStep('Applying truck load risk rules...'), 1600)

      const payload = {
        origin: originQuery,
        destination: destinationQuery,
        departure_time: new Date(departureTime).toISOString(),
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
      setLoadingStep('')
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg bg-surface rounded-lg border border-border p-6 shadow-sm">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full bg-primary" />
            <h1 className="text-xl font-bold text-text-primary">Trip Details</h1>
          </div>
          <p className="text-xs text-text-muted">
            Enter origin, destination, load weight, and departure time for weather-risk analysis.
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
                placeholder="Type city or freight hub (e.g. Chicago, IL)"
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
                placeholder="Type city or freight hub (e.g. Denver, CO)"
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

          {/* Grid row: Departure & Weight */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            {/* Cargo Load Weight with Clean Left-Aligned Icon to avoid spinner overlapping */}
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
          </div>

          {/* Sampling Interval Selector */}
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
                      ? 'bg-primary text-white'
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
            className="w-full h-12 mt-2 rounded bg-primary text-white font-semibold text-sm hover:bg-primary-dark transition flex items-center justify-center gap-2 disabled:opacity-75"
          >
            {isLoading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{loadingStep || 'Analyzing Weather & Routes...'}</span>
              </>
            ) : (
              <span>Analyze Safe Routes</span>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
