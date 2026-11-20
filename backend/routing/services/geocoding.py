"""Geocoding service using Mapbox Geocoding API with robust fallback.
"""

import os
import requests
from typing import List, Dict, Any
from django.conf import settings

MAPBOX_GEOCODING_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places"

def geocode_places(query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Search places using Mapbox Geocoding API.
    Returns list of dicts: [{'label': str, 'lat': float, 'lon': float}].
    """
    q = (query or "").strip()
    if not q or len(q) < 2:
        return []

    token = getattr(settings, "MAPBOX_TOKEN", "") or os.environ.get("MAPBOX_TOKEN", "")
    
    # If token is provided, call Mapbox Geocoding
    if token and not token.startswith("your_"):
        try:
            url = f"{MAPBOX_GEOCODING_URL}/{requests.utils.quote(q)}.json"
            params = {
                "access_token": token,
                "autocomplete": "true",
                "types": "place,locality,postcode,address",
                "limit": limit,
            }
            resp = requests.get(url, params=params, timeout=5)
            if resp.status_code == 200:
                data = resp.json()
                results = []
                for feat in data.get("features", []):
                    coords = feat.get("center", [])
                    if len(coords) >= 2:
                        results.append({
                            "label": feat.get("place_name", q),
                            "lon": float(coords[0]),
                            "lat": float(coords[1]),
                        })
                if results:
                    return results
        except Exception:
            pass  # Fall through to fallback or empty

    # Fallback / Demo geocoder for major cities (ensures app works offline or without token)
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
    ]

    q_lower = q.lower()
    matches = [p for p in known_places if q_lower in p["label"].lower()]
    if matches:
        return matches[:limit]

    # If coordinates entered directly as "lat, lon"
    parts = [p.strip() for p in q.split(",")]
    if len(parts) == 2:
        try:
            lat = float(parts[0])
            lon = float(parts[1])
            return [{"label": f"{lat:.4f}, {lon:.4f}", "lat": lat, "lon": lon}]
        except ValueError:
            pass

    return []
