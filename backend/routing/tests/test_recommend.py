import pytest
from routing.services.recommend import (
    recommend_routes,
    get_route_sort_key,
    build_recommendation_reason,
)
from routing.services.risk import (
    LEVEL_LOW,
    LEVEL_MODERATE,
    LEVEL_HIGH,
    LEVEL_SEVERE,
    LEVEL_NO_TRAVEL,
)

def make_route(route_id, no_travel=0, severe=0, high=0, avg_risk=0.5, duration_s=3600):
    return {
        "id": route_id,
        "summary": {
            "miles_by_level": {
                LEVEL_LOW: 100.0,
                LEVEL_MODERATE: 20.0,
                LEVEL_HIGH: float(high),
                LEVEL_SEVERE: float(severe),
                LEVEL_NO_TRAVEL: float(no_travel),
            },
            "average_risk": float(avg_risk),
            "duration_seconds": float(duration_s),
            "distance_miles": 120.0,
        },
    }

def test_tie_break_rule1_no_travel_miles():
    # Route 1 has 5 miles No Travel, Route 2 has 0 miles No Travel (even if longer duration)
    r1 = make_route("route_1", no_travel=5, duration_s=3000)
    r2 = make_route("route_2", no_travel=0, duration_s=4000)

    result = recommend_routes([r1, r2])
    assert result["route_id"] == "route_2"
    assert result["ranking"] == ["route_2", "route_1"]
    assert "impassable" in result["reason"].lower() or "no travel" in result["reason"].lower()
    assert result["all_routes_blocked"] is False


def test_tie_break_rule2_severe_miles():
    # Both 0 No Travel, Route 1 has 20 Severe, Route 2 has 0 Severe
    r1 = make_route("route_1", severe=20, duration_s=3000)
    r2 = make_route("route_2", severe=0, duration_s=3600)

    result = recommend_routes([r1, r2])
    assert result["route_id"] == "route_2"
    assert "severe" in result["reason"].lower()


def test_tie_break_rule3_high_miles():
    # Both 0 NT, 0 Severe; Route 1 has 15 High, Route 2 has 5 High
    r1 = make_route("route_1", high=15, duration_s=3000)
    r2 = make_route("route_2", high=5, duration_s=3500)

    result = recommend_routes([r1, r2])
    assert result["route_id"] == "route_2"
    assert "high-risk" in result["reason"].lower()


def test_tie_break_rule4_average_risk():
    # Both equal miles by level, but Route 2 has lower avg risk
    r1 = make_route("route_1", avg_risk=1.45, duration_s=3000)
    r2 = make_route("route_2", avg_risk=1.10, duration_s=3500)

    result = recommend_routes([r1, r2])
    assert result["route_id"] == "route_2"
    assert "risk index" in result["reason"].lower()


def test_tie_break_rule5_duration():
    # Identical risk profiles, Route 1 is faster
    r1 = make_route("route_1", duration_s=3600)
    r2 = make_route("route_2", duration_s=4200)

    result = recommend_routes([r1, r2])
    assert result["route_id"] == "route_1"
    assert "faster" in result["reason"].lower()


def test_all_routes_blocked():
    # All routes have No Travel miles
    r1 = make_route("route_1", no_travel=10, duration_s=3000)
    r2 = make_route("route_2", no_travel=2, duration_s=3600)

    result = recommend_routes([r1, r2])
    assert result["route_id"] == "route_2"
    assert result["all_routes_blocked"] is True
    assert "WARNING" in result["reason"]
