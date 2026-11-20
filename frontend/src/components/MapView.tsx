import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { RouteOption } from '../api/types'
import { RISK_COLORS } from '../lib/risk'

interface MapViewProps {
  routes: RouteOption[]
  selectedRouteId: string
  selectedCheckpointIndex: number | null
  onSelectCheckpoint?: (index: number) => void
  isHeatmapOpen?: boolean
}

// 100% Free Standard OpenStreetMap Global Tiles
const OSM_TILES_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

/**
 * Calculate bearing angle (degrees 0-360) between two coordinates (lat1, lon1) -> (lat2, lon2)
 */
function getBearingDegrees(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180)
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon)
  let brng = (Math.atan2(y, x) * 180) / Math.PI
  return (brng + 360) % 360
}

/**
 * Create a crisp SVG directional arrow marker pointing along the route bearing
 */
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
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const layersGroupRef = useRef<L.FeatureGroup | null>(null)

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

    const layersGroup = L.featureGroup().addTo(map)
    layersGroupRef.current = layersGroup
    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      layersGroupRef.current = null
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

  // Draw routes, direction arrows, and checkpoints
  useEffect(() => {
    const map = mapRef.current
    const group = layersGroupRef.current
    if (!map || !group) return

    group.clearLayers()

    // 1. Inactive routes (subtle grey polylines)
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

    // 2. Selected Active Route (colored by risk segments + direction arrows)
    const activeRoute = routes.find((r) => r.id === selectedRouteId)
    if (activeRoute) {
      const allCoords = activeRoute.geometry?.coordinates || []

      // Draw risk segments
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

      // Add Directional Arrow Markers periodically along the active route
      if (allCoords.length >= 6) {
        // Place an arrow every ~8-12 coordinates along the geometry
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

          const arrowMarker = L.marker([ptCurrent[1], ptCurrent[0]], {
            icon: createDirectionArrowIcon(bearing, '#F8FAFC'),
            interactive: false,
          })
          arrowMarker.addTo(group)
        }
      }

      // 3. Checkpoints (Interactive circle markers)
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

        // Checkpoint tooltip
        marker.bindTooltip(
          `<strong>${cp.label}</strong><br/>Risk: ${cp.risk_level}<br/>Wind: ${cp.wind_mph.toFixed(0)} mph`,
          { direction: 'top', offset: [0, -6] }
        )

        marker.on('click', () => {
          if (onSelectCheckpoint) onSelectCheckpoint(cp.index)
        })

        marker.addTo(group)
      })

      // Fit map bounds to active route
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
