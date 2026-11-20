"""Pure functions for weather risk classification and truck load rules.

Strictly follows GEMINI.md Section 5:
Level | Wind (mph) | Rain (in/hr) | Snow (in/hr)
Low:      < 25          < 0.10         < 0.5
Moderate: 25 to < 35    0.10 to < 0.25 0.5 to < 1.0
High:     35 to < 45    0.25 to < 0.50 1.0 to < 2.0
Severe:   45 to < 55    0.50 to 1.00   2.0 to 3.0
No Travel: >= 55        > 1.00         > 3.0

Boundaries are lower-bound inclusive.
Checkpoint risk = worst level among wind, rain, snow.
Load rules:
- Wind >= 55 mph: No Travel for any load.
- Wind 45-54 mph and load > 30,000 lb: No Travel.
- Wind 35-44 mph and load > 40,000 lb: Severe (upgrade if lower).
"""

from typing import Dict, Any, Tuple

# Risk Levels & Numeric scale for averages
LEVEL_LOW = "Low"
LEVEL_MODERATE = "Moderate"
LEVEL_HIGH = "High"
LEVEL_SEVERE = "Severe"
LEVEL_NO_TRAVEL = "No Travel"

RISK_ORDER = [LEVEL_LOW, LEVEL_MODERATE, LEVEL_HIGH, LEVEL_SEVERE, LEVEL_NO_TRAVEL]
RISK_SCORES = {
    LEVEL_LOW: 0,
    LEVEL_MODERATE: 1,
    LEVEL_HIGH: 2,
    LEVEL_SEVERE: 3,
    LEVEL_NO_TRAVEL: 4,
}

# Wind thresholds (mph) - lower-bound inclusive
WIND_MODERATE_MIN = 25.0
WIND_HIGH_MIN = 35.0
WIND_SEVERE_MIN = 45.0
WIND_NO_TRAVEL_MIN = 55.0

# Rain thresholds (in/hr) - lower-bound inclusive
RAIN_MODERATE_MIN = 0.10
RAIN_HIGH_MIN = 0.25
RAIN_SEVERE_MIN = 0.50
RAIN_NO_TRAVEL_MIN = 1.00  # > 1.00 is No Travel, 0.50 to 1.00 is Severe

# Snow thresholds (in/hr) - lower-bound inclusive
SNOW_MODERATE_MIN = 0.5
SNOW_HIGH_MIN = 1.0
SNOW_SEVERE_MIN = 2.0
SNOW_NO_TRAVEL_MIN = 3.0   # > 3.0 is No Travel, 2.0 to 3.0 is Severe

# Truck load weight thresholds (lb)
LOAD_WEIGHT_THRESHOLD_30K = 30000.0
LOAD_WEIGHT_THRESHOLD_40K = 40000.0


def classify_wind(wind_mph: float) -> str:
    """Classify wind speed (mph) into risk level."""
    if wind_mph >= WIND_NO_TRAVEL_MIN:
        return LEVEL_NO_TRAVEL
    if wind_mph >= WIND_SEVERE_MIN:
        return LEVEL_SEVERE
    if wind_mph >= WIND_HIGH_MIN:
        return LEVEL_HIGH
    if wind_mph >= WIND_MODERATE_MIN:
        return LEVEL_MODERATE
    return LEVEL_LOW


def classify_rain(rain_in_hr: float) -> str:
    """Classify rain (in/hr) into risk level."""
    if rain_in_hr > RAIN_NO_TRAVEL_MIN:
        return LEVEL_NO_TRAVEL
    if rain_in_hr >= RAIN_SEVERE_MIN:
        return LEVEL_SEVERE
    if rain_in_hr >= RAIN_HIGH_MIN:
        return LEVEL_HIGH
    if rain_in_hr >= RAIN_MODERATE_MIN:
        return LEVEL_MODERATE
    return LEVEL_LOW


def classify_snow(snow_in_hr: float) -> str:
    """Classify snow (in/hr) into risk level."""
    if snow_in_hr > SNOW_NO_TRAVEL_MIN:
        return LEVEL_NO_TRAVEL
    if snow_in_hr >= SNOW_SEVERE_MIN:
        return LEVEL_SEVERE
    if snow_in_hr >= SNOW_HIGH_MIN:
        return LEVEL_HIGH
    if snow_in_hr >= SNOW_MODERATE_MIN:
        return LEVEL_MODERATE
    return LEVEL_LOW


def compare_levels(level_a: str, level_b: str) -> str:
    """Return the worse (higher risk) of two levels."""
    score_a = RISK_SCORES.get(level_a, 0)
    score_b = RISK_SCORES.get(level_b, 0)
    return level_a if score_a >= score_b else level_b


def calculate_base_weather_risk(
    wind_mph: float,
    rain_in_hr: float,
    snow_in_hr: float,
) -> Tuple[str, str, str]:
    """
    Calculate base weather risk level, the governing condition, and the governing reason.
    Returns (worst_level, governing_condition, detail_text).
    """
    w_level = classify_wind(wind_mph)
    r_level = classify_rain(rain_in_hr)
    s_level = classify_snow(snow_in_hr)

    worst_level = LEVEL_LOW
    governing_condition = "wind"
    detail_text = f"Wind {wind_mph:.1f} mph is Low"

    # Prioritize higher severity; in case of tie: wind > snow > rain
    conditions = [
        ("wind", w_level, f"Wind {wind_mph:.1f} mph is {w_level}"),
        ("snow", s_level, f"Snow {snow_in_hr:.2f} in/hr is {s_level}"),
        ("rain", r_level, f"Rain {rain_in_hr:.2f} in/hr is {r_level}"),
    ]

    for cond, level, text in conditions:
        if RISK_SCORES[level] > RISK_SCORES[worst_level]:
            worst_level = level
            governing_condition = cond
            detail_text = text

    return worst_level, governing_condition, detail_text


def apply_load_rules(
    wind_mph: float,
    load_weight_lb: float,
    base_level: str,
    base_reason: str,
) -> Tuple[str, str]:
    """
    Apply truck load rules based on wind speed and cargo weight.
    Returns (final_level, final_reason).

    Rules:
    - Wind >= 55 mph: No Travel for any load.
    - Wind 45-54 mph (45 to < 55) and load > 30,000 lb: No Travel.
    - Wind 35-44 mph (35 to < 45) and load > 40,000 lb: Severe (upgrade if base is lower).
    """
    final_level = base_level
    final_reason = base_reason

    if wind_mph >= WIND_NO_TRAVEL_MIN:
        final_level = LEVEL_NO_TRAVEL
        final_reason = f"Wind {wind_mph:.1f} mph is No Travel for any load"
    elif wind_mph >= WIND_SEVERE_MIN and load_weight_lb > LOAD_WEIGHT_THRESHOLD_30K:
        final_level = LEVEL_NO_TRAVEL
        final_reason = (
            f"Wind {wind_mph:.1f} mph is Severe, upgraded to No Travel "
            f"because load is {load_weight_lb:,.0f} lb (> 30,000 lb)"
        )
    elif wind_mph >= WIND_HIGH_MIN and load_weight_lb > LOAD_WEIGHT_THRESHOLD_40K:
        if RISK_SCORES[final_level] < RISK_SCORES[LEVEL_SEVERE]:
            final_level = LEVEL_SEVERE
            final_reason = (
                f"Wind {wind_mph:.1f} mph is High, upgraded to Severe "
                f"because load is {load_weight_lb:,.0f} lb (> 40,000 lb)"
            )
        else:
            final_reason = f"{base_reason} (Heavy load {load_weight_lb:,.0f} lb checked)"

    return final_level, final_reason


def evaluate_checkpoint_risk(
    wind_mph: float,
    rain_in_hr: float,
    snow_in_hr: float,
    load_weight_lb: float,
) -> Dict[str, Any]:
    """
    Pure function to evaluate risk for a checkpoint given weather metrics and truck weight.
    """
    base_level, governing_condition, base_reason = calculate_base_weather_risk(
        wind_mph=wind_mph,
        rain_in_hr=rain_in_hr,
        snow_in_hr=snow_in_hr,
    )

    final_level, reason = apply_load_rules(
        wind_mph=wind_mph,
        load_weight_lb=load_weight_lb,
        base_level=base_level,
        base_reason=base_reason,
    )

    return {
        "base_level": base_level,
        "final_level": final_level,
        "governing_condition": governing_condition,
        "reason": reason,
        "score": RISK_SCORES[final_level],
    }
