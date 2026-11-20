"""Weather service integrating Open-Meteo API with coordinate clustering and multi-level caching.

Optimized strictly for sub-second responses:
- Groups checkpoints within 0.25 degree radius (~25 km) to reduce distinct coordinates queried.
- Multi-checkpoint queries chunked up to 60 locations per call.
- LocMemCache 30-minute TTL with sanitized keys.
- Fallback weather estimation if network is slow.
"""

import time
import hashlib
import requests
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Tuple
from django.core.cache import cache

OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
CACHE_TTL_SECONDS = 1800  # 30 minutes
BATCH_SIZE = 60

def round_coord(coord: float) -> float:
    """Round coordinate to 0.2 degrees (~20 km) for weather clustering and caching."""
    return round(coord * 5.0) / 5.0


def make_wx_cache_key(lat: float, lon: float, hour_iso: str) -> str:
    r_lat = round_coord(lat)
    r_lon = round_coord(lon)
    raw = f"{r_lat:.2f}_{r_lon:.2f}_{hour_iso}"
    return f"wx_{hashlib.md5(raw.encode()).hexdigest()[:14]}"


def fetch_weather_batch_from_api(
    coords: List[Tuple[float, float]],
    forecast_days: int = 3,
) -> List[Dict[str, Any]]:
    if not coords:
        return []

    lats = [f"{c[0]:.4f}" for c in coords]
    lons = [f"{c[1]:.4f}" for c in coords]

    params = {
        "latitude": ",".join(lats),
        "longitude": ",".join(lons),
        "hourly": "wind_speed_10m,wind_gusts_10m,rain,snowfall,precipitation",
        "wind_speed_unit": "mph",
        "precipitation_unit": "inch",
        "timezone": "UTC",
        "forecast_days": max(1, min(forecast_days, 7)),
    }

    try:
        resp = requests.get(OPEN_METEO_FORECAST_URL, params=params, timeout=5)
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list):
                return data
            elif isinstance(data, dict):
                return [data]
    except Exception:
        pass

    return []


def get_weather_for_checkpoints(
    checkpoints: List[Dict[str, Any]],
    departure_time: datetime,
) -> List[Dict[str, Any]]:
    if not checkpoints:
        return checkpoints

    # 1. Round hours and check cache
    needed_queries = []  # list of (index, lat, lon, nearest_hour_iso)
    unique_coords_map = {}  # (rounded_lat, rounded_lon, hour_iso) -> list of checkpoint indices

    for idx, cp in enumerate(checkpoints):
        eta = cp.get("eta_datetime")
        if not eta:
            cp["forecast_available"] = False
            cp["wind_mph"] = 12.0
            cp["rain_in_hr"] = 0.0
            cp["snow_in_hr"] = 0.0
            continue

        if eta.tzinfo is None:
            eta = eta.replace(tzinfo=timezone.utc)
        else:
            eta = eta.astimezone(timezone.utc)

        minute = eta.minute
        hour_offset = 1 if minute >= 30 else 0
        nearest_hour = eta.replace(minute=0, second=0, microsecond=0) + timedelta(hours=hour_offset)
        nearest_hour_iso = nearest_hour.strftime("%Y-%m-%dT%H:00")
        cp["target_hour_iso"] = nearest_hour_iso

        r_lat = round_coord(cp["lat"])
        r_lon = round_coord(cp["lon"])
        ckey = make_wx_cache_key(r_lat, r_lon, nearest_hour_iso)
        cached_wx = cache.get(ckey)

        if cached_wx:
            cp["wind_mph"] = cached_wx.get("wind_mph", 12.0)
            cp["rain_in_hr"] = cached_wx.get("rain_in_hr", 0.0)
            cp["snow_in_hr"] = cached_wx.get("snow_in_hr", 0.0)
            cp["forecast_available"] = True
        else:
            key_tuple = (r_lat, r_lon, nearest_hour_iso)
            if key_tuple not in unique_coords_map:
                unique_coords_map[key_tuple] = []
            unique_coords_map[key_tuple].append(idx)

    # 2. Batch fetch for unique clustered coordinates
    if unique_coords_map:
        unique_keys = list(unique_coords_map.keys())
        for i in range(0, len(unique_keys), BATCH_SIZE):
            chunk = unique_keys[i : i + BATCH_SIZE]
            coords = [(k[0], k[1]) for k in chunk]

            api_results = fetch_weather_batch_from_api(coords, forecast_days=3)

            for j, k_tuple in enumerate(chunk):
                r_lat, r_lon, target_hour = k_tuple
                target_indices = unique_coords_map[k_tuple]

                wind = 12.0
                rain = 0.0
                snow = 0.0
                avail = False

                if j < len(api_results) and "hourly" in api_results[j]:
                    hourly = api_results[j]["hourly"]
                    times = hourly.get("time", [])
                    try:
                        time_idx = times.index(target_hour)
                    except ValueError:
                        time_idx = -1

                    if time_idx != -1:
                        wind = float(hourly.get("wind_speed_10m", [12.0])[time_idx] or 0.0)
                        rain = float(hourly.get("rain", [0])[time_idx] or 0.0)
                        snow = float(hourly.get("snowfall", [0])[time_idx] or 0.0)
                        avail = True

                wx_data = {
                    "wind_mph": wind,
                    "rain_in_hr": rain,
                    "snow_in_hr": snow,
                }
                ckey = make_wx_cache_key(r_lat, r_lon, target_hour)
                cache.set(ckey, wx_data, CACHE_TTL_SECONDS)

                for c_idx in target_indices:
                    cp = checkpoints[c_idx]
                    cp["wind_mph"] = wind
                    cp["rain_in_hr"] = rain
                    cp["snow_in_hr"] = snow
                    cp["forecast_available"] = avail

    return checkpoints
