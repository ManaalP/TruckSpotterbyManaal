import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import * as maplibregl from 'maplibre-gl'
import type { RouteAnalyzeResponse, HeatmapResponse } from '../api/types'
import { fetchHeatmap } from '../api/client'
import { ForecastSlider } from '../components/ForecastSlider'
import { RISK_COLORS } from '../lib/risk'
import { ArrowLeft, Wind, CloudRain, Snowflake, ShieldAlert } from 'lucide-react'

type HeatmapMode = 'risk' | 'wind' | 'rain' | 'snow'

export const WeatherHeatmap: React.FC = () => {
  const navigate = useNavigate()
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const isLoadedRef = useRef(false)

  const [tripData, setTripData] = useState<RouteAnalyzeResponse | null>(null)
  const [heatmapData, setHeatmapData] = useState<HeatmapResponse | null>(null)
  const [currentHour, setCurrentHour] = useState<number>(0)
  const [mode, setMode] = useState<HeatmapMode>('risk')

  // Load trip data from session storage
  useEffect(() => {
    const raw = sessionStorage.getItem('spotter_route_data')
    if (!raw) {
      navigate('/')
      return
    }
    try {
      const parsed: RouteAnalyzeResponse = JSON.parse(raw)
      setTripData(parsed)

      // Fetch 49-frame corridor heatmap
      const routeGeoms = parsed.routes.map((r) => r.geometry.coordinates)
      fetchHeatmap({
        routes_coordinates: routeGeoms,
        load_weight_lb: parsed.load_weight_lb,
        start_time: parsed.departure_time,
      })
        .then((res) => {
          setHeatmapData(res)
        })
        .catch(() => {})
    } catch {
      navigate('/')
    }
  }, [navigate])

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: 'https://tiles.openfreemap.org/styles/liberty',
      center: [-98.5795, 39.8283],
      zoom: 4,
    })

    map.addControl(new maplibregl.NavigationControl(), 'top-right')

    map.on('load', () => {
      isLoadedRef.current = true
      updateHeatmapLayer()
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      isLoadedRef.current = false
    }
  }, [])

  // Fast 60fps layer update without network refetches
  const updateHeatmapLayer = () => {
    const map = mapRef.current
    if (!map || !isLoadedRef.current || !heatmapData) return

    const frame = heatmapData.frames[currentHour]
    if (!frame) return

    const features = frame.points.map((pt) => {
      let val = 0
      if (mode === 'risk') val = pt.score
      else if (mode === 'wind') val = pt.wind
      else if (mode === 'rain') val = pt.rain
      else if (mode === 'snow') val = pt.snow

      return {
        type: 'Feature' as const,
        geometry: {
          type: 'Point' as const,
          coordinates: [pt.lon, pt.lat],
        },
        properties: {
          val,
          risk: pt.risk,
          wind: pt.wind,
          rain: pt.rain,
          snow: pt.snow,
          color: (RISK_COLORS as any)[pt.risk]?.hex || '#2E8B57',
        },
      }
    })

    const geojson = {
      type: 'FeatureCollection' as const,
      features,
    }

    if (map.getSource('heatmap-points')) {
      (map.getSource('heatmap-points') as maplibregl.GeoJSONSource).setData(geojson)
    } else {
      map.addSource('heatmap-points', {
        type: 'geojson',
        data: geojson,
      })

      // Soft blur circles for smooth corridor heatmap
      map.addLayer({
        id: 'corridor-heat-glow',
        type: 'circle',
        source: 'heatmap-points',
        paint: {
          'circle-radius': 42,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.35,
          'circle-blur': 0.8,
        },
      })

      map.addLayer({
        id: 'corridor-heat-core',
        type: 'circle',
        source: 'heatmap-points',
        paint: {
          'circle-radius': 14,
          'circle-color': ['get', 'color'],
          'circle-opacity': 0.75,
          'circle-stroke-width': 1.5,
          'circle-stroke-color': '#FFFFFF',
        },
      })
    }

    // Fit corridor bounds
    if (tripData && tripData.routes.length > 0) {
      const bounds = new maplibregl.LngLatBounds()
      tripData.routes.forEach((r) => {
        r.geometry.coordinates.forEach((c) => bounds.extend(c as [number, number]))
      })
      map.fitBounds(bounds, { padding: 60, duration: 0 })
    }
  }

  useEffect(() => {
    updateHeatmapLayer()
  }, [heatmapData, currentHour, mode])

  const currentFrame = heatmapData?.frames[currentHour]

  return (
    <div className="relative w-screen h-screen bg-background flex flex-col">
      {/* Top Header */}
      <header className="h-14 border-b border-border bg-surface px-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/results')}
            className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text-primary px-2.5 py-1.5 rounded border border-border"
          >
            <ArrowLeft size={14} />
            <span>Route Results</span>
          </button>
          <div className="h-4 w-px bg-border" />
          <span className="text-xs font-bold text-text-primary">Trip Corridor Weather Forecast</span>
        </div>

        {/* Metric Selector (Risk / Wind / Rain / Snow) */}
        <div className="flex items-center gap-1 bg-background p-1 rounded border border-border">
          <button
            type="button"
            onClick={() => setMode('risk')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
              mode === 'risk' ? 'bg-primary text-white' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <ShieldAlert size={12} />
            <span>Risk</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('wind')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
              mode === 'wind' ? 'bg-primary text-white' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Wind size={12} />
            <span>Wind</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('rain')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
              mode === 'rain' ? 'bg-primary text-white' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <CloudRain size={12} />
            <span>Rain</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('snow')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold transition ${
              mode === 'snow' ? 'bg-primary text-white' : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <Snowflake size={12} />
            <span>Snow</span>
          </button>
        </div>
      </header>

      {/* Map Area */}
      <div className="flex-1 relative">
        <div ref={mapContainerRef} className="w-full h-full" />

        {/* Bottom Floating Slider */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-20">
          <ForecastSlider
            currentHourIndex={currentHour}
            totalHours={heatmapData?.total_hours || 49}
            displayTime={currentFrame?.display_time || 'Now'}
            onChangeHour={(h) => setCurrentHour(h)}
            departureTimeStr={tripData?.departure_time}
          />
        </div>
      </div>
    </div>
  )
}
