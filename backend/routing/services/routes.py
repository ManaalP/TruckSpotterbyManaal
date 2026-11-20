"""Routing service integrating Mapbox, fast OSRM with response caching, and intelligent corridor fallbacks.
"""

import os
import math
import hashlib
import requests
from typing import List, Dict, Any, Tuple
from django.conf import settings
from django.core.cache import cache
from .sampling import haversine_miles

MAPBOX_DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/driving"
OSRM_DIRECTIONS_URL = "https://router.project-osrm.org/route/v1/driving"
ROUTE_CACHE_TTL = 3600 * 6  # 6 hours

def generate_arc_waypoint(
    origin: Tuple[float, float],
    dest: Tuple[float, float],
    lateral_offset_miles: float,
) -> Tuple[float, float]:
    lon1, lat1 = origin
    lon2, lat2 = dest

    mid_lon = (lon1 + lon2) / 2.0
    mid_lat = (lat1 + lat2) / 2.0

    dlat_per_mile = 1.0 / 69.0
    dlon_per_mile = 1.0 / (69.0 * math.cos(math.radians(mid_lat)))

    dx = (lon2 - lon1) / dlon_per_mile
    dy = (lat2 - lat1) / dlat_per_mile
    hyp = math.hypot(dx, dy)
    if hyp == 0:
        return (mid_lon, mid_lat)

    nx = -dy / hyp
    ny = dx / hyp

    return (
        round(mid_lon + (nx * lateral_offset_miles * dlon_per_mile), 5),
        round(mid_lat + (ny * lateral_offset_miles * dlat_per_mile), 5),
    )


def are_routes_near_identical(coords_a: List[List[float]], coords_b: List[List[float]]) -> bool:
    if not coords_a or not coords_b:
        return False
    sample_size = min(len(coords_a), len(coords_b), 12)
    step_a = max(1, len(coords_a) // sample_size)
    step_b = max(1, len(coords_b) // sample_size)

    total_diff = 0.0
    for i in range(sample_size):
        pt_a = coords_a[min(i * step_a, len(coords_a) - 1)]
        pt_b = coords_b[min(i * step_b, len(coords_b) - 1)]
        diff = haversine_miles((pt_a[0], pt_a[1]), (pt_b[0], pt_b[1]))
        total_diff += diff

    return (total_diff / sample_size) < 2.0


def fetch_osrm_route(
    coords_pairs: List[Tuple[float, float]],
    alternatives: bool = True,
) -> List[Dict[str, Any]]:
    coords_str = ";".join([f"{c[0]:.5f},{c[1]:.5f}" for c in coords_pairs])
    url = f"{OSRM_DIRECTIONS_URL}/{coords_str}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "annotations": "duration,distance",
        "alternatives": "true" if alternatives else "false",
    }
    try:
        resp = requests.get(url, params=params, timeout=3.5, headers={"User-Agent": "SpotterAI/2.0"})
        if resp.status_code == 200:
            return resp.json().get("routes", [])
    except Exception:
        pass
    return []


def generate_fallback_routes(
    origin: Tuple[float, float],
    dest: Tuple[float, float],
) -> List[Dict[str, Any]]:
    lon1, lat1 = origin
    lon2, lat2 = dest
    straight_dist = haversine_miles(origin, dest)

    routes = []
    configs = [
        ("Direct Interstate Route", 0.0, 1.10, 62.0),
        ("Northern Highway Corridor", 45.0, 1.18, 65.0),
        ("Southern Beltway Corridor", -45.0, 1.24, 60.0),
    ]

    for idx, (name, lateral_offset, dist_factor, speed_mph) in enumerate(configs):
        total_dist = straight_dist * dist_factor
        duration_s = (total_dist / speed_mph) * 3600.0

        num_points = 50
        mid = generate_arc_waypoint(origin, dest, lateral_offset)
        coords = []
        for step in range(num_points):
            t = step / float(num_points - 1)
            bx = (1 - t)**2 * lon1 + 2 * (1 - t) * t * mid[0] + t**2 * lon2
            by = (1 - t)**2 * lat1 + 2 * (1 - t) * t * mid[1] + t**2 * lat2
            coords.append([round(bx, 5), round(by, 5)])

        durations = [duration_s / (num_points - 1)] * (num_points - 1)
        distances = [(total_dist * 1609.34) / (num_points - 1)] * (num_points - 1)

        routes.append({
            "id": f"route_{idx + 1}",
            "name": name,
            "geometry": {
                "type": "LineString",
                "coordinates": coords,
            },
            "duration": duration_s,
            "distance": total_dist * 1609.34,
            "legs": [{
                "annotation": {
                    "duration": durations,
                    "distance": distances,
                }
            }],
        })

    return routes


def get_three_routes(
    origin: Tuple[float, float],
    dest: Tuple[float, float],
) -> List[Dict[str, Any]]:
    # Cache key for routing between origin and dest
    cache_key = f"rts_{hashlib.md5(f'{origin[0]:.3f}_{origin[1]:.3f}_{dest[0]:.3f}_{dest[1]:.3f}'.encode()).hexdigest()[:14]}"
    cached_routes = cache.get(cache_key)
    if cached_routes:
        return cached_routes

    token = getattr(settings, "MAPBOX_TOKEN", "") or os.environ.get("MAPBOX_TOKEN", "")
    all_raw_routes = []

    # Mapbox if token configured
    if token and not token.startswith("your_"):
        try:
            url = f"{MAPBOX_DIRECTIONS_URL}/{origin[0]},{origin[1]};{dest[0]},{dest[1]}"
            resp = requests.get(url, params={
                "access_token": token,
                "alternatives": "true",
                "geometries": "geojson",
                "annotations": "duration,distance",
                "overview": "full",
            }, timeout=4)
            if resp.status_code == 200:
                all_raw_routes.extend(resp.json().get("routes", []))
        except Exception:
            pass

    # Free OSRM call
    if len(all_raw_routes) < 3:
        osrm_routes = fetch_osrm_route([origin, dest], alternatives=True)
        all_raw_routes.extend(osrm_routes)

    # De-duplicate
    unique_routes = []
    for r in all_raw_routes:
        geom = r.get("geometry", {}).get("coordinates", [])
        if not geom:
            continue
        if not any(are_routes_near_identical(geom, u.get("geometry", {}).get("coordinates", [])) for u in unique_routes):
            unique_routes.append(r)

    # Fill up to 3 using geometric fallbacks
    if len(unique_routes) < 3:
        fallbacks = generate_fallback_routes(origin, dest)
        for fb in fallbacks:
            if len(unique_routes) >= 3:
                break
            unique_routes.append(fb)

    final_routes = unique_routes[:3]
    for i, r in enumerate(final_routes):
        r["id"] = f"route_{i + 1}"
        if not r.get("name"):
            r["name"] = f"Route Option {i + 1}"

    cache.set(cache_key, final_routes, ROUTE_CACHE_TTL)
    return final_routes
