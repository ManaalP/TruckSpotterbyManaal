# SpotterAI: Weather-Aware Truck Routing

A mission-critical web application engineered in React + Django to help long-haul commercial truck operators and freight dispatchers choose the safest route based on real-time atmospheric hazards, cargo load weight, and transit duration.

---

## 1. System Architecture

```
                                  +------------------------------+
                                  |   React 18 + Vite Frontend   |
                                  | MapLibre GL, Stitch Tokens,  |
                                  |    Tabular Num, 3 Screens    |
                                  +---------------+--------------+
                                                  |
                                                  | JSON API
                                                  v
                                  +------------------------------+
                                  |    Django REST API Backend   |
                                  | LocMemCache, Vercel Serverless|
                                  +-------+--------------+-------+
                                          |              |
                    +---------------------+              +--------------------+
                    v                                                         v
    +------------------------------+                          +------------------------------+
    |   Mapbox Directions API      |                          |     Open-Meteo Weather API   |
    | Alternative Routes, Geometry |                          |  Batched Hourly Forecasts,   |
    | Annotations (Duration, Dist) |                          |  Wind, Gusts, Rain, Snowfall |
    +------------------------------+                          +------------------------------+
```

---

## 2. Risk Classification Rules

Risk classification is applied at each checkpoint along the route geometry, lower-bound inclusive:

| Level | Wind (mph) | Rain (in/hr) | Snow (in/hr) | Color Hex |
|---|---|---|---|---|
| **Low** | < 25 | < 0.10 | < 0.5 | `#2E8B57` |
| **Moderate** | 25 to < 35 | 0.10 to < 0.25 | 0.5 to < 1.0 | `#E5B800` |
| **High** | 35 to < 45 | 0.25 to < 0.50 | 1.0 to < 2.0 | `#E07A1F` |
| **Severe** | 45 to < 55 | 0.50 to 1.00 | 2.0 to 3.0 | `#C62828` |
| **No Travel** | >= 55 | > 1.00 | > 3.0 | `#4A0E1A` |

### Load Rules
1. **Wind >= 55 mph**: Automatic **No Travel** for any cargo load.
2. **Wind 45–54 mph and cargo load > 30,000 lb**: Upgraded to **No Travel**.
3. **Wind 35–44 mph and cargo load > 40,000 lb**: Upgraded to **Severe** (if base weather level is lower).

---

## 3. Route Recommendation Ordering

Routes are evaluated and sorted by the following strict hierarchy (lower is better):
1. **No Travel Miles**: Routes with impassable conditions are strictly avoided.
2. **Severe Weather Miles**: Minimizes severe weather hazards.
3. **High Risk Miles**: Minimizes chain-law / severe gust conditions.
4. **Average Route Risk**: Minimizes mile-weighted weather risk index.
5. **Total Duration**: Shortest travel time given equivalent risk profiles.

If all routes experience No Travel conditions, `all_routes_blocked: true` is flagged, and the least-hazardous option is highlighted.

---

## 4. UI Specification & Design Tokens (Stitch)

- Conforms strictly to Google Stitch export (`projects/5209370090189557357`):
  - Canvas: `#F7F8FA`, Surfaces: `#FFFFFF`, Borders: `#E1E5EA`
  - Accent: `#1F5FBF` (actions only, never on risk signals)
  - Typography: **Inter**, with `tabular-nums` enforced on all metrics, ETAs, and mileages.
  - Multi-modal risk badges: Color + Explicit Text + Hazard Glyph.

---

## 5. Local Setup & Execution

### Backend
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py runserver 8000
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Running Tests
```bash
cd backend
pytest routing/tests/
```

---

## 6. Deployment Architecture

- **Backend**: Hosted on Vercel Python Serverless Function (`backend/api/index.py` with `maxDuration: 30`). Fallback: Render Web Service.
- **Frontend**: Hosted on Vercel SPA (`dist` build, client-side route rewrites).
- **Keep-Warm**: GitHub Actions workflow pings `GET /api/health` every 10 minutes to prevent cold starts.

---

## 7. Video Walkthrough Outline (5-10 min)

1. **Introduction & Overview (1 min)**: Problem context, truck rollover wind risks, and system goals.
2. **Trip Details (Screen 1) (1.5 min)**: Inputting origin, destination, load weight (e.g. 38,000 lb), and interval (10/25/50 mi).
3. **Route Results & Map (Screen 2) (2.5 min)**: 3 route comparison, MapLibre dynamic segments, risk mile distribution, checkpoint synchronization.
4. **Corridor Heatmap & 0-48h Slider (Screen 3) (2 min)**: Single-payload 49-frame weather scrub, 60 fps slider, metric switching (Risk/Wind/Rain/Snow).
5. **Code Architecture & Tests (2 min)**: Pure `risk.py` and `recommend.py` modules, test coverage, and performance optimizations.
