import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { RouteOption, HeatmapPoint } from '../api/types'
import { RISK_COLORS } from '../lib/risk'
import { Moon, Sun } from 'lucide-react'

interface MapViewProps {
  routes: RouteOption[]
  selectedRouteId: string
  selectedCheckpointIndex: number | null
  onSelectCheckpoint?: (index: number) => void
  isHeatmapOpen?: boolean
  heatmapPoints?: HeatmapPoint[]
  heatmapMode?: 'risk' | 'wind' | 'rain' | 'snow'
}

// 100% Free Public Standard OpenStreetMap Global Tiles (No API key, No usage limits)
const OSM_TILES_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

function getBearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180)
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon)
  let brng = (Math.atan2(y, x) * 180) / Math.PI
  return (brng + 360) % 360
}

function createDirectionArrowIcon(angle: number, color: string = '#FFFFFF') {
  return L.divIcon({
    className: 'route-direction-arrow',
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    html: `
      <div style="transform: rotate(${angle}deg); width: 16px; height: 16px; display: flex; align-items: center; justify-content: center; pointer-events: none;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="${color}" stroke="#1E293B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="filter: drop-shadow(0px 1px 2px rgba(0,0,0,0.5));">
          <polygon points="12 2 19 21 12 17 5 21 12 2" />
        </svg>
      </div>
    `,
  })
}

function createTruckMarkerIcon(angle: number) {
  return L.divIcon({
    className: 'route-truck-marker',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    html: `
      <div style="transform: rotate(${angle}deg); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; background: #1F5FBF; border: 2px solid #FFFFFF; border-radius: 9999px; box-shadow: 0 2px 6px rgba(0,0,0,0.4);">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
          <path d="M15 18H9" />
          <path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14" />
          <circle cx="17" cy="18.5" r="2.5" fill="#FFFFFF" />
          <circle cx="7" cy="18.5" r="2.5" fill="#FFFFFF" />
        </svg>
      </div>
    `,
  })
}

export const MapView: React.FC<MapViewProps> = ({
  routes,
  selectedRouteId,
  selectedCheckpointIndex,
  onSelectCheckpoint,
  isHeatmapOpen = false,
  heatmapPoints,
  heatmapMode = 'risk',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const [isMapNightMode, setIsMapNightMode] = useState<boolean>(() => {
    const saved = localStorage.getItem('spotter_map_theme')
    if (saved === 'dark') return true
    if (saved === 'light') return false
    // Default according to local time of day: night between 7:00 PM (19:00) and 6:00 AM (06:00)
    const currentHour = new Date().getHours()
    return currentHour >= 19 || currentHour < 6
  })

  const toggleMapTheme = () => {
    setIsMapNightMode((prev) => {
      const next = !prev
      localStorage.setItem('spotter_map_theme', next ? 'dark' : 'light')
      return next
    })
  }
  const tileLayerRef = useRef<L.TileLayer | null>(null)
  const routesGroupRef = useRef<L.FeatureGroup | null>(null)
  const heatmapGroupRef = useRef<L.FeatureGroup | null>(null)

  // Initialize Free Leaflet map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [39.8283, -98.5795],
      zoom: 4,
      zoomControl: true,
      preferCanvas: true,
    })

    const tileLayer = L.tileLayer(OSM_TILES_URL, {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)
    tileLayerRef.current = tileLayer

    // Heatmap group beneath routes
    const heatGroup = L.featureGroup().addTo(map)
    heatmapGroupRef.current = heatGroup

    // Routes group on top
    const rGroup = L.featureGroup().addTo(map)
    routesGroupRef.current = rGroup

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      tileLayerRef.current = null
      routesGroupRef.current = null
      heatmapGroupRef.current = null
    }
  }, [])

  // Auto-resize map when taskbar opens/closes
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current?.invalidateSize()
      }, 100)
    }
  }, [isHeatmapOpen])

  // Heatmap layer updates directly on the map
  useEffect(() => {
    const group = heatmapGroupRef.current
    if (!group) return
    group.clearLayers()

    if (!isHeatmapOpen || !heatmapPoints || heatmapPoints.length === 0) return

    heatmapPoints.forEach((pt) => {
      // Check if this point has non-zero activity for the selected metric
      let hasValue = false
      let color = '#2E8B57'
      let tooltipText = ''

      if (heatmapMode === 'risk') {
        // Show only points with weather/load elevation above baseline Low risk (score > 0)
        hasValue = pt.score > 0
        color = (RISK_COLORS as any)[pt.risk]?.hex || '#2E8B57'
        tooltipText = `Risk: ${pt.risk}`
      } else if (heatmapMode === 'wind') {
        // Show gusts/winds above calm breeze (> 15 mph)
        hasValue = pt.wind >= 15
        tooltipText = `Wind: ${pt.wind.toFixed(0)} mph`
        if (pt.wind >= 45) color = '#C62828'
        else if (pt.wind >= 35) color = '#E07A1F'
        else if (pt.wind >= 25) color = '#E5B800'
        else color = '#60A5FA'
      } else if (heatmapMode === 'rain') {
        // Show ONLY points with active rainfall (> 0)
        hasValue = pt.rain > 0.01
        tooltipText = `Rain: ${pt.rain.toFixed(2)} in/h`
        if (pt.rain >= 0.5) color = '#C62828'
        else if (pt.rain >= 0.25) color = '#E07A1F'
        else if (pt.rain >= 0.1) color = '#2563EB'
        else color = '#60A5FA'
      } else if (heatmapMode === 'snow') {
        // Show ONLY points with active snowfall (> 0)
        hasValue = pt.snow > 0.01
        tooltipText = `Snow: ${pt.snow.toFixed(1)} in/h`
        if (pt.snow >= 2.0) color = '#C62828'
        else if (pt.snow >= 1.0) color = '#0284C7'
        else if (pt.snow >= 0.5) color = '#38BDF8'
        else color = '#93C5FD'
      }

      // Do NOT draw blips if data value is 0 (prevents visual clutter across clean highways)
      if (!hasValue) return

      // Outer blur gradient circle
      L.circleMarker([pt.lat, pt.lon], {
        radius: 28,
        fillColor: color,
        color: 'transparent',
        weight: 0,
        fillOpacity: 0.28,
        interactive: false,
      }).addTo(group)

      // Inner core circle with hover info
      const core = L.circleMarker([pt.lat, pt.lon], {
        radius: 8,
        fillColor: color,
        color: '#FFFFFF',
        weight: 1.5,
        fillOpacity: 0.85,
      })
      core.bindTooltip(tooltipText, { direction: 'top', offset: [0, -5] })
      core.addTo(group)
    })
  }, [heatmapPoints, heatmapMode, isHeatmapOpen])

  // Draw routes, direction arrows, and checkpoints
  useEffect(() => {
    const map = mapRef.current
    const group = routesGroupRef.current
    if (!map || !group) return

    group.clearLayers()

    // 1. Inactive routes
    routes
      .filter((r) => r.id !== selectedRouteId)
      .forEach((r) => {
        const latlngs: [number, number][] = (r.geometry?.coordinates || []).map((coord) => [
          coord[1],
          coord[0],
        ])
        if (latlngs.length > 1) {
          L.polyline(latlngs, {
            color: '#64748B',
            weight: 3.5,
            opacity: 0.55,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(group)
        }
      })

    // 2. Selected Active Route
    const activeRoute = routes.find((r) => r.id === selectedRouteId)
    if (activeRoute) {
      const allCoords = activeRoute.geometry?.coordinates || []

      ;(activeRoute.segments || []).forEach((seg) => {
        const segLatLngs: [number, number][] = seg.coordinates.map((c) => [c[1], c[0]])
        const color = (RISK_COLORS as any)[seg.risk_level]?.hex || '#2E8B57'
        L.polyline(segLatLngs, {
          color,
          weight: 6.5,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(group)
      })

      // Directional Arrows
      if (allCoords.length >= 6) {
        const arrowStep = Math.max(4, Math.floor(allCoords.length / 10))
        for (let i = arrowStep; i < allCoords.length - 2; i += arrowStep) {
          const ptCurrent = allCoords[i]
          const ptNext = allCoords[Math.min(i + 1, allCoords.length - 1)]

          const bearing = getBearingDegrees(
            ptCurrent[1],
            ptCurrent[0],
            ptNext[1],
            ptNext[0]
          )

          L.marker([ptCurrent[1], ptCurrent[0]], {
            icon: createDirectionArrowIcon(bearing, '#F8FAFC'),
            interactive: false,
          }).addTo(group)
        }
      }

      // Small Navigation Truck Marker at origin/start of route
      if (allCoords.length >= 2) {
        const truckPt = allCoords[0]
        const truckNextPt = allCoords[1]
        const truckBearing = getBearingDegrees(
          truckPt[1],
          truckPt[0],
          truckNextPt[1],
          truckNextPt[0]
        )

        const truckMarker = L.marker([truckPt[1], truckPt[0]], {
          icon: createTruckMarkerIcon(truckBearing),
          zIndexOffset: 1000,
        })
        truckMarker.bindTooltip(
          '<strong>Active Freight Carrier</strong><br/>Route Start Point',
          { direction: 'top', offset: [0, -10] }
        )
        truckMarker.addTo(group)
      }

      // 3. Checkpoints
      ;(activeRoute.checkpoints || []).forEach((cp) => {
        const isSelected = cp.index === selectedCheckpointIndex
        const color = (RISK_COLORS as any)[cp.risk_level]?.hex || '#2E8B57'

        const marker = L.circleMarker([cp.lat, cp.lon], {
          radius: isSelected ? 8.5 : 5.5,
          fillColor: color,
          color: '#FFFFFF',
          weight: isSelected ? 3 : 2,
          opacity: 1,
          fillOpacity: 0.95,
        })

        marker.bindTooltip(
          `<strong>${cp.label}</strong><br/>Risk: ${cp.risk_level}<br/>Wind: ${cp.wind_mph.toFixed(0)} mph`,
          { direction: 'top', offset: [0, -6] }
        )

        marker.on('click', () => {
          if (onSelectCheckpoint) onSelectCheckpoint(cp.index)
        })

        marker.addTo(group)
      })

      // Fit bounds
      const activeCoords: [number, number][] = allCoords.map((c) => [c[1], c[0]])
      if (activeCoords.length > 1) {
        map.fitBounds(L.latLngBounds(activeCoords), {
          padding: [45, 45],
          animate: true,
          duration: 0.5,
        })
      }
    }
  }, [routes, selectedRouteId, selectedCheckpointIndex])

  return (
    <div
      className={`relative w-full h-full min-h-[400px] rounded-lg overflow-hidden border border-border shadow-xs ${
        isMapNightMode ? 'map-dark-mode' : ''
      }`}
    >
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Map Theme Toggle (Neutral Minimal Glass Style) */}
      <div className="absolute top-3 right-3 z-[1000] pointer-events-auto">
        <button
          type="button"
          onClick={toggleMapTheme}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-surface border border-border shadow-md text-xs font-semibold text-text-primary hover:bg-background transition cursor-pointer select-none"
          title={`Toggle map mode (currently ${isMapNightMode ? 'Night Mode' : 'Day Mode'})`}
        >
          {isMapNightMode ? (
            <>
              <Moon size={13} className="text-text-muted" />
              <span>Map Night</span>
            </>
          ) : (
            <>
              <Sun size={13} className="text-text-muted" />
              <span>Map Day</span>
            </>
          )}
        </button>
      </div>

      {/* Floating Map Legend Indicator */}
      <div className="absolute bottom-3 left-3 z-[1000] bg-surface/95 backdrop-blur-sm border border-border rounded-md shadow-md p-2.5 max-w-[280px] text-xs pointer-events-auto">
        <div className="font-bold text-text-primary text-[11px] uppercase tracking-wider mb-1.5 flex items-center justify-between">
          <span>Map Indicators</span>
          {isHeatmapOpen && (
            <span className="text-[10px] font-semibold text-primary capitalize px-1.5 py-0.5 rounded bg-primary/10">
              {heatmapMode} Mode
            </span>
          )}
        </div>

        {/* 1. Route Checkpoint Indicator */}
        <div className="space-y-1 mb-2 pb-2 border-b border-border/60">
          <span className="text-[10px] font-semibold text-text-muted block">Route Checkpoints</span>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#2E8B57] border border-white inline-block shadow-xs flex-shrink-0" />
              <span className="text-text-primary">Low Risk</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E5B800] border border-white inline-block shadow-xs flex-shrink-0" />
              <span className="text-text-primary">Moderate</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#E07A1F] border border-white inline-block shadow-xs flex-shrink-0" />
              <span className="text-text-primary">High</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#C62828] border border-white inline-block shadow-xs flex-shrink-0" />
              <span className="text-text-primary">Severe</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 pt-0.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#4A0E1A] border border-white inline-block shadow-xs flex-shrink-0" />
            <span className="text-text-primary text-[10px]">No Travel (Blizzard / Storm)</span>
          </div>
        </div>

        {/* 2. Heatmap Blip Indicators (When Heatmap Taskbar is open) */}
        {isHeatmapOpen && (
          <div className="space-y-1">
            <span className="text-[10px] font-semibold text-text-muted block">
              Corridor Hazard Blips ({heatmapMode.toUpperCase()})
            </span>

            {heatmapMode === 'risk' && (
              <div className="space-y-1 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-3 w-3 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#E5B800] opacity-40"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#E5B800] border border-white"></span>
                  </span>
                  <span>Moderate Weather Risk</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-3 w-3 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#E07A1F] opacity-40"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#E07A1F] border border-white"></span>
                  </span>
                  <span>High Crosswind / Hazard</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-3 w-3 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#C62828] opacity-50"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#C62828] border border-white"></span>
                  </span>
                  <span>Severe / No Travel Warning</span>
                </div>
              </div>
            )}

            {heatmapMode === 'wind' && (
              <div className="space-y-1 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-3 w-3 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#60A5FA] opacity-40"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#60A5FA] border border-white"></span>
                  </span>
                  <span>15–24 mph (Breeze)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-3 w-3 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#E5B800] opacity-40"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#E5B800] border border-white"></span>
                  </span>
                  <span>25–34 mph (Caution)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-3 w-3 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#E07A1F] opacity-40"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#E07A1F] border border-white"></span>
                  </span>
                  <span>35–44 mph (Heavy Wind)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-3 w-3 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#C62828] opacity-50"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#C62828] border border-white"></span>
                  </span>
                  <span>≥ 45 mph (Severe Gale / No Travel)</span>
                </div>
              </div>
            )}

            {heatmapMode === 'rain' && (
              <div className="space-y-1 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-3 w-3 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#60A5FA] opacity-40"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#60A5FA] border border-white"></span>
                  </span>
                  <span>Light Rain (&lt; 0.10 in/h)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-3 w-3 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#2563EB] opacity-40"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#2563EB] border border-white"></span>
                  </span>
                  <span>Moderate Rain (0.10–0.25 in/h)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-3 w-3 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#E07A1F] opacity-40"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#E07A1F] border border-white"></span>
                  </span>
                  <span>Heavy Rain (0.25–0.50 in/h)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-3 w-3 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#C62828] opacity-50"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#C62828] border border-white"></span>
                  </span>
                  <span>Torrential (&gt; 0.50 in/h)</span>
                </div>
              </div>
            )}

            {heatmapMode === 'snow' && (
              <div className="space-y-1 text-[10px]">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-3 w-3 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#93C5FD] opacity-40"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#93C5FD] border border-white"></span>
                  </span>
                  <span>Light Snow (&lt; 0.5 in/h)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-3 w-3 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#38BDF8] opacity-40"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#38BDF8] border border-white"></span>
                  </span>
                  <span>Moderate Snow (0.5–1.0 in/h)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-3 w-3 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#0284C7] opacity-40"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#0284C7] border border-white"></span>
                  </span>
                  <span>Heavy Snow (1.0–2.0 in/h)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="relative flex h-3 w-3 items-center justify-center">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-[#C62828] opacity-50"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#C62828] border border-white"></span>
                  </span>
                  <span>Blizzard (&gt; 2.0 in/h)</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
