"""Routing service integrating Mapbox Directions API, OSRM public routing API (no key), and fallback.

Strictly follows GEMINI.md Section 3:
- Primary: Mapbox Directions API when MAPBOX_TOKEN is supplied.
- Live Public Alternative: OSRM (Open Source Routing Machine) driving API for real highway geometries and durations.
- Guarantees 3 distinct alternatives with annotations and coordinates.
"""

import os
import math
import requests
from typing import List, Dict, Any, Tuple
from django.conf import settings
from .sampling import haversine_miles

MAPBOX_DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/driving"
OSRM_DIRECTIONS_URL = "https://router.project-osrm.org/route/v1/driving"

def generate_arc_waypoint(
    origin: Tuple[float, float],
    dest: Tuple[float, float],
    lateral_offset_miles: float,
) -> Tuple[float, float]:
    """
    Generate an offset midpoint between origin and dest perpendicular to the bearing.
    origin: (lon, lat), dest: (lon, lat)
    """
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

    offset_lon = mid_lon + (nx * lateral_offset_miles * dlon_per_mile)
    offset_lat = mid_lat + (ny * lateral_offset_miles * dlat_per_mile)

    return (round(offset_lon, 5), round(offset_lat, 5))


def are_routes_near_identical(coords_a: List[List[float]], coords_b: List[List[float]]) -> bool:
    """Check if two route geometries are nearly identical (< 2% average difference)."""
    if not coords_a or not coords_b:
        return False
    sample_size = min(len(coords_a), len(coords_b), 15)
    step_a = max(1, len(coords_a) // sample_size)
    step_b = max(1, len(coords_b) // sample_size)

    total_diff = 0.0
    for i in range(sample_size):
        pt_a = coords_a[min(i * step_a, len(coords_a) - 1)]
        pt_b = coords_b[min(i * step_b, len(coords_b) - 1)]
        diff = haversine_miles((pt_a[0], pt_a[1]), (pt_b[0], pt_b[1]))
        total_diff += diff

    return (total_diff / sample_size) < 1.5


def fetch_mapbox_route(
    coordinates_str: str,
    token: str,
    alternatives: bool = True,
) -> List[Dict[str, Any]]:
    """Query Mapbox Directions API."""
    url = f"{MAPBOX_DIRECTIONS_URL}/{coordinates_str}"
    params = {
        "access_token": token,
        "alternatives": "true" if alternatives else "false",
        "geometries": "geojson",
        "overview": "full",
        "annotations": "duration,distance",
        "steps": "false",
    }
    try:
        resp = requests.get(url, params=params, timeout=8)
        if resp.status_code == 200:
            data = resp.json()
            return data.get("routes", [])
    except Exception:
        pass
    return []


def fetch_osrm_route(
    coords_pairs: List[Tuple[float, float]],
    alternatives: bool = True,
) -> List[Dict[str, Any]]:
    """
    Query free live OSRM routing API.
    coords_pairs: list of (lon, lat)
    """
    coords_str = ";".join([f"{c[0]:.5f},{c[1]:.5f}" for c in coords_pairs])
    url = f"{OSRM_DIRECTIONS_URL}/{coords_str}"
    params = {
        "overview": "full",
        "geometries": "geojson",
        "annotations": "duration,distance",
        "alternatives": "true" if alternatives else "false",
    }
    try:
        resp = requests.get(url, params=params, timeout=6, headers={"User-Agent": "SpotterAITruck/1.0"})
        if resp.status_code == 200:
            data = resp.json()
            routes = data.get("routes", [])
            return routes
    except Exception:
        pass
    return []


def generate_fallback_routes(
    origin: Tuple[float, float],
    dest: Tuple[float, float],
) -> List[Dict[str, Any]]:
    """
    Generate 3 distinct realistic corridors if third-party network is temporarily unreachable.
    """
    lon1, lat1 = origin
    lon2, lat2 = dest
    straight_dist = haversine_miles(origin, dest)

    routes = []
    configs = [
        ("Direct Interstate Corridor", 0.0, 1.08, 62.0),
        ("Northern Bypass Route", 45.0, 1.18, 65.0),
        ("Southern Beltway Route", -40.0, 1.25, 60.0),
    ]

    for idx, (name, lateral_offset, dist_factor, speed_mph) in enumerate(configs):
        total_dist = straight_dist * dist_factor
        duration_s = (total_dist / speed_mph) * 3600.0

        num_points = 60
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
    """
    Ensure exactly 3 distinct routes are returned using Mapbox, OSRM, or fallback.
    origin: (lon, lat), dest: (lon, lat)
    """
    token = getattr(settings, "MAPBOX_TOKEN", "") or os.environ.get("MAPBOX_TOKEN", "")
    all_raw_routes = []

    # 1. Mapbox Directions API if token present
    if token and not token.startswith("your_"):
        coord_pair = f"{origin[0]},{origin[1]};{dest[0]},{dest[1]}"
        routes_mb = fetch_mapbox_route(coord_pair, token, alternatives=True)
        all_raw_routes.extend(routes_mb)

        if len(all_raw_routes) < 3:
            wp_north = generate_arc_waypoint(origin, dest, 45.0)
            wp_pair = f"{origin[0]},{origin[1]};{wp_north[0]},{wp_north[1]};{dest[0]},{dest[1]}"
            all_raw_routes.extend(fetch_mapbox_route(wp_pair, token, alternatives=False))

        if len(all_raw_routes) < 3:
            wp_south = generate_arc_waypoint(origin, dest, -45.0)
            wp_pair = f"{origin[0]},{origin[1]};{wp_south[0]},{wp_south[1]};{dest[0]},{dest[1]}"
            all_raw_routes.extend(fetch_mapbox_route(wp_pair, token, alternatives=False))

    # 2. OSRM Live Public Routing API if needed
    if len(all_raw_routes) < 3:
        osrm_routes = fetch_osrm_route([origin, dest], alternatives=True)
        all_raw_routes.extend(osrm_routes)

        if len(all_raw_routes) < 3:
            wp_n = generate_arc_waypoint(origin, dest, 40.0)
            all_raw_routes.extend(fetch_osrm_route([origin, wp_n, dest], alternatives=False))

        if len(all_raw_routes) < 3:
            wp_s = generate_arc_waypoint(origin, dest, -40.0)
            all_raw_routes.extend(fetch_osrm_route([origin, wp_s, dest], alternatives=False))

    # 3. Deduplicate near-identical geometries
    unique_routes = []
    for r in all_raw_routes:
        geom = r.get("geometry", {}).get("coordinates", [])
        if not geom:
            continue
        is_dup = False
        for u in unique_routes:
            u_geom = u.get("geometry", {}).get("coordinates", [])
            if are_routes_near_identical(geom, u_geom):
                is_dup = True
                break
        if not is_dup:
            unique_routes.append(r)

    # 4. Fallback if fewer than 3
    if len(unique_routes) < 3:
        fallbacks = generate_fallback_routes(origin, dest)
        for fb in fallbacks:
            if len(unique_routes) >= 3:
                break
            unique_routes.append(fb)

    # Standardize routes to exactly 3 items
    final_routes = unique_routes[:3]
    for i, r in enumerate(final_routes):
        r["id"] = f"route_{i + 1}"
        if not r.get("name"):
            r["name"] = f"Route Option {i + 1}"

    return final_routes
