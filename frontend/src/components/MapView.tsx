import React, { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { RouteOption } from '../api/types'
import { RISK_COLORS } from '../lib/risk'

interface MapViewProps {
  routes: RouteOption[]
  selectedRouteId: string
  selectedCheckpointIndex: number | null
  onSelectCheckpoint?: (index: number) => void
  isHeatmapOpen?: boolean
}

// Highly reliable global tiles with automatic fallback
const PRIMARY_MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
const FALLBACK_MAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty'

export const MapView: React.FC<MapViewProps> = ({
  routes,
  selectedRouteId,
  selectedCheckpointIndex,
  onSelectCheckpoint,
  isHeatmapOpen = false,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const isLoadedRef = useRef(false)

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    let currentStyle = PRIMARY_MAP_STYLE
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: currentStyle,
      center: [-98.5795, 39.8283],
      zoom: 4,
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right')

    map.on('error', () => {
      // Automatic fallback if primary tile style fails to load
      if (!isLoadedRef.current && currentStyle === PRIMARY_MAP_STYLE) {
        currentStyle = FALLBACK_MAP_STYLE
        try {
          map.setStyle(FALLBACK_MAP_STYLE)
        } catch (_) {}
      }
    })

    map.on('load', () => {
      isLoadedRef.current = true
      updateMapLayers()
    })

    mapRef.current = map

    return () => {
      map.remove()
      mapRef.current = null
      isLoadedRef.current = false
    }
  }, [])

  // Auto resize map smoothly when sidebar opens or closes
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current?.resize()
      }, 150)
    }
  }, [isHeatmapOpen])

  // Update GeoJSON layers when routes or selection changes
  const updateMapLayers = () => {
    const map = mapRef.current
    if (!map || !isLoadedRef.current) return

    // 1. Inactive routes source & layer
    const inactiveFeatures = routes
      .filter((r) => r.id !== selectedRouteId)
      .map((r) => ({
        type: 'Feature' as const,
        geometry: r.geometry as any,
        properties: { id: r.id, name: r.name },
      }))

    const inactiveGeoJSON = {
      type: 'FeatureCollection' as const,
      features: inactiveFeatures,
    }

    if (map.getSource('inactive-routes')) {
      (map.getSource('inactive-routes') as maplibregl.GeoJSONSource).setData(inactiveGeoJSON)
    } else {
      map.addSource('inactive-routes', {
        type: 'geojson',
        data: inactiveGeoJSON,
      })
      map.addLayer({
        id: 'inactive-routes-line',
        type: 'line',
        source: 'inactive-routes',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#A0AEC0',
          'line-width': 4,
          'line-opacity': 0.6,
        },
      })
    }

    // 2. Selected Route colored by risk segments
    const selectedRoute = routes.find((r) => r.id === selectedRouteId)
    const segmentFeatures = (selectedRoute?.segments || []).map((seg) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'LineString' as const,
        coordinates: seg.coordinates,
      },
      properties: {
        risk_level: seg.risk_level,
        color: (RISK_COLORS as any)[seg.risk_level]?.hex || '#2E8B57',
      },
    }))

    const activeGeoJSON = {
      type: 'FeatureCollection' as const,
      features: segmentFeatures,
    }

    if (map.getSource('active-route-segments')) {
      (map.getSource('active-route-segments') as maplibregl.GeoJSONSource).setData(activeGeoJSON)
    } else {
      map.addSource('active-route-segments', {
        type: 'geojson',
        data: activeGeoJSON,
      })
      map.addLayer({
        id: 'active-route-line',
        type: 'line',
        source: 'active-route-segments',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 6,
          'line-opacity': 0.95,
        },
      })
    }

    // 3. Checkpoints markers layer
    const checkpointFeatures = (selectedRoute?.checkpoints || []).map((cp) => ({
      type: 'Feature' as const,
      geometry: {
        type: 'Point' as const,
        coordinates: [cp.lon, cp.lat],
      },
      properties: {
        index: cp.index,
        label: cp.label,
        mile: cp.mile,
        risk_level: cp.risk_level,
        color: (RISK_COLORS as any)[cp.risk_level]?.hex || '#2E8B57',
        is_selected: cp.index === selectedCheckpointIndex ? 1 : 0,
      },
    }))

    const checkpointGeoJSON = {
      type: 'FeatureCollection' as const,
      features: checkpointFeatures,
    }

    if (map.getSource('checkpoints')) {
      (map.getSource('checkpoints') as maplibregl.GeoJSONSource).setData(checkpointGeoJSON)
    } else {
      map.addSource('checkpoints', {
        type: 'geojson',
        data: checkpointGeoJSON,
      })
      map.addLayer({
        id: 'checkpoints-circle',
        type: 'circle',
        source: 'checkpoints',
        paint: {
          'circle-radius': [
            'case',
            ['==', ['get', 'is_selected'], 1],
            9,
            5,
          ],
          'circle-color': ['get', 'color'],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
        },
      })

      map.on('click', 'checkpoints-circle', (e: any) => {
        if (e.features && e.features[0] && onSelectCheckpoint) {
          const idx = e.features[0].properties?.index
          if (idx !== undefined) onSelectCheckpoint(Number(idx))
        }
      })

      map.on('mouseenter', 'checkpoints-circle', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'checkpoints-circle', () => {
        map.getCanvas().style.cursor = ''
      })
    }

    // Fit map bounds to selected route
    if (selectedRoute && selectedRoute.geometry.coordinates.length > 0) {
      const bounds = new maplibregl.LngLatBounds()
      selectedRoute.geometry.coordinates.forEach((c) => bounds.extend(c as [number, number]))
      map.fitBounds(bounds, { padding: 45, duration: 600 })
    }
  }

  useEffect(() => {
    updateMapLayers()
  }, [routes, selectedRouteId, selectedCheckpointIndex])

  return (
    <div className="relative w-full h-full min-h-[400px] rounded-lg overflow-hidden border border-border">
      <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  )
}
