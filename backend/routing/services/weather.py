"""Weather service integrating Open-Meteo API with caching and batching.

Strictly follows GEMINI.md Section 3 & 9:
- Open-Meteo forecast API (no key).
- Hourly wind_speed_10m, wind_gusts_10m, rain, snowfall, precipitation
  with wind_speed_unit=mph, precipitation_unit=inch, timezone=UTC, forecast_days=3.
- Batches coordinates into as few calls as possible (comma-separated).
- Cache weather by rounded coordinates (0.1 degree) and hour for 30 minutes.
- Timeout and retry with backoff.
"""

import time
import requests
from datetime import datetime, timezone
from typing import List, Dict, Any, Tuple
from django.core.cache import cache

OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
CACHE_TTL_SECONDS = 1800  # 30 minutes
BATCH_SIZE = 50           # Open-Meteo supports multi-location queries

def round_coord(coord: float) -> float:
    """Round coordinate to 0.1 degree (~11 km) for caching."""
    return round(coord, 1)


def get_cache_key(lat: float, lon: float, hour_iso: str) -> str:
    """Generate cache key for a given coordinate and UTC hour."""
    r_lat = round_coord(lat)
    r_lon = round_coord(lon)
    return f"wx:{r_lat:.1f}:{r_lon:.1f}:{hour_iso}"


def fetch_weather_batch_from_api(
    coords: List[Tuple[float, float]],
    forecast_days: int = 3,
) -> List[Dict[str, Any]]:
    """
    Fetch weather for a list of (lat, lon) from Open-Meteo in batched API calls.
    Returns list of hourly forecast dicts corresponding to input coords.
    """
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

    # Retry up to 3 times with exponential backoff
    max_retries = 3
    backoff = 0.5
    for attempt in range(max_retries):
        try:
            resp = requests.get(OPEN_METEO_FORECAST_URL, params=params, timeout=8)
            if resp.status_code == 200:
                data = resp.json()
                if isinstance(data, list):
                    return data
                elif isinstance(data, dict):
                    return [data]
            elif resp.status_code == 429:
                time.sleep(backoff * (attempt + 1))
            else:
                resp.raise_for_status()
        except Exception:
            if attempt == max_retries - 1:
                break
            time.sleep(backoff * (attempt + 1))

    return []


def get_weather_for_checkpoints(
    checkpoints: List[Dict[str, Any]],
    departure_time: datetime,
) -> List[Dict[str, Any]]:
    """
    Given checkpoints with 'lat', 'lon', and 'eta_datetime', populate weather conditions
    using cache and batched Open-Meteo requests.
    """
    if not checkpoints:
        return checkpoints

    # 1. Identify which checkpoints need fetching vs already in cache
    needed_queries = []  # list of (index, lat, lon, nearest_hour_iso)
    
    for idx, cp in enumerate(checkpoints):
        eta = cp.get("eta_datetime")
        if not eta:
            cp["forecast_available"] = False
            cp["wind_mph"] = 0.0
            cp["rain_in_hr"] = 0.0
            cp["snow_in_hr"] = 0.0
            continue

        if eta.tzinfo is None:
            eta = eta.replace(tzinfo=timezone.utc)
        else:
            eta = eta.astimezone(timezone.utc)

        # Nearest hour (UTC)
        minute = eta.minute
        hour_offset = 1 if minute >= 30 else 0
        nearest_hour = eta.replace(minute=0, second=0, microsecond=0) + (
            requests.utils.timezone.timedelta(hours=1) if hasattr(requests.utils, "timezone") else __import__("datetime").timedelta(hours=hour_offset)
        )
        nearest_hour_iso = nearest_hour.strftime("%Y-%m-%dT%H:00")
        cp["target_hour_iso"] = nearest_hour_iso

        cache_key = get_cache_key(cp["lat"], cp["lon"], nearest_hour_iso)
        cached_wx = cache.get(cache_key)

        if cached_wx:
            cp["wind_mph"] = cached_wx.get("wind_mph", 0.0)
            cp["rain_in_hr"] = cached_wx.get("rain_in_hr", 0.0)
            cp["snow_in_hr"] = cached_wx.get("snow_in_hr", 0.0)
            cp["forecast_available"] = True
        else:
            needed_queries.append((idx, cp["lat"], cp["lon"], nearest_hour_iso))

    # 2. Batch fetch missing items
    if needed_queries:
        # Group by chunks of BATCH_SIZE
        for i in range(0, len(needed_queries), BATCH_SIZE):
            chunk = needed_queries[i : i + BATCH_SIZE]
            coords = [(q[1], q[2]) for q in chunk]

            api_results = fetch_weather_batch_from_api(coords, forecast_days=3)

            for j, q_item in enumerate(chunk):
                cp_idx, lat, lon, target_hour = q_item
                cp = checkpoints[cp_idx]

                if j < len(api_results) and "hourly" in api_results[j]:
                    hourly = api_results[j]["hourly"]
                    times = hourly.get("time", [])
                    try:
                        time_idx = times.index(target_hour)
                    except ValueError:
                        time_idx = -1

                    if time_idx != -1:
                        wind = float(hourly.get("wind_speed_10m", [0])[time_idx] or 0.0)
                        rain = float(hourly.get("rain", [0])[time_idx] or 0.0)
                        snow = float(hourly.get("snowfall", [0])[time_idx] or 0.0)

                        wx_data = {
                            "wind_mph": wind,
                            "rain_in_hr": rain,
                            "snow_in_hr": snow,
                        }
                        cache_key = get_cache_key(lat, lon, target_hour)
                        cache.set(cache_key, wx_data, CACHE_TTL_SECONDS)

                        cp["wind_mph"] = wind
                        cp["rain_in_hr"] = rain
                        cp["snow_in_hr"] = snow
                        cp["forecast_available"] = True
                        continue

                # Fallback if forecast hour out of range or API failed
                cp["forecast_available"] = False
                cp["wind_mph"] = 0.0
                cp["rain_in_hr"] = 0.0
                cp["snow_in_hr"] = 0.0

    return checkpoints
