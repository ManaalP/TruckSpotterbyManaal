import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { RouteResults } from './pages/RouteResults'

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Main interactive unified application */}
        <Route path="/" element={<RouteResults />} />
        <Route path="/results" element={<RouteResults />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
