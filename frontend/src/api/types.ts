import type { RiskLevel } from '../lib/risk'

export interface PlaceResult {
  label: string
  lat: number
  lon: number
}

export interface Checkpoint {
  index: number
  mile: number
  lat: number
  lon: number
  label: string
  eta: string
  wind_mph: number
  rain_in_hr: number
  snow_in_hr: number
  risk_level: RiskLevel
  reason: string
  governing_condition: string
  forecast_available: boolean
  owned_miles: number
}

export interface RouteSegment {
  from_index: number
  to_index: number
  risk_level: RiskLevel
  coordinates: [number, number][]
}

export interface RouteSummary {
  distance_miles: number
  duration_seconds: number
  arrival_time: string
  miles_by_level: Record<RiskLevel, number>
  average_risk: number
  worst_level: RiskLevel
  worst_checkpoint: Checkpoint | null
}

export interface RouteOption {
  id: string
  name: string
  geometry: {
    type: string
    coordinates: [number, number][]
  }
  summary: RouteSummary
  checkpoints: Checkpoint[]
  segments: RouteSegment[]
}

export interface RouteRecommendation {
  route_id: string
  reason: string
  ranking: string[]
  all_routes_blocked: boolean
}

export interface RouteAnalyzeResponse {
  origin: PlaceResult
  destination: PlaceResult
  departure_time: string
  load_weight_lb: number
  interval_miles: number
  routes: RouteOption[]
  recommendation: RouteRecommendation
}

export interface HeatmapPoint {
  lat: number
  lon: number
  wind: number
  rain: number
  snow: number
  risk: RiskLevel
  score: number
}

export interface HeatmapFrame {
  hour_index: number
  time_iso: string
  display_time: string
  points: HeatmapPoint[]
}

export interface HeatmapResponse {
  start_time: string
  total_hours: number
  grid_size: number
  frames: HeatmapFrame[]
}
