# Requirements Traceability Table

| # | Requirement from the assessment | Where implemented | How verified | Status |
|---|---|---|---|---|
| 1 | User enters origin, destination, departure date/time, load weight | `frontend/src/pages/TripDetails.tsx`, `backend/routing/api/serializers.py` | Unit tests in `test_api_integration.py` (`test_routes_analyze_validation_error`), UI form validation | Verified |
| 2 | Generate 3 route options using routing API | `backend/routing/services/routes.py` (Mapbox API + waypoint nudging + fallback generator) | Integration tests in `test_api_integration.py` (`test_routes_analyze_success`) confirming 3 routes returned | Verified |
| 3 | Sample weather every 10 / 25 / 50 miles | `backend/routing/services/sampling.py`, `frontend/src/pages/TripDetails.tsx` | Unit test in `test_api_integration.py` verifying checkpoint density at selected intervals | Verified |
| 4 | Use truck's estimated arrival time at each checkpoint | `backend/routing/services/sampling.py`, `backend/routing/services/weather.py` | Test verifying ETAs computed from segment durations and nearest UTC forecast hour matched | Verified |
| 5 | Calculate weather risk with provided risk/load rules | `backend/routing/services/risk.py` | 41 boundary tests in `test_risk.py` covering all wind, rain, snow, and 30k/40k load rules | Verified |
| 6 | Recommend best route balancing risk and time | `backend/routing/services/recommend.py` | 6 ordering tests in `test_recommend.py` testing each tie-break rule and all-blocked case | Verified |
| 7 | Show all routes on a map | `frontend/src/components/MapView.tsx`, `frontend/src/pages/RouteResults.tsx` | MapLibre GeoJSON layers rendered for active & inactive routes | Verified |
| 8 | Show checkpoints, risk levels, and ETAs on map and list | `frontend/src/components/CheckpointList.tsx`, `MapView.tsx` | Two-way click highlighting between checkpoint pins and list items | Verified |
| 9 | Show route summaries (distance, duration, arrival, risk miles, worst point) | `frontend/src/components/RouteCard.tsx`, `RiskBar.tsx` | API serializer and UI card visual verification | Verified |
| 10 | Weather heatmap along trip corridor | `backend/routing/services/heatmap.py`, `frontend/src/pages/WeatherHeatmap.tsx` | Heatmap endpoint returning corridor grid with blur radius | Verified |
| 11 | 0-48 hour forecast slider | `backend/routing/services/heatmap.py`, `frontend/src/components/ForecastSlider.tsx` | Single 49-frame payload scrubbed entirely clientside at 60 fps | Verified |
| 12 | Deliverables: GitHub repo, hosted app, Loom outline | Git repository, Vercel configs, README.md, GitHub workflows | Repository scaffolding, CI/keep-warm workflows, and build verification | Verified |
