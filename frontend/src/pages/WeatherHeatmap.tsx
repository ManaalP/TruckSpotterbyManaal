import React from 'react'
import { Navigate } from 'react-router-dom'

// Replaced standalone page with the unified right-hand taskbar drawer in RouteResults
export const WeatherHeatmap: React.FC = () => {
  return <Navigate to="/" replace />
}
