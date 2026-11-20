import type { PlaceResult, RouteAnalyzeResponse, HeatmapResponse } from './types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || ''

export async function searchGeocode(query: string): Promise<PlaceResult[]> {
  if (!query || query.trim().length < 2) return []
  const res = await fetch(`${BASE_URL}/api/geocode?q=${encodeURIComponent(query)}`)
  if (!res.ok) {
    throw new Error('Failed to fetch address suggestions')
  }
  const data = await res.json()
  return data.results || []
}

export async function analyzeRoutes(payload: {
  origin: string
  destination: string
  departure_time: string
  load_weight_lb: number
  interval_miles: number
}): Promise<RouteAnalyzeResponse> {
  const res = await fetch(`${BASE_URL}/api/routes/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData?.error?.message || 'Failed to analyze routes')
  }
  return res.json()
}

export async function fetchHeatmap(payload: {
  routes_coordinates: number[][][]
  load_weight_lb: number
  start_time?: string
}): Promise<HeatmapResponse> {
  const res = await fetch(`${BASE_URL}/api/heatmap`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    throw new Error('Failed to load corridor weather forecast')
  }
  return res.json()
}
