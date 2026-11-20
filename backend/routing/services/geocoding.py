"""Geocoding service: ultra-fast local freight hub catalog + live Photon fallback with memory caching.
"""

import os
import hashlib
import requests
from typing import List, Dict, Any
from django.conf import settings
from django.core.cache import cache

PHOTON_GEOCODING_URL = "https://photon.komoot.io/api"
GEOCODE_CACHE_TTL = 86400  # 24 hours

# Comprehensive instant local database of key US commercial freight hubs, states, and major cities
FREIGHT_HUBS = [
    {"label": "Chicago, Illinois, United States", "lat": 41.8781, "lon": -87.6298},
    {"label": "Denver, Colorado, United States", "lat": 39.7392, "lon": -104.9903},
    {"label": "Dallas, Texas, United States", "lat": 32.7767, "lon": -96.7970},
    {"label": "Fort Worth, Texas, United States", "lat": 32.7555, "lon": -97.3308},
    {"label": "Atlanta, Georgia, United States", "lat": 33.7490, "lon": -84.3880},
    {"label": "New York, New York, United States", "lat": 40.7128, "lon": -74.0060},
    {"label": "Los Angeles, California, United States", "lat": 34.0522, "lon": -118.2437},
    {"label": "Long Beach, California, United States", "lat": 33.7701, "lon": -118.1937},
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
    {"label": "Austin, Texas, United States", "lat": 30.2672, "lon": -97.7431},
    {"label": "Jacksonville, Florida, United States", "lat": 30.3322, "lon": -81.6557},
    {"label": "Tampa, Florida, United States", "lat": 27.9506, "lon": -82.4572},
    {"label": "Orlando, Florida, United States", "lat": 28.5383, "lon": -81.3792},
    {"label": "New Orleans, Louisiana, United States", "lon": -90.0715, "lat": 29.9511},
    {"label": "Baton Rouge, Louisiana, United States", "lon": -91.1871, "lat": 30.4515},
    {"label": "Milwaukee, Wisconsin, United States", "lat": 43.0389, "lon": -87.9065},
    {"label": "Boston, Massachusetts, United States", "lat": 42.3601, "lon": -71.0589},
    {"label": "Baltimore, Maryland, United States", "lat": 39.2904, "lon": -76.6122},
    {"label": "Washington, District of Columbia, United States", "lat": 38.9072, "lon": -77.0369},
    {"label": "Richmond, Virginia, United States", "lat": 37.5407, "lon": -77.4360},
    {"label": "Norfolk, Virginia, United States", "lat": 36.8508, "lon": -76.2859},
    {"label": "Cincinnati, Ohio, United States", "lat": 39.1031, "lon": -84.5120},
    {"label": "Buffalo, New York, United States", "lat": 42.8864, "lon": -78.8784},
    {"label": "Cheyenne, Wyoming, United States", "lat": 41.1400, "lon": -104.8202},
    {"label": "Boise, Idaho, United States", "lat": 43.6150, "lon": -116.2023},
    {"label": "Billings, Montana, United States", "lat": 45.7833, "lon": -108.5007},
    {"label": "Fargo, North Dakota, United States", "lat": 46.8772, "lon": -96.7898},
    {"label": "Sioux Falls, South Dakota, United States", "lat": 43.5460, "lon": -96.7313},
    {"label": "Wichita, Kansas, United States", "lat": 37.6872, "lon": -97.3301},
    {"label": "Little Rock, Arkansas, United States", "lat": 34.7465, "lon": -92.2896},
    {"label": "Birmingham, Alabama, United States", "lat": 33.5186, "lon": -86.8104},
    {"label": "Mobile, Alabama, United States", "lat": 30.6954, "lon": -88.0399},
    {"label": "Savannah, Georgia, United States", "lat": 32.0809, "lon": -81.0912},
    {"label": "El Paso, Texas, United States", "lat": 31.7619, "lon": -106.4850},
    {"label": "Tucson, Arizona, United States", "lat": 32.2226, "lon": -110.9747},
    {"label": "Sacramento, California, United States", "lat": 38.5816, "lon": -121.4944},
    {"label": "Reno, Nevada, United States", "lat": 39.5296, "lon": -119.8138},
]

def geocode_places(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Returns instant geocode suggestions matching user query.
    1. Instant substring/prefix match against FREIGHT_HUBS (0 ms latency).
    2. Cache lookup.
    3. Live fallback query if not in local hubs.
    """
    q = (query or "").strip()
    if not q or len(q) < 2:
        return []

    q_lower = q.lower()

    # 1. Instant local search (handles 95% of typical freight cities immediately)
    local_matches = []
    # Exact start match first
    for hub in FREIGHT_HUBS:
        if hub["label"].lower().startswith(q_lower):
            local_matches.append(hub)
    # Substring match second
    for hub in FREIGHT_HUBS:
        if q_lower in hub["label"].lower() and hub not in local_matches:
            local_matches.append(hub)

    if len(local_matches) >= limit:
        return local_matches[:limit]

    # 2. Check cache
    cache_key = f"ghub_{hashlib.md5(q_lower.encode()).hexdigest()[:12]}_{limit}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached

    results = list(local_matches)

    # 3. Fast external lookup
    try:
        resp = requests.get(
            PHOTON_GEOCODING_URL,
            params={"q": q, "limit": limit, "lang": "en"},
            timeout=2.0,
            headers={"User-Agent": "SpotterAI/2.0"}
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
                    item = {
                        "label": label,
                        "lon": round(float(coords[0]), 5),
                        "lat": round(float(coords[1]), 5),
                    }
                    if not any(r["label"] == label for r in results):
                        results.append(item)
    except Exception:
        pass

    final_results = results[:limit]
    cache.set(cache_key, final_results, GEOCODE_CACHE_TTL)
    return final_results
