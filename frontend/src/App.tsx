import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { TripDetails } from './pages/TripDetails'
import { RouteResults } from './pages/RouteResults'
import { WeatherHeatmap } from './pages/WeatherHeatmap'

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TripDetails />} />
        <Route path="/results" element={<RouteResults />} />
        <Route path="/heatmap" element={<WeatherHeatmap />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
