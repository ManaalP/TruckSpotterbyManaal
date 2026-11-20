import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { TripDetails } from './pages/TripDetails'
import { RouteResults } from './pages/RouteResults'

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Entry Point: Trip Details Form Screen with prefilled defaults */}
        <Route path="/" element={<TripDetails />} />
        {/* Results Screen: Unified Map, Route Alternatives, and Heatmap Drawer */}
        <Route path="/results" element={<RouteResults />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
