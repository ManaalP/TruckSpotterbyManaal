import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import type { RouteAnalyzeResponse } from '../api/types'
import { RouteCard } from '../components/RouteCard'
import { CheckpointList } from '../components/CheckpointList'
import { MapView } from '../components/MapView'
import { RiskBadge } from '../components/RiskBadge'
import { ArrowLeft, Layers } from 'lucide-react'

export const RouteResults: React.FC = () => {
  const navigate = useNavigate()
  const [data, setData] = useState<RouteAnalyzeResponse | null>(null)
  const [selectedRouteId, setSelectedRouteId] = useState<string>('route_1')
  const [selectedCheckpointIndex, setSelectedCheckpointIndex] = useState<number | null>(null)

  useEffect(() => {
    const raw = sessionStorage.getItem('spotter_route_data')
    if (!raw) {
      navigate('/')
      return
    }
    try {
      const parsed: RouteAnalyzeResponse = JSON.parse(raw)
      setData(parsed)
      // Default selected to recommended route
      if (parsed.recommendation?.route_id) {
        setSelectedRouteId(parsed.recommendation.route_id)
      }
    } catch {
      navigate('/')
    }
  }, [navigate])

  if (!data) return null

  const selectedRoute = data.routes.find((r) => r.id === selectedRouteId) || data.routes[0]

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation Bar */}
      <header className="h-14 border-b border-border bg-surface px-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-text-primary px-2.5 py-1.5 rounded border border-border"
          >
            <ArrowLeft size={14} />
            <span>Edit Trip</span>
          </button>
          <div className="h-4 w-px bg-border" />
          <div className="text-xs text-text-muted truncate">
            <span className="font-semibold text-text-primary">{data.origin.label}</span>
            <span className="mx-1.5">→</span>
            <span className="font-semibold text-text-primary">{data.destination.label}</span>
            <span className="ml-2 tabular-nums">({data.load_weight_lb.toLocaleString()} lb)</span>
          </div>
        </div>

        <button
          onClick={() => navigate('/heatmap')}
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded bg-primary text-white hover:bg-primary-dark transition"
        >
          <Layers size={14} />
          <span>Corridor Heatmap</span>
        </button>
      </header>

      {/* Main 2-Panel Layout */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Side: Recommendations, Route Cards, Checkpoint details */}
        <div className="w-full lg:w-[480px] p-4 flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-56px)] border-r border-border bg-surface">
          {/* Recommendation Banner */}
          <div className="p-4 rounded-lg bg-primary-light/30 border border-primary/20 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                Recommendation
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
            <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
              Available Route Options ({data.routes.length})
            </span>
            {data.routes.map((r) => (
              <RouteCard
                key={r.id}
                route={r}
                isSelected={r.id === selectedRouteId}
                isRecommended={r.id === data.recommendation.route_id}
                onSelect={() => {
                  setSelectedRouteId(r.id)
                  setSelectedCheckpointIndex(null)
                }}
              />
            ))}
          </div>

          {/* Checkpoint Timeline List */}
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-text-muted">
                Route Checkpoints ({selectedRoute.checkpoints.length})
              </span>
              <span className="text-[11px] text-text-muted">
                Every {data.interval_miles} mi
              </span>
            </div>
            <CheckpointList
              checkpoints={selectedRoute.checkpoints}
              selectedCheckpointIndex={selectedCheckpointIndex}
              onSelectCheckpoint={(idx) => setSelectedCheckpointIndex(idx)}
            />
          </div>
        </div>

        {/* Right Side: Interactive Map */}
        <div className="flex-1 p-4 bg-background flex flex-col min-h-[500px]">
          <MapView
            routes={data.routes}
            selectedRouteId={selectedRouteId}
            selectedCheckpointIndex={selectedCheckpointIndex}
            onSelectCheckpoint={(idx) => setSelectedCheckpointIndex(idx)}
          />
        </div>
      </div>
    </div>
  )
}
