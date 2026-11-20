import pytest
from routing.services.risk import (
    classify_wind,
    classify_rain,
    classify_snow,
    calculate_base_weather_risk,
    apply_load_rules,
    evaluate_checkpoint_risk,
    LEVEL_LOW,
    LEVEL_MODERATE,
    LEVEL_HIGH,
    LEVEL_SEVERE,
    LEVEL_NO_TRAVEL,
)

@pytest.mark.parametrize(
    "wind_mph,expected",
    [
        (0.0, LEVEL_LOW),
        (24.9, LEVEL_LOW),
        (25.0, LEVEL_MODERATE),   # lower-bound inclusive
        (34.9, LEVEL_MODERATE),
        (35.0, LEVEL_HIGH),       # lower-bound inclusive
        (44.9, LEVEL_HIGH),
        (45.0, LEVEL_SEVERE),     # lower-bound inclusive
        (54.9, LEVEL_SEVERE),
        (55.0, LEVEL_NO_TRAVEL),  # lower-bound inclusive
        (75.0, LEVEL_NO_TRAVEL),
    ],
)
def test_wind_classification_boundaries(wind_mph, expected):
    assert classify_wind(wind_mph) == expected


@pytest.mark.parametrize(
    "rain_in_hr,expected",
    [
        (0.0, LEVEL_LOW),
        (0.09, LEVEL_LOW),
        (0.10, LEVEL_MODERATE),   # lower-bound inclusive
        (0.24, LEVEL_MODERATE),
        (0.25, LEVEL_HIGH),       # lower-bound inclusive
        (0.49, LEVEL_HIGH),
        (0.50, LEVEL_SEVERE),     # lower-bound inclusive
        (1.00, LEVEL_SEVERE),     # <= 1.00 is Severe
        (1.01, LEVEL_NO_TRAVEL),  # > 1.00 is No Travel
        (2.5, LEVEL_NO_TRAVEL),
    ],
)
def test_rain_classification_boundaries(rain_in_hr, expected):
    assert classify_rain(rain_in_hr) == expected


@pytest.mark.parametrize(
    "snow_in_hr,expected",
    [
        (0.0, LEVEL_LOW),
        (0.49, LEVEL_LOW),
        (0.50, LEVEL_MODERATE),   # lower-bound inclusive
        (0.99, LEVEL_MODERATE),
        (1.00, LEVEL_HIGH),       # lower-bound inclusive
        (1.99, LEVEL_HIGH),
        (2.00, LEVEL_SEVERE),     # lower-bound inclusive
        (3.00, LEVEL_SEVERE),     # <= 3.0 is Severe
        (3.01, LEVEL_NO_TRAVEL),  # > 3.0 is No Travel
        (5.0, LEVEL_NO_TRAVEL),
    ],
)
def test_snow_classification_boundaries(snow_in_hr, expected):
    assert classify_snow(snow_in_hr) == expected


def test_worst_condition_selection():
    # Wind moderate, rain severe, snow low -> worst is Severe governed by rain
    level, cond, reason = calculate_base_weather_risk(
        wind_mph=30.0,
        rain_in_hr=0.60,
        snow_in_hr=0.1,
    )
    assert level == LEVEL_SEVERE
    assert cond == "rain"
    assert "Rain" in reason


@pytest.mark.parametrize(
    "wind,weight,base_level,expected_level,expected_rule_triggered",
    [
        # Rule 1: Wind >= 55 -> No Travel for any load
        (55.0, 10000, LEVEL_NO_TRAVEL, LEVEL_NO_TRAVEL, True),
        (60.0, 45000, LEVEL_NO_TRAVEL, LEVEL_NO_TRAVEL, True),

        # Rule 2: Wind 45-54 mph and load > 30,000 lb -> No Travel
        (46.0, 31000, LEVEL_SEVERE, LEVEL_NO_TRAVEL, True),
        (46.0, 30000, LEVEL_SEVERE, LEVEL_SEVERE, False),  # exactly 30k does not upgrade
        (46.0, 25000, LEVEL_SEVERE, LEVEL_SEVERE, False),

        # Rule 3: Wind 35-44 mph and load > 40,000 lb -> Severe
        (38.0, 42000, LEVEL_HIGH, LEVEL_SEVERE, True),
        (38.0, 40000, LEVEL_HIGH, LEVEL_HIGH, False),    # exactly 40k does not upgrade
        (38.0, 20000, LEVEL_HIGH, LEVEL_HIGH, False),

        # When base is already higher than upgrade
        (38.0, 45000, LEVEL_SEVERE, LEVEL_SEVERE, False),
    ],
)
def test_load_rules(wind, weight, base_level, expected_level, expected_rule_triggered):
    lvl, reason = apply_load_rules(wind, weight, base_level, "Base reason")
    assert lvl == expected_level
    if expected_rule_triggered and expected_level != base_level:
        assert "upgraded" in reason.lower() or "no travel" in reason.lower()


def test_evaluate_checkpoint_risk_full():
    res = evaluate_checkpoint_risk(
        wind_mph=48.0,
        rain_in_hr=0.15,
        snow_in_hr=0.0,
        load_weight_lb=35000.0,
    )
    assert res["base_level"] == LEVEL_SEVERE
    assert res["final_level"] == LEVEL_NO_TRAVEL
    assert res["score"] == 4
