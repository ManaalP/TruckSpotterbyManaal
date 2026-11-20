"""Sampling service to place checkpoints along routes and calculate ETAs.

Strictly follows GEMINI.md Section 6:
- Generate checkpoints along route geometry every N miles (10, 25, 50; default 25),
  always including origin and destination.
- ETA at checkpoint = departure time + cumulative driving duration to that point,
  computed from segment duration annotations (fallback to proportional distance * total duration).
- Each checkpoint 'owns' the stretch of road centered on it (midpoint to midpoint).
"""

import math
from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple

EARTH_RADIUS_MILES = 3958.8

def haversine_miles(coord1: Tuple[float, float], coord2: Tuple[float, float]) -> float:
    """
    Great circle distance between two points in miles.
    coord is (lon, lat)
    """
    lon1, lat1 = coord1
    lon2, lat2 = coord2
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_MILES * c


def sample_checkpoints(
    coordinates: List[List[float]],
    durations_annotations: List[float],
    total_duration_seconds: float,
    departure_time: datetime,
    interval_miles: float = 25.0,
    origin_label: str = "Origin",
    destination_label: str = "Destination",
) -> List[Dict[str, Any]]:
    """
    Sample checkpoints along coordinates (lon, lat) at every interval_miles.
    Computes precise cumulative distance, ETA, and owned road stretch length.
    """
    if not coordinates or len(coordinates) < 2:
        return []

    # Calculate cumulative distances and cumulative durations along raw points
    num_coords = len(coordinates)
    cum_dist = [0.0] * num_coords
    for i in range(1, num_coords):
        dist = haversine_miles(
            (coordinates[i - 1][0], coordinates[i - 1][1]),
            (coordinates[i][0], coordinates[i][1]),
        )
        cum_dist[i] = cum_dist[i - 1] + dist

    total_dist = cum_dist[-1]

    # Pre-calculate cumulative durations
    cum_dur = [0.0] * num_coords
    has_annotations = (
        durations_annotations
        and len(durations_annotations) == num_coords - 1
    )
    if has_annotations:
        for i in range(1, num_coords):
            cum_dur[i] = cum_dur[i - 1] + durations_annotations[i - 1]
    else:
        for i in range(1, num_coords):
            if total_dist > 0:
                cum_dur[i] = (cum_dist[i] / total_dist) * total_duration_seconds
            else:
                cum_dur[i] = 0.0

    # Determine sample target miles
    targets = [0.0]
    current = interval_miles
    while current < total_dist - (interval_miles * 0.3):
        targets.append(current)
        current += interval_miles
    if targets[-1] != total_dist:
        targets.append(total_dist)

    checkpoints = []
    coord_idx = 0

    for idx, target_m in enumerate(targets):
        # Find segment spanning target_m
        while coord_idx < num_coords - 1 and cum_dist[coord_idx + 1] < target_m:
            coord_idx += 1

        if coord_idx >= num_coords - 1:
            p_lon, p_lat = coordinates[-1][0], coordinates[-1][1]
            dur_at_p = cum_dur[-1]
        else:
            seg_start_dist = cum_dist[coord_idx]
            seg_end_dist = cum_dist[coord_idx + 1]
            seg_len = seg_end_dist - seg_start_dist

            frac = (target_m - seg_start_dist) / seg_len if seg_len > 0 else 0.0
            p_lon = coordinates[coord_idx][0] + frac * (coordinates[coord_idx + 1][0] - coordinates[coord_idx][0])
            p_lat = coordinates[coord_idx][1] + frac * (coordinates[coord_idx + 1][1] - coordinates[coord_idx][1])

            seg_start_dur = cum_dur[coord_idx]
            seg_end_dur = cum_dur[coord_idx + 1]
            dur_at_p = seg_start_dur + frac * (seg_end_dur - seg_start_dur)

        eta = departure_time + timedelta(seconds=dur_at_p)

        # Labeling
        if idx == 0:
            label = origin_label or "Origin"
        elif idx == len(targets) - 1:
            label = destination_label or "Destination"
        else:
            label = f"Mile {round(target_m)}"

        checkpoints.append({
            "index": idx,
            "mile": round(target_m, 1),
            "lon": round(p_lon, 5),
            "lat": round(p_lat, 5),
            "label": label,
            "eta": eta.isoformat(),
            "eta_datetime": eta,
            "duration_from_origin_s": round(dur_at_p, 1),
            "owned_miles": 0.0,  # Computed below
        })

    # Compute owned road stretch for each checkpoint (midpoint to midpoint)
    n_cp = len(checkpoints)
    if n_cp == 1:
        checkpoints[0]["owned_miles"] = round(total_dist, 1)
    elif n_cp > 1:
        for i in range(n_cp):
            if i == 0:
                # Start to midpoint between 0 and 1
                mid_next = (checkpoints[0]["mile"] + checkpoints[1]["mile"]) / 2.0
                checkpoints[i]["owned_miles"] = round(mid_next, 2)
            elif i == n_cp - 1:
                # Midpoint between n-2 and n-1 to end
                mid_prev = (checkpoints[i - 1]["mile"] + checkpoints[i]["mile"]) / 2.0
                checkpoints[i]["owned_miles"] = round(total_dist - mid_prev, 2)
            else:
                mid_prev = (checkpoints[i - 1]["mile"] + checkpoints[i]["mile"]) / 2.0
                mid_next = (checkpoints[i]["mile"] + checkpoints[i + 1]["mile"]) / 2.0
                checkpoints[i]["owned_miles"] = round(mid_next - mid_prev, 2)

    return checkpoints
