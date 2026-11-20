"""Corridor Heatmap Service generating 0-48h forecast payload.

Strictly follows GEMINI.md Section 8 & 9.
All times formatted clearly with consistent timezone label (e.g. UTC / CST).
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Tuple
from .sampling import haversine_miles
from .weather import fetch_weather_batch_from_api
from .risk import evaluate_checkpoint_risk, LEVEL_LOW

def generate_lateral_offset_point(
    lon1: float, lat1: float,
    lon2: float, lat2: float,
    offset_miles: float
) -> Tuple[float, float]:
    import math
    mid_lat = (lat1 + lat2) / 2.0
    dlat_per_mile = 1.0 / 69.0
    dlon_per_mile = 1.0 / (69.0 * math.cos(math.radians(mid_lat)))

    dx = (lon2 - lon1) / dlon_per_mile
    dy = (lat2 - lat1) / dlat_per_mile
    hyp = math.hypot(dx, dy)
    if hyp == 0:
        return (lon1, lat1)

    nx = -dy / hyp
    ny = dx / hyp

    return (
        round(lon1 + nx * offset_miles * dlon_per_mile, 4),
        round(lat1 + ny * offset_miles * dlat_per_mile, 4),
    )


def generate_corridor_grid(
    routes_coordinates: List[List[List[float]]],
    step_samples: int = 12,
    offset_miles: float = 18.0,
) -> List[Dict[str, Any]]:
    points = []
    seen = set()

    for coords in routes_coordinates:
        if not coords or len(coords) < 2:
            continue
        step = max(1, len(coords) // step_samples)
        for i in range(0, len(coords) - 1, step):
            p1 = coords[i]
            p2 = coords[min(i + 1, len(coords) - 1)]

            center = (round(p1[0], 3), round(p1[1], 3))
            if center not in seen:
                seen.add(center)
                points.append({"lon": center[0], "lat": center[1], "type": "center"})

            p_pos = generate_lateral_offset_point(p1[0], p1[1], p2[0], p2[1], offset_miles)
            key_pos = (round(p_pos[0], 3), round(p_pos[1], 3))
            if key_pos not in seen:
                seen.add(key_pos)
                points.append({"lon": key_pos[0], "lat": key_pos[1], "type": "offset_pos"})

            p_neg = generate_lateral_offset_point(p1[0], p1[1], p2[0], p2[1], -offset_miles)
            key_neg = (round(p_neg[0], 3), round(p_neg[1], 3))
            if key_neg not in seen:
                seen.add(key_neg)
                points.append({"lon": key_neg[0], "lat": key_neg[1], "type": "offset_neg"})

    return points[:65]


def get_heatmap_payload(
    routes_coordinates: List[List[List[float]]],
    load_weight_lb: float = 35000.0,
    start_time: datetime = None,
) -> Dict[str, Any]:
    if start_time is None:
        start_time = datetime.now(timezone.utc)
    elif start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    else:
        start_time = start_time.astimezone(timezone.utc)

    base_hour = start_time.replace(minute=0, second=0, microsecond=0)
    grid = generate_corridor_grid(routes_coordinates)
    coords = [(p["lat"], p["lon"]) for p in grid]

    api_results = fetch_weather_batch_from_api(coords, forecast_days=3)

    frames = []
    for h_idx in range(49):
        dt_utc = base_hour + timedelta(hours=h_idx)
        hour_str = dt_utc.strftime("%Y-%m-%dT%H:00")
        frame_points = []
        for p_idx, pt in enumerate(grid):
            wind = 0.0
            rain = 0.0
            snow = 0.0

            if p_idx < len(api_results) and "hourly" in api_results[p_idx]:
                hourly = api_results[p_idx]["hourly"]
                times = hourly.get("time", [])
                try:
                    t_pos = times.index(hour_str)
                    wind = float(hourly.get("wind_speed_10m", [0])[t_pos] or 0.0)
                    rain = float(hourly.get("rain", [0])[t_pos] or 0.0)
                    snow = float(hourly.get("snowfall", [0])[t_pos] or 0.0)
                except ValueError:
                    pass

            risk_eval = evaluate_checkpoint_risk(wind, rain, snow, load_weight_lb)

            frame_points.append({
                "lat": pt["lat"],
                "lon": pt["lon"],
                "wind": round(wind, 1),
                "rain": round(rain, 2),
                "snow": round(snow, 2),
                "risk": risk_eval["final_level"],
                "score": risk_eval["score"],
            })

        frames.append({
            "hour_index": h_idx,
            "time_iso": dt_utc.isoformat(),
            "points": frame_points,
        })

    return {
        "start_time": base_hour.isoformat(),
        "total_hours": 49,
        "grid_size": len(grid),
        "frames": frames,
    }
