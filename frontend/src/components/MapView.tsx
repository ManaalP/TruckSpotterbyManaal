import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { RouteOption, HeatmapPoint } from '../api/types'
import { RISK_COLORS } from '../lib/risk'

interface MapViewProps {
  routes: RouteOption[]
  selectedRouteId: string
  selectedCheckpointIndex: number | null
  onSelectCheckpoint?: (index: number) => void
  isHeatmapOpen?: boolean
  heatmapPoints?: HeatmapPoint[]
  heatmapMode?: 'risk' | 'wind' | 'rain' | 'snow'
}

// 100% Free Standard OpenStreetMap Global Tiles
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

    L.tileLayer(OSM_TILES_URL, {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

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
      let color = (RISK_COLORS as any)[pt.risk]?.hex || '#2E8B57'
      let tooltipText = `Risk: ${pt.risk}`

      if (heatmapMode === 'wind') {
        tooltipText = `Wind: ${pt.wind.toFixed(0)} mph`
        if (pt.wind >= 45) color = '#C62828'
        else if (pt.wind >= 35) color = '#E07A1F'
        else if (pt.wind >= 25) color = '#E5B800'
        else color = '#2E8B57'
      } else if (heatmapMode === 'rain') {
        tooltipText = `Rain: ${pt.rain.toFixed(2)} in/h`
        if (pt.rain >= 0.5) color = '#C62828'
        else if (pt.rain >= 0.25) color = '#E07A1F'
        else if (pt.rain >= 0.1) color = '#3B82F6'
        else color = '#60A5FA'
      } else if (heatmapMode === 'snow') {
        tooltipText = `Snow: ${pt.snow.toFixed(1)} in/h`
        if (pt.snow >= 2.0) color = '#C62828'
        else if (pt.snow >= 1.0) color = '#0284C7'
        else if (pt.snow >= 0.5) color = '#38BDF8'
        else color = '#BAE6FD'
      }

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
    <div className="relative w-full h-full min-h-[400px] rounded-lg overflow-hidden border border-border shadow-xs">
      <div ref={mapContainerRef} className="w-full h-full z-0" />
    </div>
  )
}
