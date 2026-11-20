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

// 100% Free OpenStreetMap Global Tile Service (reliable worldwide, free, zero keys needed)
const OSM_TILES_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'

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

  // Initialize Free Leaflet map with standard OpenStreetMap tiles
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    const map = L.map(mapContainerRef.current, {
      center: [39.8283, -98.5795],
      zoom: 4,
      zoomControl: true,
      preferCanvas: true,
    })

    // Standard OpenStreetMap public tile layer
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

  // Draw routes and checkpoints
  useEffect(() => {
    const map = mapRef.current
    const group = layersGroupRef.current
    if (!map || !group) return

    group.clearLayers()

    // 1. Inactive alternative routes (muted grey lines)
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
            weight: 4,
            opacity: 0.6,
            lineCap: 'round',
            lineJoin: 'round',
          }).addTo(group)
        }
      })

    // 2. Selected Active Route (colored by risk segments)
    const activeRoute = routes.find((r) => r.id === selectedRouteId)
    if (activeRoute) {
      (activeRoute.segments || []).forEach((seg) => {
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
      const activeCoords: [number, number][] = (activeRoute.geometry?.coordinates || []).map((c) => [
        c[1],
        c[0],
      ])
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
