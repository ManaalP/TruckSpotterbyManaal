import React, { useState, useEffect, useRef } from 'react'
import type { RouteAnalyzeResponse, HeatmapResponse } from '../api/types'
import { fetchHeatmap, analyzeRoutes, searchGeocode } from '../api/client'
import type { PlaceResult } from '../api/types'
import { RouteCard } from '../components/RouteCard'
import { CheckpointList } from '../components/CheckpointList'
import { MapView } from '../components/MapView'
import { RiskBadge } from '../components/RiskBadge'
import { ForecastSlider } from '../components/ForecastSlider'
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
  Calendar,
  Layers,
  X,
  Loader2,
  Wind,
  CloudRain,
  Snowflake,
  ShieldAlert,
  Globe,
  Sun,
  Moon,
  ArrowLeftRight,
} from 'lucide-react'

const DEFAULT_ORIGIN = 'Cheyenne, WY'
const DEFAULT_DESTINATION = 'Salt Lake City, UT'
const DEFAULT_WEIGHT = 45000
const DEFAULT_INTERVAL = 25
const DEFAULT_TIMEZONE: USTimeZone = 'America/Denver' // Mountain Time (MT)

export const RouteResults: React.FC = () => {
  const { theme, toggleTheme } = useTheme()
  // Selected US Timezone
  const [selectedTimeZone, setSelectedTimeZone] = useState<USTimeZone>(DEFAULT_TIMEZONE)

  // Flight-style inline trip editor states
  const [origin, setOrigin] = useState(DEFAULT_ORIGIN)
  const [destination, setDestination] = useState(DEFAULT_DESTINATION)
  
  // Datetime input string initialized in US Mountain Time
  const [departureInput, setDepartureInput] = useState(() => {
    return '2026-11-18T08:00'
  })

  const [loadWeight, setLoadWeight] = useState(DEFAULT_WEIGHT)
  const [intervalMiles, setIntervalMiles] = useState(DEFAULT_INTERVAL)

  // Autocomplete suggestions
  const [originSuggestions, setOriginSuggestions] = useState<PlaceResult[]>([])
  const [destSuggestions, setDestSuggestions] = useState<PlaceResult[]>([])
  const [showOriginMenu, setShowOriginMenu] = useState(false)
  const [showDestMenu, setShowDestMenu] = useState(false)
  const [isEditingBar, setIsEditingBar] = useState(false)

  // App core states
  const [data, setData] = useState<RouteAnalyzeResponse | null>(null)
  const [selectedRouteId, setSelectedRouteId] = useState<string>('route_1')
  const [selectedCheckpointIndex, setSelectedCheckpointIndex] = useState<number | null>(null)
  const [isLoading, setIsLoading] = useState(true) // Initialized to true for loader on first load

  // Corridor Heatmap Drawer
  const [isHeatmapOpen, setIsHeatmapOpen] = useState(true)
  const [heatmapData, setHeatmapData] = useState<HeatmapResponse | null>(null)
  const [currentHour, setCurrentHour] = useState<number>(0)
  const [heatmapMode, setHeatmapMode] = useState<'risk' | 'wind' | 'rain' | 'snow'>('risk')
  const [isHeatmapLoading, setIsHeatmapLoading] = useState(false)

  const originRef = useRef<HTMLDivElement>(null)
  const destRef = useRef<HTMLDivElement>(null)

  // Initial load
  useEffect(() => {
    const raw = sessionStorage.getItem('spotter_route_data')
    const savedTz = sessionStorage.getItem('spotter_timezone') as USTimeZone | null
    const savedDepInput = sessionStorage.getItem('spotter_departure_input')

    if (savedTz && US_TIMEZONES.some((z) => z.id === savedTz)) {
      setSelectedTimeZone(savedTz)
    }

    if (raw) {
      try {
        const parsed: RouteAnalyzeResponse = JSON.parse(raw)
        setData(parsed)
        setOrigin(parsed.origin.label)
        setDestination(parsed.destination.label)
        setLoadWeight(parsed.load_weight_lb)
        setIntervalMiles(parsed.interval_miles)

        // Set departure time in the header
        const activeTz = (savedTz && US_TIMEZONES.some((z) => z.id === savedTz)) ? savedTz : selectedTimeZone
        if (savedDepInput) {
          setDepartureInput(savedDepInput)
        } else if (parsed.departure_time) {
          setDepartureInput(getLocalInputStringForTimeZone(new Date(parsed.departure_time), activeTz))
        }

        if (parsed.recommendation?.route_id) {
          setSelectedRouteId(parsed.recommendation.route_id)
        }
        setIsLoading(false)
        loadCorridorHeatmap(parsed)
        return
      } catch (_) {}
    }

    const utcDeparture = parseLocalInputToUTCISO(departureInput, DEFAULT_TIMEZONE)
    executeRouteAnalysis({
      originQuery: DEFAULT_ORIGIN,
      destQuery: DEFAULT_DESTINATION,
      depTimeUTC: utcDeparture,
      weight: DEFAULT_WEIGHT,
      interval: DEFAULT_INTERVAL,
    })
  }, [])

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (originRef.current && !originRef.current.contains(e.target as Node)) {
        setShowOriginMenu(false)
      }
      if (destRef.current && !destRef.current.contains(e.target as Node)) {
        setShowDestMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Geocode searches
  useEffect(() => {
    if (origin.trim().length < 2) return
    const t = setTimeout(async () => {
      const res = await searchGeocode(origin)
      setOriginSuggestions(res)
    }, 200)
    return () => clearTimeout(t)
  }, [origin])

  useEffect(() => {
    if (destination.trim().length < 2) return
    const t = setTimeout(async () => {
      const res = await searchGeocode(destination)
      setDestSuggestions(res)
    }, 200)
    return () => clearTimeout(t)
  }, [destination])

  // Core execution
  const executeRouteAnalysis = async (params: {
    originQuery: string
    destQuery: string
    depTimeUTC: string
    weight: number
    interval: number
  }) => {
    setIsLoading(true)
    try {
      const res = await analyzeRoutes({
        origin: params.originQuery,
        destination: params.destQuery,
        departure_time: params.depTimeUTC,
        load_weight_lb: params.weight,
        interval_miles: params.interval,
      })
      setData(res)
      sessionStorage.setItem('spotter_route_data', JSON.stringify(res))
      if (res.recommendation?.route_id) {
        setSelectedRouteId(res.recommendation.route_id)
      }
      setIsEditingBar(false)
      loadCorridorHeatmap(res)
    } catch (e: any) {
      alert(e.message || 'Error calculating routes')
    } finally {
      setIsLoading(false)
    }
  }

  const loadCorridorHeatmap = async (currentData: RouteAnalyzeResponse) => {
    setIsHeatmapLoading(true)
    try {
      const routeGeoms = currentData.routes.map((r) => r.geometry.coordinates)
      const res = await fetchHeatmap({
        routes_coordinates: routeGeoms,
        load_weight_lb: currentData.load_weight_lb,
        start_time: currentData.departure_time,
      })
      setHeatmapData(res)
    } catch (_) {
    } finally {
      setIsHeatmapLoading(false)
    }
  }

  const toggleHeatmapPanel = () => {
    const nextState = !isHeatmapOpen
    setIsHeatmapOpen(nextState)
    if (nextState && data && (!heatmapData || heatmapData.frames.length === 0)) {
      loadCorridorHeatmap(data)
    }
  }

  const selectedRoute = data?.routes.find((r) => r.id === selectedRouteId) || data?.routes[0]
  const currentFrame = heatmapData?.frames[currentHour]
  const activeTzObj = US_TIMEZONES.find((z) => z.id === selectedTimeZone) || US_TIMEZONES[0]

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden relative">
      {/* Flight-Style Search Header */}
      <header className="border-b border-border bg-surface px-4 py-2.5 shadow-sm z-30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Left: Origin -> Destination -> Date -> Timezone -> Weight -> Interval */}
          <div className="flex flex-wrap items-center gap-2 flex-1">
            {/* Origin Input */}
            <div ref={originRef} className="relative min-w-[150px] flex-1 max-w-[220px]">
              <div className="flex items-center gap-1.5 h-9 px-2.5 rounded border border-border bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                <Navigation size={13} className="text-primary flex-shrink-0" />
                <input
                  type="text"
                  value={origin}
                  onFocus={() => {
                    setShowOriginMenu(true)
                    setIsEditingBar(true)
                  }}
                  onChange={(e) => {
                    setOrigin(e.target.value)
                    setShowOriginMenu(true)
                    setIsEditingBar(true)
                  }}
                  placeholder="Origin"
                  className="w-full bg-transparent text-xs font-semibold text-text-primary placeholder:text-text-muted focus:outline-none truncate"
                />
              </div>
              {showOriginMenu && originSuggestions.length > 0 && (
                <ul className="absolute left-0 top-10 w-64 bg-surface border border-border rounded shadow-lg max-h-52 overflow-y-auto z-40 divide-y divide-border/50">
                  {originSuggestions.map((s, idx) => (
                    <li
                      key={idx}
                      onMouseDown={() => {
                        setOrigin(s.label)
                        setShowOriginMenu(false)
                      }}
                      className="p-2 text-xs text-text-primary hover:bg-background cursor-pointer truncate"
                    >
                      {s.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Interchange (Swap) Button */}
            <button
              type="button"
              onClick={() => {
                const prevOrigin = origin
                setOrigin(destination)
                setDestination(prevOrigin)
                setIsEditingBar(true)
              }}
              className="w-7 h-7 rounded border border-border bg-surface text-text-muted hover:text-primary hover:border-primary flex items-center justify-center transition cursor-pointer flex-shrink-0"
              title="Swap Origin and Destination"
            >
              <ArrowLeftRight size={12} />
            </button>

            {/* Destination Input */}
            <div ref={destRef} className="relative min-w-[150px] flex-1 max-w-[220px]">
              <div className="flex items-center gap-1.5 h-9 px-2.5 rounded border border-border bg-surface focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
                <Navigation size={13} className="text-primary flex-shrink-0" />
                <input
                  type="text"
                  value={destination}
                  onFocus={() => {
                    setShowDestMenu(true)
                    setIsEditingBar(true)
                  }}
                  onChange={(e) => {
                    setDestination(e.target.value)
                    setShowDestMenu(true)
                    setIsEditingBar(true)
                  }}
                  placeholder="Destination"
                  className="w-full bg-transparent text-xs font-semibold text-text-primary placeholder:text-text-muted focus:outline-none truncate"
                />
              </div>
              {showDestMenu && destSuggestions.length > 0 && (
                <ul className="absolute left-0 top-10 w-64 bg-surface border border-border rounded shadow-lg max-h-52 overflow-y-auto z-40 divide-y divide-border/50">
                  {destSuggestions.map((s, idx) => (
                    <li
                      key={idx}
                      onMouseDown={() => {
                        setDestination(s.label)
                        setShowDestMenu(false)
                      }}
                      className="p-2 text-xs text-text-primary hover:bg-background cursor-pointer truncate"
                    >
                      {s.label}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Departure Datetime (In US Timezone) */}
            <div className="flex items-center gap-1 h-9 px-2 rounded border border-border bg-surface">
              <Calendar size={13} className="text-text-muted flex-shrink-0" />
              <input
                type="datetime-local"
                value={departureInput}
                onChange={(e) => {
                  setDepartureInput(e.target.value)
                  setIsEditingBar(true)
                }}
                className="bg-transparent text-xs font-semibold text-text-primary focus:outline-none tabular-nums"
                title={`Departure wall-clock time in ${activeTzObj.label}`}
              />
            </div>

            {/* Explicit US Timezone Selector (Matches Right Taskbar) */}
            <div className="flex items-center gap-1 h-9 px-2 rounded border border-border bg-surface">
              <Globe size={13} className="text-primary flex-shrink-0" />
              <select
                value={selectedTimeZone}
                onChange={(e) => {
                  const newTz = e.target.value as USTimeZone
                  setSelectedTimeZone(newTz)
                  setIsEditingBar(true)
                }}
                className="bg-transparent text-xs font-bold text-primary focus:outline-none cursor-pointer"
                title="Select USA Timezone applied across all ETAs, checkpoints, and forecast timeline"
              >
                {US_TIMEZONES.map((tz) => (
                  <option key={tz.id} value={tz.id}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Weight Input with Slider Popover or Quick Increment */}
            <div className="flex items-center gap-2 h-9 px-2.5 rounded border border-border bg-surface">
              <Weight size={13} className="text-text-muted flex-shrink-0" />
              <input
                type="range"
                min="5000"
                max="80000"
                step="1000"
                value={loadWeight || 38000}
                onChange={(e) => {
                  setLoadWeight(Number(e.target.value))
                  setIsEditingBar(true)
                }}
                className="w-16 h-1.5 bg-border rounded cursor-pointer accent-primary hidden sm:block"
                title="Slide to adjust weight"
              />
              <input
                type="number"
                value={loadWeight || ''}
                step="500"
                min="1000"
                max="90000"
                onChange={(e) => {
                  setLoadWeight(Number(e.target.value))
                  setIsEditingBar(true)
                }}
                className="w-16 bg-transparent text-xs font-semibold text-text-primary focus:outline-none tabular-nums text-right"
                title="Cargo weight in pounds"
              />
              <span className="text-[10px] text-text-muted font-bold">LB</span>
            </div>

            {/* Interval Selector */}
            <div className="flex items-center rounded border border-border h-9 overflow-hidden bg-surface">
              {[10, 25, 50].map((intv) => (
                <button
                  key={intv}
                  type="button"
                  onClick={() => {
                    setIntervalMiles(intv)
                    setIsEditingBar(true)
                  }}
                  className={`px-2 h-full text-[11px] font-semibold transition ${
                    intervalMiles === intv
                      ? 'bg-primary text-white'
                      : 'text-text-muted hover:text-text-primary'
                  }`}
                >
                  {intv}mi
                </button>
              ))}
            </div>

            {/* Re-calculate button */}
            <button
              onClick={() => {
                const utcDeparture = parseLocalInputToUTCISO(departureInput, selectedTimeZone)
                executeRouteAnalysis({
                  originQuery: origin,
                  destQuery: destination,
                  depTimeUTC: utcDeparture,
                  weight: Number(loadWeight),
                  interval: intervalMiles,
                })
              }}
              disabled={isLoading}
              className={`h-9 px-4 rounded text-xs font-bold transition flex items-center gap-1.5 ${
                isEditingBar
                  ? 'bg-primary text-white hover:bg-primary-dark shadow-sm'
                  : 'bg-primary/90 text-white hover:bg-primary'
              }`}
            >
              {isLoading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Updating...</span>
                </>
              ) : (
                <span>Update Routes</span>
              )}
            </button>
          </div>

          {/* Right: Theme Toggle & Corridor Heatmap Taskbar Button */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center justify-center w-9 h-9 rounded border border-border bg-surface text-text-primary hover:bg-background transition-colors"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? <Sun size={15} className="text-amber-400" /> : <Moon size={15} className="text-slate-600" />}
            </button>

            <button
              type="button"
              onClick={toggleHeatmapPanel}
              className={`flex items-center gap-1.5 text-xs font-bold px-3.5 h-9 rounded transition cursor-pointer select-none border ${
                isHeatmapOpen
                  ? 'bg-primary text-white border-primary shadow-xs'
                  : 'bg-surface text-text-primary border-border hover:bg-background'
              }`}
            >
              <Layers size={14} />
              <span>{isHeatmapOpen ? 'Heatmap Taskbar Open' : 'Open Heatmap'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main 3-Column Split View: All Panels Kept Open */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Full-Screen Loading Overlay with Truck on Road Animation */}
        {isLoading && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <TruckLoader
              message="Calculating Weather-Aware Routes..."
              subMessage={`Evaluating corridors and crosswinds in ${activeTzObj.label}`}
            />
          </div>
        )}

        {/* Left Side: Recommendations & Route Cards & Checkpoint List */}
        <div className="w-full lg:w-[440px] p-4 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-60px)] border-r border-border bg-surface flex-shrink-0 z-10">
          {data ? (
            <>
              {/* Recommendation Card */}
              <div className="p-3.5 rounded-lg bg-primary-light/40 border border-primary/25 flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-primary">
                    Recommended Route
                  </span>
                  {data.recommendation.all_routes_blocked && (
                    <RiskBadge level="No Travel" size="sm" />
                  )}
                </div>
                <p className="text-xs font-medium text-text-primary leading-relaxed">
                  {data.recommendation.reason}
                </p>
              </div>

              {/* 3 Route Cards */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                    Route Alternatives ({data.routes.length})
                  </span>
                  <span className="text-[11px] font-semibold text-primary">
                    Times in {activeTzObj.short}
                  </span>
                </div>
                {data.routes.map((r) => (
                  <RouteCard
                    key={r.id}
                    route={r}
                    isSelected={r.id === selectedRouteId}
                    isRecommended={r.id === data.recommendation.route_id}
                    selectedTimeZone={selectedTimeZone}
                    onSelect={() => {
                      setSelectedRouteId(r.id)
                      setSelectedCheckpointIndex(null)
                    }}
                  />
                ))}
              </div>

              {/* Checkpoints Timeline */}
              {selectedRoute && (
                <div className="flex flex-col gap-2 mt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                      Checkpoints ({selectedRoute.checkpoints.length})
                    </span>
                    <span className="text-[11px] text-text-muted">
                      Every {data.interval_miles} mi ({activeTzObj.short})
                    </span>
                  </div>
                  <CheckpointList
                    checkpoints={selectedRoute.checkpoints}
                    selectedCheckpointIndex={selectedCheckpointIndex}
                    selectedTimeZone={selectedTimeZone}
                    onSelectCheckpoint={(idx) => setSelectedCheckpointIndex(idx)}
                  />
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Center: Map Area */}
        <div className="flex-1 relative bg-background p-3 flex flex-col overflow-hidden min-h-[400px]">
          {data && (
            <MapView
              routes={data.routes}
              selectedRouteId={selectedRouteId}
              selectedCheckpointIndex={selectedCheckpointIndex}
              onSelectCheckpoint={(idx) => setSelectedCheckpointIndex(idx)}
              isHeatmapOpen={isHeatmapOpen}
              heatmapPoints={currentFrame?.points}
              heatmapMode={heatmapMode}
            />
          )}
        </div>

        {/* Right Side: Corridor Heatmap Taskbar Drawer (Open by default) */}
        {isHeatmapOpen && (
          <div className="w-full lg:w-[380px] border-l border-border bg-surface flex flex-col max-h-[calc(100vh-60px)] shadow-lg z-20 flex-shrink-0 transition-all">
            {/* Taskbar Header */}
            <div className="p-3 border-b border-border flex items-center justify-between bg-surface">
              <div className="flex items-center gap-2">
                <Layers size={15} className="text-primary" />
                <span className="font-bold text-xs text-text-primary">0–48h Corridor Forecast</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                  {activeTzObj.short}
                </span>
                <button
                  onClick={() => setIsHeatmapOpen(false)}
                  className="p-1 rounded text-text-muted hover:text-text-primary hover:bg-background"
                  title="Collapse sidebar"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Heatmap Mode Toggles (Risk / Wind / Rain / Snow) */}
            <div className="p-3 border-b border-border bg-background/50">
              <span className="text-[11px] font-bold text-text-muted uppercase tracking-wider block mb-2">
                Weather Metric Overlay
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { id: 'risk', label: 'Risk', icon: ShieldAlert },
                  { id: 'wind', label: 'Wind', icon: Wind },
                  { id: 'rain', label: 'Rain', icon: CloudRain },
                  { id: 'snow', label: 'Snow', icon: Snowflake },
                ].map((item) => {
                  const Icon = item.icon
                  const active = heatmapMode === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setHeatmapMode(item.id as any)}
                      className={`flex flex-col items-center justify-center py-2 px-1 rounded text-[11px] font-semibold transition border ${
                        active
                          ? 'bg-primary text-white border-primary shadow-xs'
                          : 'bg-surface text-text-muted border-border hover:bg-background'
                      }`}
                    >
                      <Icon size={13} className="mb-0.5" />
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Slider & Time Frame Controls */}
            <div className="p-4 flex-1 flex flex-col gap-4 overflow-y-auto">
              {isHeatmapLoading && !heatmapData ? (
                <div className="py-8">
                  <TruckLoader
                    message="Sampling Forecast Grid..."
                    subMessage={`Synchronizing hourly frames with ${activeTzObj.label}`}
                  />
                </div>
              ) : (
                <>
                  <ForecastSlider
                    currentHourIndex={currentHour}
                    totalHours={heatmapData?.total_hours || 49}
                    displayTime={`+${currentHour}h`}
                    timeIso={currentFrame?.time_iso}
                    selectedTimeZone={selectedTimeZone}
                    onChangeHour={(h) => setCurrentHour(h)}
                    departureTimeStr={data?.departure_time}
                    arrivalTimeStr={selectedRoute?.summary.arrival_time}
                  />

                  {/* Point Grid Summary for Active Hour */}
                  <div className="p-3 rounded-lg border border-border bg-background/50 flex flex-col gap-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-text-primary">
                        Corridor Max Hazards (+{currentHour}h)
                      </span>
                      <span className="text-[11px] font-bold text-primary">
                        {activeTzObj.short}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center pt-1 tabular-nums">
                      <div className="p-2 rounded bg-surface border border-border">
                        <span className="text-[10px] text-text-muted uppercase block">Peak Wind</span>
                        <span className="text-sm font-bold text-text-primary">
                          {Math.max(...(currentFrame?.points.map((p) => p.wind) || [0])).toFixed(0)} mph
                        </span>
                      </div>

                      <div className="p-2 rounded bg-surface border border-border">
                        <span className="text-[10px] text-text-muted uppercase block">Max Rain</span>
                        <span className="text-sm font-bold text-text-primary">
                          {Math.max(...(currentFrame?.points.map((p) => p.rain) || [0])).toFixed(2)} in/h
                        </span>
                      </div>

                      <div className="p-2 rounded bg-surface border border-border">
                        <span className="text-[10px] text-text-muted uppercase block">Max Snow</span>
                        <span className="text-sm font-bold text-text-primary">
                          {Math.max(...(currentFrame?.points.map((p) => p.snow) || [0])).toFixed(1)} in/h
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Micro instructions */}
                  <div className="text-[11px] text-text-muted leading-relaxed p-2.5 rounded bg-surface border border-border">
                    Times are synchronized to <strong>{activeTzObj.label}</strong>. Scrub or play to observe crosswind vectors and storms as the truck moves across the corridor.
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
