# GEMINI.md: Weather-Aware Truck Routing (Spotter Full Stack Assessment)

You are the lead engineer building this project end to end. Read this entire file before writing code. When anything here conflicts with a guess of yours, this file wins. When the file is silent, choose the simplest option that is correct and tell me what you chose.

## 1. Goal

Build a React + Django web app that helps a truck driver choose the safest route based on weather, load weight and travel time.

The user enters:
- Origin and destination
- Departure date/time
- Load weight (lb)

The app must:
1. Generate 3 route options using a routing API.
2. Sample weather every 10 / 25 / 50 miles (selectable interval, default 25) using the truck's estimated arrival time at each checkpoint.
3. Calculate weather risk per checkpoint using the risk and load rules below.
4. Recommend the best route, balancing weather risk and travel time.
5. Show all routes, checkpoints, risk levels, ETAs and route summaries on a map.
6. Show a weather heatmap along the trip corridor with a 0-48 hour forecast slider.

Deliverables: GitHub repo, hosted application, README (for the 5-10 min Loom walkthrough).

Evaluation weights: 40% routes/weather/risk/recommendation logic, 40% UI/map/heatmap smoothness and performance, 15% code quality, 5% documentation and walkthrough.

**Prioritize correctness and clarity over extra features. Do not add features that are not listed here.**

## 2. Source of truth for the UI (Stitch)

The UI design comes from my Google Stitch project. It is intentionally simple, with 3 screens:
1. **Trip Details**: a centred card where the driver enters origin, destination, departure date/time and load weight. This is the entry point.
2. **Route Results**: left panel with the recommendation card, 3 route cards (duration, distance, ETA, risk bar, worst-risk badge) and a checkpoint list; right side is the map with 3 routes.
3. **Weather Heatmap**: the map with a heatmap layer, Risk/Wind/Rain/Snow selector, and a bottom bar with the 0-48 h slider.

How to get the design:
- If the Stitch MCP server is connected, fetch the screens from my Stitch project and use them directly.
- Otherwise read the exported files in `/design/stitch/` (HTML, CSS, screenshots).
- Treat the export as a **visual spec**, not as code to paste. Rebuild every screen as clean, typed React components. Do not copy raw exported markup, inline styles or generated class soup.
- Extract design tokens (colours, font sizes, spacing, radii) into `frontend/src/styles/tokens.css` and the Tailwind config. Components use tokens only, never hard-coded hex values.
- If the Stitch design lacks something the requirements demand (for example the 10/25/50 mile interval), add it in the same visual style and keep it minimal (a small segmented control on the Trip Details card under "Advanced").
- If the design and the requirements conflict, the requirements win.

### Design tokens (use these if the export is missing them)
- Background #F7F8FA, surface #FFFFFF, border #E1E5EA, text #1B2430, muted text #5B6675
- Accent (buttons, selected states only): #1F5FBF
- Risk colours, used only for risk: Low #2E8B57, Moderate #E5B800, High #E07A1F, Severe #C62828, No Travel #4A0E1A
- Every risk badge has colour + text + icon/shape. Never colour alone.
- Font: Inter. Tabular numerals for all times, miles, weights, weather values.
- Flat design, 8px radius, 1px borders, no gradients, no glow, no emojis.

## 3. Tech stack (fixed)

**Frontend**: React 18 + Vite + TypeScript, Tailwind CSS, React Router (3 routes), TanStack Query for API calls, MapLibre GL JS for the map and heatmap (WebGL, smooth with many points). Free basemap tiles (OpenFreeMap or Carto Positron), no key required.

**Backend**: Python 3.11+, Django 5 + Django REST Framework, `requests` (with timeouts and retries), Django cache (local memory), `django-cors-headers`. Tests with `pytest` + `pytest-django`. The primary host is Vercel serverless (see Section 13), so no gunicorn is needed there; `gunicorn` and `whitenoise` are only for the fallback host.

**Third-party APIs** (all keys come from environment variables, never committed):
- Routing + geocoding: Mapbox Directions (`alternatives=true`, `driving` profile, `geometries=geojson`, `annotations=duration,distance`) and Mapbox Geocoding. If the API returns fewer than 3 routes, request more by adding a via-waypoint nudge or an `exclude` option, and de-duplicate near-identical geometries. If you prefer another provider (OpenRouteService, Google Routes, GraphHopper), explain the trade-off in one sentence first.
- Weather: Open-Meteo forecast API (no key). Request hourly `wind_speed_10m`, `wind_gusts_10m`, `rain`, `snowfall`, `precipitation` with `wind_speed_unit=mph`, `precipitation_unit=inch`, `timezone=UTC`, `forecast_days=3` (or more if departure is later). Open-Meteo accepts multiple comma-separated coordinates in one request, so **batch all checkpoints into as few calls as possible** instead of one call per point. Verify the parameter names against the current docs before coding.

## 4. Repository layout

```
/
├── GEMINI.md
├── README.md
├── design/stitch/              # Stitch exports (read-only input)
├── docs/REQUIREMENTS.md        # traceability table (Section 16)
├── .github/workflows/
│   ├── ci.yml                  # lint, test, build
│   └── keep-warm.yml           # scheduled ping of /api/health
├── backend/
│   ├── manage.py
│   ├── vercel.json
│   ├── requirements.txt
│   ├── api/index.py            # exposes Django WSGI app to Vercel
│   ├── config/                 # settings, urls, wsgi
│   └── routing/
│       ├── api/                # views, serializers, urls
│       ├── services/
│       │   ├── geocoding.py
│       │   ├── routes.py       # fetch + normalize 3 routes
│       │   ├── sampling.py     # checkpoints at interval + ETAs
│       │   ├── weather.py      # batched Open-Meteo client + cache
│       │   ├── risk.py         # PURE functions: classification + load rules
│       │   ├── recommend.py    # PURE functions: scoring + ranking
│       │   └── heatmap.py      # corridor grid + 0-48h payload
│       └── tests/
└── frontend/
    ├── vercel.json
    └── src/
        ├── pages/              # TripDetails, RouteResults, WeatherHeatmap
        ├── components/         # RiskBadge, RiskBar, RouteCard, CheckpointList, MapView, ForecastSlider...
        ├── api/                # typed client + types
        ├── hooks/
        ├── lib/                # risk constants, formatters
        └── styles/tokens.css
```

`risk.py` and `recommend.py` must be pure (no network, no Django imports) so they are trivially unit-testable.

## 5. Risk rules (implement exactly)

Per-condition classification at each checkpoint. Boundaries are **lower-bound inclusive** (document this in the README, since the assessment table shares edge values between columns):

| Level | Wind (mph) | Rain (in/hr) | Snow (in/hr) |
|---|---|---|---|
| Low | < 25 | < 0.10 | < 0.5 |
| Moderate | 25 to < 35 | 0.10 to < 0.25 | 0.5 to < 1.0 |
| High | 35 to < 45 | 0.25 to < 0.50 | 1.0 to < 2.0 |
| Severe | 45 to < 55 | 0.50 to 1.00 | 2.0 to 3.0 |
| No Travel | >= 55 | > 1.00 | > 3.0 |

Checkpoint risk = the **worst** level among wind, rain and snow. Record which condition governed it.

Load rules (applied after classification, using wind speed at that checkpoint):
- Wind >= 55 mph: **No Travel** for any load.
- Wind 45-54 mph and load > 30,000 lb: **No Travel**.
- Wind 35-44 mph and load > 40,000 lb: **Severe** (upgrade to Severe if the base level is lower).

The final level is the worse of the weather level and the load-rule result. Store the reason as readable text, for example "Wind 41 mph is High, upgraded to Severe because the load is over 40,000 lb."

Numeric scale for averages: Low 0, Moderate 1, High 2, Severe 3, No Travel 4.

Use the forecast **hour nearest to the ETA** at each checkpoint (UTC). If the ETA is beyond the forecast horizon, mark the checkpoint "forecast unavailable", exclude it from scoring, and surface that clearly in the UI.

## 6. Checkpoints, ETAs and miles per risk level

- Generate checkpoints along each route geometry every N miles (N is 10, 25 or 50; default 25), always including the origin and destination.
- ETA at a checkpoint = departure time + cumulative driving duration to that point, computed from the route's per-segment duration annotations (fall back to proportional distance x total duration if annotations are missing).
- Each checkpoint "owns" the stretch of road centred on it (midpoint to midpoint). Miles per risk level = sum of owned stretches by level. This produces Low / Moderate / High / Severe / No Travel miles per route.
- Each route summary includes: distance, duration, arrival time, miles per level, mile-weighted average risk (0-4), worst level, worst checkpoint (location, mile, ETA, reason).

## 7. Recommendation logic

Rank routes by this sort key (lower is better), in this order:
1. No Travel miles (a route with any No Travel miles is never recommended over one without; document this reading of the rules in the README)
2. Severe miles (fewest)
3. High miles (fewest)
4. Average risk (lowest)
5. Duration (shortest)

Return the ranking, the winner, and a plain-language reason built from the first rule that actually separated the winner from the runner-up (for example "No severe weather (0 vs 42 mi) and 1 h 10 m longer than the fastest route"). If every route has No Travel miles, return `all_routes_blocked: true` and still identify the least-bad route.

## 8. API contract

All endpoints are under `/api/`, JSON, with typed serializers and validation errors in a consistent shape `{ "error": { "code": "...", "message": "...", "fields": {...} } }`.

- `GET /api/geocode?q=` : autocomplete suggestions (label, lat, lon).
- `POST /api/routes/analyze` : body `{ origin, destination, departure_time (ISO 8601 with timezone), load_weight_lb, interval_miles (10|25|50) }`. Returns 3 routes, each with geometry (GeoJSON), summary, checkpoints (mile, lat, lon, label, eta, wind, rain, snow, level, reason, forecast_available), risk-coloured segments for map drawing, plus `recommendation { route_id, reason, ranking[] }`.
- `POST /api/heatmap` : body `{ route_ids or geometries, load_weight_lb }`. Returns **all 49 hourly frames (0-48 h) in one payload** for a corridor point grid (sample points along the routes at the chosen interval, plus lateral offsets of about 15 miles each side). Each point carries per-hour wind, rain, snow and risk level. The frontend scrubs the slider by indexing into this payload, with no refetch per slider move.
- `GET /api/health` : for hosting health checks and the keep-warm job.

Validation: required fields, load weight must be a positive number (reasonable upper bound, e.g. 80,000 lb), departure must not be in the past and must be inside the weather forecast window. Return friendly errors.

## 9. Performance and reliability rules

- Batch weather requests. Never call Open-Meteo once per checkpoint.
- Cache weather by rounded coordinates (0.1 degree) and hour for 30 minutes. The app must work correctly with an empty cache.
- Set timeouts on every external call, retry transient failures with backoff, and return a partial-result error state rather than crashing.
- Simplify route geometry for display (Douglas-Peucker) but compute checkpoints from the full-resolution geometry.
- Frontend: render route lines and checkpoints as MapLibre GeoJSON sources and layers (not DOM markers) so the map stays smooth; memoise components, debounce geocode autocomplete (300 ms), keep the slider interaction at 60 fps by updating a single layer property or source, not re-rendering React trees.
- Target: results in under about 6 seconds for a 1,000-mile trip, slider scrub with no visible lag.

## 10. UI behaviour requirements

- Screen 1 validates inline (label, message and icon, not colour alone). Submitting shows a loading state with steps ("Finding routes, fetching weather, scoring risk") and a cancel option.
- Screen 2: selecting a route card selects it on the map, with the selected route drawn thick and coloured by risk segment and the others thin grey. Clicking a checkpoint on the map highlights its row in the list and vice versa. The recommended route is clearly badged.
- Screen 3: heatmap uses a sequential ramp (light yellow, orange, red, deep maroon), semi-transparent so the basemap stays readable; the slider shows absolute time (for example "Sat 2:00 PM") and marks the departure/arrival window; play/pause steps hours automatically.
- States: empty, loading, results, all-routes-blocked warning, API error with retry (inputs preserved), forecast unavailable.
- Responsive down to 390 px: the left panel becomes a bottom sheet over the map.
- Accessibility: keyboard reachable controls, visible focus ring, risk shown by icon + text + colour, AA contrast.

## 11. Code quality rules

- TypeScript strict mode, no `any`. Python type hints and docstrings on public functions.
- Small modules, one responsibility each, no dead code, no commented-out code.
- Constants for thresholds in one place on each side (`risk.py`, `lib/risk.ts`); keep them in sync and mention it in the README.
- Lint and format: Ruff + Black (backend), ESLint + Prettier (frontend).
- Unit tests (table-driven) for `risk.py` covering every boundary value and all three load rules, for `recommend.py` covering each tie-break step and the all-blocked case, and for ETA/sampling logic. Mock external APIs; add one integration test of `/api/routes/analyze` with mocked providers.
- Conventional commits, one commit per phase or logical unit.

## 12. Working process

Work in phases. After each phase: run the tests, run the app, summarise what changed in 3-5 lines, commit, and wait for my "continue" only if a decision needs me. Otherwise move to the next phase.

1. Scaffold: repo layout, Django project, Vite app, env files (`.env.example`), CORS, health endpoint.
2. Risk engine and recommendation (pure code + tests). Do this before any API integration.
3. Routing, geocoding, sampling, ETAs, weather client, `/api/routes/analyze`.
4. Design tokens and base components from Stitch (RiskBadge, RiskBar, RouteCard, inputs, buttons).
5. Screen 1 (Trip Details) wired to the API.
6. Screen 2 (Route Results) with the MapLibre map and checkpoint list.
7. Heatmap endpoint and Screen 3 with the forecast slider.
8. Error/loading/edge states, responsive layout, accessibility pass, performance pass.
9. README, `docs/REQUIREMENTS.md`, CI and keep-warm workflows, deployment, final checklist.

Rules:
- Ask before adding any dependency not listed in section 3.
- Never commit secrets. Keep `.env.example` current.
- If an external API behaves differently from what this file assumes, check its docs, adapt, and tell me.
- If a requirement is ambiguous, state the assumption in the README under "Assumptions".

## 13. Deployment (free and always up: Vercel + GitHub)

Constraint: everything must be hostable for free with no credit card, and the hosted app must always respond. GitHub Pages cannot run Django, so the backend also runs on Vercel as a serverless Python function. GitHub holds the repo, CI and a keep-warm job. Free-tier limits change, so check the current Vercel documentation for function time limits before finalising config.

### Backend on Vercel (project 1, Root Directory = `backend`)
- Expose Django's WSGI app from `backend/api/index.py`: `from config.wsgi import application; app = application`.
- `backend/vercel.json`: Python runtime for `api/index.py`, a rewrite sending all paths (`/(.*)`) to `/api/index`, and a `maxDuration` that fits the analyze call (set the highest value the Hobby plan allows, up to 30 s).
- `backend/requirements.txt` must list every runtime dependency (no dev-only packages).
- No database and no local file writes: the app is stateless. Configure Django so nothing needs migrations at runtime (in-memory SQLite or remove unused apps). Do not rely on sessions or the admin.
- The Django cache uses `LocMemCache`. It is per instance and may reset on cold starts, which is acceptable.
- Settings from env vars: `DJANGO_SECRET_KEY`, `DEBUG=False`, `ALLOWED_HOSTS` (include the `.vercel.app` domain), `CORS_ALLOWED_ORIGINS` (the frontend URL), `MAPBOX_TOKEN`.
- Keep imports light and avoid work at import time to keep cold starts short.

### Frontend on Vercel (project 2, Root Directory = `frontend`)
- Framework preset Vite, build `npm run build`, output `dist`.
- `frontend/vercel.json` with an SPA rewrite so React Router deep links work.
- Env var `VITE_API_BASE_URL` = the backend Vercel URL. Any Mapbox token used in the browser must be a restricted public token (URL-restricted), never the secret one.

### GitHub
- Public repo with a clear README.
- `.github/workflows/ci.yml`: on push and pull request, run backend lint + pytest and frontend lint + typecheck + build.
- `.github/workflows/keep-warm.yml`: a scheduled workflow (cron every 10 minutes, plus manual dispatch) that curls `GET /api/health` on the hosted backend and fails loudly if it is not 200. The backend URL comes from a repository variable, not a hard-coded value.
- Connect both Vercel projects to the GitHub repo so every push to `main` deploys automatically.

### Fallback backend host
If the Vercel Python function cannot meet the analyze call's time limit, deploy the same Django app to Render's free web service (gunicorn + whitenoise, start command `gunicorn config.wsgi`), keep `keep-warm.yml` pinging `/api/health` every 10 minutes, and update `VITE_API_BASE_URL`. Keep the code host-agnostic: no Vercel-specific imports outside `backend/api/index.py`. Render's free tier sleeps after about 15 minutes idle with a slow first request, so the ping matters.

### Free-tier hygiene
- Mapbox and Open-Meteo calls happen only on the backend, are batched and cached, so usage stays far below free limits.
- Handle upstream rate limits (HTTP 429) with a friendly error and a retry hint.
- Fail gracefully if the function hits its time limit: return a clear error and let the UI offer "Try again" with the same inputs.

### Verification before calling deployment done
1. `GET <backend>/api/health` returns 200 from a cold start.
2. Full flow works on the hosted URLs with a long real trip (for example Chicago, IL to Denver, CO) and a heavy load (38,000 lb).
3. Reload on `/results` and `/heatmap` deep links works (SPA rewrite).
4. No secrets in the repo or browser bundle.
5. Record the two live URLs in the README.

## 14. README must contain

Overview and screenshots, architecture diagram (simple), how to run locally, environment variables, API reference, risk rules table and boundary assumption, recommendation logic and its ordering assumption, performance choices, hosting setup (Vercel + GitHub keep-warm, and the Render fallback), known limitations (including free-tier cold starts), and a short Loom walkthrough outline (5-10 min): problem, demo of the 3 screens, risk and recommendation logic with a unit-test run, heatmap smoothness, code structure, trade-offs. Also state how each of the four evaluation areas is addressed (logic correctness, map/heatmap performance, code quality, documentation).

## 15. Definition of done

- [ ] All six functional requirements work against live APIs
- [ ] Risk and load rules pass boundary tests, and the recommendation passes tie-break tests
- [ ] Three screens match the Stitch design and tokens
- [ ] Heatmap slider is smooth, with no refetch while scrubbing
- [ ] Error, loading and all-routes-blocked states exist
- [ ] Lint and tests pass in CI, with no secrets in the repo
- [ ] Both Vercel projects deployed, keep-warm workflow running, hosted app works end to end
- [ ] README complete, `docs/REQUIREMENTS.md` filled in and verified, Loom outline ready

## 16. Requirements traceability (must be filled in and verified before finishing)

Create `docs/REQUIREMENTS.md` with this table. For each row give the file(s) implementing it, the test(s) or manual check proving it, and its status. Do not mark a row done without running the check.

| # | Requirement from the assessment | Where implemented | How verified |
|---|---|---|---|
| 1 | User enters origin and destination, departure date/time, load weight | Trip Details page, `POST /api/routes/analyze` validation | UI test + API validation tests |
| 2 | Generate 3 route options using a routing API | `services/routes.py` (Mapbox alternatives, fallback to reach 3, de-duplication) | Integration test with mocked provider returning 1, 2 and 3 routes |
| 3 | Sample weather every 10 / 25 / 50 miles | `services/sampling.py`, `interval_miles` input and UI control | Unit tests for checkpoint counts at each interval |
| 4 | Use the truck's estimated arrival time at each checkpoint | ETA from cumulative segment durations; weather lookup by nearest forecast hour | Unit test: later departure yields different forecast hour per checkpoint |
| 5 | Calculate weather risk with the provided risk/load rules | `services/risk.py` (table + three load rules) | Table-driven boundary tests for wind, rain, snow and all load rules |
| 6 | Recommend the best route balancing risk and time | `services/recommend.py` ordered sort key + reason text | Tests for each tie-break step and the all-blocked case |
| 7 | Show all routes on a map | Route Results map (MapLibre layers) | Manual check + screenshot in README |
| 8 | Show checkpoints, risk levels and ETAs on the map and in a list | Checkpoint layer, popovers, linked list | Manual check |
| 9 | Show route summaries (distance, duration, arrival, risk miles, average risk, worst point) | RouteCard, `summary` in API response | API contract test |
| 10 | Weather heatmap along the trip corridor | `services/heatmap.py`, MapLibre heatmap layer | Manual check + payload shape test |
| 11 | 0-48 hour forecast slider | ForecastSlider using the single 49-frame payload | Manual check: no network calls while scrubbing |
| 12 | Deliverables: GitHub repo, hosted app, Loom outline | Repo, Vercel URLs, README walkthrough outline | Final deployment verification list |