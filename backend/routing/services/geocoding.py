"""Geocoding service using Mapbox Geocoding API, Photon/OSM geocoder (no key required), and fallback.
Provides comprehensive suggestions as the user types.
"""

import os
import hashlib
import requests
from typing import List, Dict, Any
from django.conf import settings
from django.core.cache import cache

MAPBOX_GEOCODING_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places"
PHOTON_GEOCODING_URL = "https://photon.komoot.io/api"
GEOCODE_CACHE_TTL = 3600  # 1 hour

def safe_cache_key(prefix: str, text: str) -> str:
    """Generate safe memcached/locmem cache key without spaces or colons."""
    hashed = hashlib.md5(text.strip().lower().encode("utf-8")).hexdigest()
    return f"{prefix}_{hashed}"

def geocode_places(query: str, limit: int = 6) -> List[Dict[str, Any]]:
    """
    Search places using:
    1. Cache
    2. Mapbox Geocoding API (if MAPBOX_TOKEN configured)
    3. Photon (OpenStreetMap) live geocoder (free, no token needed)
    4. Extensive fallback list of US cities and logistics hubs
    """
    q = (query or "").strip()
    if not q or len(q) < 2:
        return []

    cache_key = safe_cache_key("geo", f"{q}_{limit}")
    cached_val = cache.get(cache_key)
    if cached_val:
        return cached_val

    results = []

    # 1. Mapbox Geocoding if configured
    token = getattr(settings, "MAPBOX_TOKEN", "") or os.environ.get("MAPBOX_TOKEN", "")
    if token and not token.startswith("your_"):
        try:
            url = f"{MAPBOX_GEOCODING_URL}/{requests.utils.quote(q)}.json"
            params = {
                "access_token": token,
                "autocomplete": "true",
                "types": "place,locality,postcode,address",
                "limit": limit,
            }
            resp = requests.get(url, params=params, timeout=4)
            if resp.status_code == 200:
                data = resp.json()
                for feat in data.get("features", []):
                    coords = feat.get("center", [])
                    if len(coords) >= 2:
                        results.append({
                            "label": feat.get("place_name", q),
                            "lon": round(float(coords[0]), 5),
                            "lat": round(float(coords[1]), 5),
                        })
                if results:
                    cache.set(cache_key, results, GEOCODE_CACHE_TTL)
                    return results
        except Exception:
            pass

    # 2. Free live Geocoding via Photon (OSM)
    try:
        resp = requests.get(
            PHOTON_GEOCODING_URL,
            params={"q": q, "limit": limit, "lang": "en"},
            timeout=3,
            headers={"User-Agent": "SpotterAITruckRouting/1.0"}
        )
        if resp.status_code == 200:
            data = resp.json()
            for feat in data.get("features", []):
                coords = feat.get("geometry", {}).get("coordinates", [])
                props = feat.get("properties", {})
                if len(coords) >= 2:
                    name_parts = [
                        props.get("name"),
                        props.get("city"),
                        props.get("state"),
                        props.get("country"),
                    ]
                    filtered_parts = [p for p in name_parts if p]
                    label = ", ".join(dict.fromkeys(filtered_parts)) or props.get("name") or q
                    results.append({
                        "label": label,
                        "lon": round(float(coords[0]), 5),
                        "lat": round(float(coords[1]), 5),
                    })
            if results:
                # Deduplicate by label
                unique_res = []
                seen_lbl = set()
                for r in results:
                    if r["label"] not in seen_lbl:
                        seen_lbl.add(r["label"])
                        unique_res.append(r)
                cache.set(cache_key, unique_res[:limit], GEOCODE_CACHE_TTL)
                return unique_res[:limit]
    except Exception:
        pass

    # 3. Comprehensive built-in catalog for US freight corridors
    known_places = [
        {"label": "Chicago, Illinois, United States", "lat": 41.8781, "lon": -87.6298},
        {"label": "Denver, Colorado, United States", "lat": 39.7392, "lon": -104.9903},
        {"label": "Dallas, Texas, United States", "lat": 32.7767, "lon": -96.7970},
        {"label": "Atlanta, Georgia, United States", "lat": 33.7490, "lon": -84.3880},
        {"label": "New York, New York, United States", "lat": 40.7128, "lon": -74.0060},
        {"label": "Los Angeles, California, United States", "lat": 34.0522, "lon": -118.2437},
        {"label": "Seattle, Washington, United States", "lat": 47.6062, "lon": -122.3321},
        {"label": "Miami, Florida, United States", "lat": 25.7617, "lon": -80.1918},
        {"label": "Kansas City, Missouri, United States", "lat": 39.0997, "lon": -94.5786},
        {"label": "St. Louis, Missouri, United States", "lat": 38.6270, "lon": -90.1994},
        {"label": "Minneapolis, Minnesota, United States", "lat": 44.9778, "lon": -93.2650},
        {"label": "Salt Lake City, Utah, United States", "lat": 40.7608, "lon": -111.8910},
        {"label": "Phoenix, Arizona, United States", "lat": 33.4484, "lon": -112.0740},
        {"label": "Indianapolis, Indiana, United States", "lat": 39.7684, "lon": -86.1581},
        {"label": "Omaha, Nebraska, United States", "lat": 41.2565, "lon": -95.9345},
        {"label": "Houston, Texas, United States", "lat": 29.7604, "lon": -95.3698},
        {"label": "Detroit, Michigan, United States", "lat": 42.3314, "lon": -83.0458},
        {"label": "Memphis, Tennessee, United States", "lat": 35.1495, "lon": -90.0490},
        {"label": "Nashville, Tennessee, United States", "lat": 36.1627, "lon": -86.7816},
        {"label": "Louisville, Kentucky, United States", "lat": 38.2527, "lon": -85.7585},
        {"label": "Columbus, Ohio, United States", "lat": 39.9612, "lon": -82.9988},
        {"label": "Charlotte, North Carolina, United States", "lat": 35.2271, "lon": -80.8431},
        {"label": "Philadelphia, Pennsylvania, United States", "lat": 39.9526, "lon": -75.1652},
        {"label": "Pittsburgh, Pennsylvania, United States", "lat": 40.4406, "lon": -79.9959},
        {"label": "Cleveland, Ohio, United States", "lat": 41.4993, "lon": -81.6944},
        {"label": "Des Moines, Iowa, United States", "lat": 41.5868, "lon": -93.6250},
        {"label": "Oklahoma City, Oklahoma, United States", "lat": 35.4676, "lon": -97.5164},
        {"label": "Albuquerque, New Mexico, United States", "lat": 35.0844, "lon": -106.6504},
        {"label": "Las Vegas, Nevada, United States", "lat": 36.1699, "lon": -115.1398},
        {"label": "Portland, Oregon, United States", "lat": 45.5152, "lon": -122.6784},
        {"label": "San Francisco, California, United States", "lat": 37.7749, "lon": -122.4194},
        {"label": "San Antonio, Texas, United States", "lat": 29.4241, "lon": -98.4936},
    ]

    q_lower = q.lower()
    matches = [p for p in known_places if q_lower in p["label"].lower()]
    if matches:
        cache.set(cache_key, matches[:limit], GEOCODE_CACHE_TTL)
        return matches[:limit]

    # Direct coordinate input check: "lat, lon"
    parts = [p.strip() for p in q.split(",")]
    if len(parts) == 2:
        try:
            lat = float(parts[0])
            lon = float(parts[1])
            res = [{"label": f"{lat:.4f}, {lon:.4f}", "lat": lat, "lon": lon}]
            cache.set(cache_key, res, GEOCODE_CACHE_TTL)
            return res
        except ValueError:
            pass

    return []
