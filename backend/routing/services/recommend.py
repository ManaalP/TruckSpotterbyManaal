"""Pure functions for route ranking, scoring, and recommendation.

Strictly follows GEMINI.md Section 7:
Rank routes by this sort key (lower is better), in this order:
1. No Travel miles (a route with any No Travel miles is never recommended over one without)
2. Severe miles (fewest)
3. High miles (fewest)
4. Average risk (lowest)
5. Duration (shortest)

Return ranking, winner, plain-language reason built from the first rule that separated
the winner from the runner-up. If every route has No Travel miles, return all_routes_blocked: true.
"""

from typing import List, Dict, Any, Tuple
from .risk import LEVEL_NO_TRAVEL, LEVEL_SEVERE, LEVEL_HIGH, LEVEL_MODERATE, LEVEL_LOW

def format_duration_diff(seconds_diff: float) -> str:
    """Format duration difference into human-readable string (e.g. '1 h 10 m')."""
    total_minutes = round(abs(seconds_diff) / 60)
    hours = total_minutes // 60
    minutes = total_minutes % 60
    if hours > 0 and minutes > 0:
        return f"{hours} h {minutes} m"
    if hours > 0:
        return f"{hours} h"
    return f"{minutes} m"


def get_route_sort_key(route: Dict[str, Any]) -> Tuple[float, float, float, float, float]:
    """
    Returns the sort key tuple for route ranking (lower is better):
    (no_travel_miles, severe_miles, high_miles, average_risk, duration_seconds)
    """
    summary = route.get("summary", {})
    miles_by_level = summary.get("miles_by_level", {})

    no_travel = float(miles_by_level.get(LEVEL_NO_TRAVEL, 0.0))
    severe = float(miles_by_level.get(LEVEL_SEVERE, 0.0))
    high = float(miles_by_level.get(LEVEL_HIGH, 0.0))
    avg_risk = float(summary.get("average_risk", 0.0))
    duration = float(summary.get("duration_seconds", 0.0))

    return (no_travel, severe, high, avg_risk, duration)


def build_recommendation_reason(winner: Dict[str, Any], runner_up: Dict[str, Any]) -> str:
    """
    Build a plain-language reason built from the first rule that actually
    separated the winner from the runner-up.
    """
    win_summary = winner.get("summary", {})
    run_summary = runner_up.get("summary", {})

    win_miles = win_summary.get("miles_by_level", {})
    run_miles = run_summary.get("miles_by_level", {})

    win_nt = float(win_miles.get(LEVEL_NO_TRAVEL, 0.0))
    run_nt = float(run_miles.get(LEVEL_NO_TRAVEL, 0.0))

    win_dur = float(win_summary.get("duration_seconds", 0.0))
    run_dur = float(run_summary.get("duration_seconds", 0.0))
    dur_diff = win_dur - run_dur

    time_relation = ""
    if abs(dur_diff) >= 60:
        time_str = format_duration_diff(dur_diff)
        if dur_diff < 0:
            time_relation = f" and {time_str} faster than alternative"
        else:
            time_relation = f" and {time_str} longer than alternative"

    # Rule 1: No Travel miles
    if win_nt < run_nt:
        return (
            f"Avoids hazardous impassable conditions ({win_nt:.0f} vs {run_nt:.0f} mi No Travel){time_relation}."
        )

    # Rule 2: Severe miles
    win_sev = float(win_miles.get(LEVEL_SEVERE, 0.0))
    run_sev = float(run_miles.get(LEVEL_SEVERE, 0.0))
    if win_sev < run_sev:
        return (
            f"Significantly fewer severe weather miles ({win_sev:.0f} vs {run_sev:.0f} mi){time_relation}."
        )

    # Rule 3: High miles
    win_high = float(win_miles.get(LEVEL_HIGH, 0.0))
    run_high = float(run_miles.get(LEVEL_HIGH, 0.0))
    if win_high < run_high:
        return (
            f"Fewer high-risk weather miles ({win_high:.0f} vs {run_high:.0f} mi){time_relation}."
        )

    # Rule 4: Average risk
    win_avg = float(win_summary.get("average_risk", 0.0))
    run_avg = float(run_summary.get("average_risk", 0.0))
    if win_avg < run_avg:
        return (
            f"Lower overall weather risk index ({win_avg:.2f} vs {run_avg:.2f}){time_relation}."
        )

    # Rule 5: Duration
    if win_dur < run_dur:
        time_str = format_duration_diff(dur_diff)
        return f"Fastest route with equivalent weather risk profile ({time_str} faster)."

    return "Best balanced route for safety and travel time."


def recommend_routes(routes: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Ranks routes and generates the recommendation payload.
    """
    if not routes:
        return {
            "route_id": None,
            "reason": "No routes available to evaluate.",
            "ranking": [],
            "all_routes_blocked": False,
        }

    # Sort routes by key
    ranked_routes = sorted(routes, key=get_route_sort_key)
    ranking_ids = [r["id"] for r in ranked_routes]

    winner = ranked_routes[0]
    all_blocked = all(
        float(r.get("summary", {}).get("miles_by_level", {}).get(LEVEL_NO_TRAVEL, 0.0)) > 0
        for r in routes
    )

    if len(ranked_routes) > 1:
        reason = build_recommendation_reason(winner, ranked_routes[1])
    else:
        reason = "Only viable route option available."

    if all_blocked:
        reason = (
            f"WARNING: All routes contain hazardous No Travel conditions. "
            f"Route {winner.get('id')} selected as least hazardous ({reason})"
        )

    return {
        "route_id": winner.get("id"),
        "reason": reason,
        "ranking": ranking_ids,
        "all_routes_blocked": all_blocked,
    }
