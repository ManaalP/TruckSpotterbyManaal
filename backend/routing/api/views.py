"""API Views for geocoding, route analysis, and corridor heatmap.

Strictly follows GEMINI.md Section 8:
- Consistent error envelope: { "error": { "code": "...", "message": "...", "fields": {...} } }
- GET /api/geocode?q=
- POST /api/routes/analyze
- POST /api/heatmap
"""

from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from datetime import datetime, timezone

from .serializers import GeocodeQuerySerializer, RouteAnalyzeSerializer, HeatmapSerializer
from ..services.geocoding import geocode_places
from ..services.routes import get_three_routes
from ..services.sampling import sample_checkpoints
from ..services.weather import get_weather_for_checkpoints
from ..services.risk import (
    evaluate_checkpoint_risk,
    LEVEL_LOW,
    LEVEL_MODERATE,
    LEVEL_HIGH,
    LEVEL_SEVERE,
    LEVEL_NO_TRAVEL,
    RISK_ORDER,
)
from ..services.recommend import recommend_routes
from ..services.heatmap import get_heatmap_payload

def error_response(code: str, message: str, fields: dict = None, http_status=status.HTTP_400_BAD_REQUEST):
    return Response(
        {"error": {"code": code, "message": message, "fields": fields or {}}},
        status=http_status,
    )


@api_view(["GET"])
def geocode_view(request):
    """GET /api/geocode?q=..."""
    serializer = GeocodeQuerySerializer(data=request.query_params)
    if not serializer.is_valid():
        return error_response(
            "INVALID_QUERY",
            "Please provide a valid query string with at least 2 characters.",
            serializer.errors,
        )
    q = serializer.validated_data["q"]
    results = geocode_places(q)
    return Response({"results": results})


@api_view(["POST"])
def analyze_routes_view(request):
    """POST /api/routes/analyze"""
    serializer = RouteAnalyzeSerializer(data=request.data)
    if not serializer.is_valid():
        first_err = "Invalid input parameters."
        if serializer.errors:
            field, msgs = next(iter(serializer.errors.items()))
            first_err = f"{field.replace('_', ' ').capitalize()}: {msgs[0]}"
        return error_response(
            "VALIDATION_ERROR",
            first_err,
            serializer.errors,
        )

    data = serializer.validated_data
    origin_str = data["origin"]
    dest_str = data["destination"]
    departure_time = data["departure_time"]
    load_weight_lb = data["load_weight_lb"]
    interval_miles = float(data["interval_miles"])

    # Resolve coordinates for origin and destination
    origin_geo = geocode_places(origin_str, limit=1)
    if not origin_geo:
        return error_response("GEOCODE_NOT_FOUND", f"Could not find coordinates for origin: {origin_str}")

    dest_geo = geocode_places(dest_str, limit=1)
    if not dest_geo:
        return error_response("GEOCODE_NOT_FOUND", f"Could not find coordinates for destination: {dest_str}")

    orig_coord = (origin_geo[0]["lon"], origin_geo[0]["lat"])
    dest_coord = (dest_geo[0]["lon"], dest_geo[0]["lat"])

    # Fetch 3 routes
    raw_routes = get_three_routes(orig_coord, dest_coord)
    processed_routes = []

    for raw_r in raw_routes:
        geom = raw_r.get("geometry", {})
        coords = geom.get("coordinates", [])
        total_duration_s = float(raw_r.get("duration", 0.0))
        total_distance_m = float(raw_r.get("distance", 0.0))
        total_distance_mi = total_distance_m / 1609.34

        legs = raw_r.get("legs", [])
        ann_durations = []
        if legs and "annotation" in legs[0]:
            ann_durations = legs[0]["annotation"].get("duration", [])

        # Sample checkpoints along full geometry
        checkpoints = sample_checkpoints(
            coordinates=coords,
            durations_annotations=ann_durations,
            total_duration_seconds=total_duration_s,
            departure_time=departure_time,
            interval_miles=interval_miles,
            origin_label=origin_geo[0]["label"],
            destination_label=dest_geo[0]["label"],
        )

        # Batch weather enrichment
        get_weather_for_checkpoints(checkpoints, departure_time)

        # Risk scoring for each checkpoint & cumulative metrics
        miles_by_level = {lvl: 0.0 for lvl in RISK_ORDER}
        total_risk_score_weighted = 0.0
        total_owned_miles = 0.0
        worst_level = LEVEL_LOW
        worst_checkpoint = None

        processed_checkpoints = []
        for cp in checkpoints:
            eval_res = evaluate_checkpoint_risk(
                wind_mph=cp.get("wind_mph", 0.0),
                rain_in_hr=cp.get("rain_in_hr", 0.0),
                snow_in_hr=cp.get("snow_in_hr", 0.0),
                load_weight_lb=load_weight_lb,
            )

            lvl = eval_res["final_level"]
            score = eval_res["score"]
            owned_m = cp.get("owned_miles", 0.0)

            miles_by_level[lvl] = round(miles_by_level[lvl] + owned_m, 2)
            total_risk_score_weighted += score * owned_m
            total_owned_miles += owned_m

            cp_data = {
                "index": cp["index"],
                "mile": cp["mile"],
                "lat": cp["lat"],
                "lon": cp["lon"],
                "label": cp["label"],
                "eta": cp["eta"],
                "wind_mph": cp.get("wind_mph", 0.0),
                "rain_in_hr": cp.get("rain_in_hr", 0.0),
                "snow_in_hr": cp.get("snow_in_hr", 0.0),
                "risk_level": lvl,
                "reason": eval_res["reason"],
                "governing_condition": eval_res["governing_condition"],
                "forecast_available": cp.get("forecast_available", True),
                "owned_miles": owned_m,
            }
            processed_checkpoints.append(cp_data)

            if score > evaluate_checkpoint_risk(0, 0, 0, load_weight_lb)["score"] or worst_checkpoint is None:
                if worst_checkpoint is None or score > worst_checkpoint["score"]:
                    worst_checkpoint = {**cp_data, "score": score}

        avg_risk = (
            round(total_risk_score_weighted / total_owned_miles, 2)
            if total_owned_miles > 0
            else 0.0
        )

        arrival_time = (
            processed_checkpoints[-1]["eta"]
            if processed_checkpoints
            else departure_time.isoformat()
        )

        # Build risk segments for map polyline rendering
        segments = []
        for i in range(len(processed_checkpoints) - 1):
            cp_curr = processed_checkpoints[i]
            cp_next = processed_checkpoints[i + 1]
            segments.append({
                "from_index": cp_curr["index"],
                "to_index": cp_next["index"],
                "risk_level": cp_curr["risk_level"],
                "coordinates": [
                    [cp_curr["lon"], cp_curr["lat"]],
                    [cp_next["lon"], cp_next["lat"]],
                ],
            })

        processed_routes.append({
            "id": raw_r["id"],
            "name": raw_r.get("name", "Route"),
            "geometry": geom,
            "summary": {
                "distance_miles": round(total_distance_mi, 1),
                "duration_seconds": round(total_duration_s),
                "arrival_time": arrival_time,
                "miles_by_level": miles_by_level,
                "average_risk": avg_risk,
                "worst_level": worst_checkpoint["risk_level"] if worst_checkpoint else LEVEL_LOW,
                "worst_checkpoint": worst_checkpoint,
            },
            "checkpoints": processed_checkpoints,
            "segments": segments,
        })

    recommendation = recommend_routes(processed_routes)

    return Response({
        "origin": origin_geo[0],
        "destination": dest_geo[0],
        "departure_time": departure_time.isoformat(),
        "load_weight_lb": load_weight_lb,
        "interval_miles": interval_miles,
        "routes": processed_routes,
        "recommendation": recommendation,
    })


@api_view(["POST"])
def heatmap_view(request):
    """POST /api/heatmap"""
    serializer = HeatmapSerializer(data=request.data)
    if not serializer.is_valid():
        return error_response(
            "VALIDATION_ERROR",
            "Invalid heatmap parameters.",
            serializer.errors,
        )

    data = serializer.validated_data
    routes_coords = data.get("routes_coordinates", [])
    load_weight_lb = data.get("load_weight_lb", 35000.0)
    start_time = data.get("start_time") or datetime.now(timezone.utc)

    payload = get_heatmap_payload(
        routes_coordinates=routes_coords,
        load_weight_lb=load_weight_lb,
        start_time=start_time,
    )
    return Response(payload)
