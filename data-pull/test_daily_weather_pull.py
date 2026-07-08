"""
Offline smoke test for daily_weather_pull.py.

Exercises the pure computation logic (unit conversions, day summary, and the
precip N/A distinction) with synthetic observations so it runs with no network
access. Live end-to-end validation against api.weather.gov was already done for
the source script (KDEN: max/min temp, max gust, precip all matched weather.gov).

Run: python test_daily_weather_pull.py
"""

import daily_weather_pull as p


def obs(temp_c=None, gust_kph=None, precip_mm=None):
    """Build one GeoJSON-style observation feature like api.weather.gov returns."""
    return {
        "properties": {
            "temperature": {"value": temp_c},
            "windGust": {"value": gust_kph},
            "precipitationLastHour": {"value": precip_mm},
        }
    }


def approx(a, b, tol=1e-6):
    return a is not None and b is not None and abs(a - b) < tol


def test_conversions():
    assert approx(p.c_to_f(0), 32.0)
    assert approx(p.c_to_f(100), 212.0)
    assert p.c_to_f(None) is None
    assert approx(p.kph_to_mph(100), 62.1371)
    assert p.kph_to_mph(None) is None
    assert approx(p.mm_to_in(25.4), 1.0)
    assert p.mm_to_in(None) is None
    print("✅ conversions")


def test_summarize_day_basic():
    observations = [
        obs(temp_c=20, gust_kph=30, precip_mm=1.0),
        obs(temp_c=35, gust_kph=50, precip_mm=2.0),
        obs(temp_c=10, gust_kph=None, precip_mm=None),
    ]
    s = p.summarize_day(observations)
    assert s["max_temp_c"] == 35
    assert s["min_temp_c"] == 10
    assert s["max_gust_kph"] == 50
    assert approx(s["total_precip_mm"], 3.0)
    assert s["precip_reported_in_window"] is True
    assert s["num_observations"] == 3
    print("✅ summarize_day basic")


def test_summarize_day_all_null():
    observations = [obs(), obs()]
    s = p.summarize_day(observations)
    assert s["max_temp_c"] is None
    assert s["min_temp_c"] is None
    assert s["max_gust_kph"] is None
    assert s["total_precip_mm"] == 0.0
    assert s["precip_reported_in_window"] is False
    print("✅ summarize_day all-null")


def test_precip_zero_vs_na():
    """A reporting station with a dry day emits 0.00; a non-reporting station emits null.

    We monkeypatch the network-touching helpers so the pipeline runs offline.
    """
    # Case 1: station reports precip, yesterday was genuinely dry (0.00").
    p.get_station_timezone = lambda sid: "America/Denver"
    p.get_observations = lambda sid, start, end: [obs(temp_c=30, gust_kph=40, precip_mm=0.0)]
    p.station_reports_precip = lambda sid, tz, d, lookback_days=14: True
    r = p.get_daily_summary("KDEN", __import__("datetime").date(2026, 7, 7))
    assert r["precipReported"] is True
    assert r["precipTotalIn"] == 0.0, r["precipTotalIn"]
    assert approx(r["maxTempF"], 86.0)

    # Case 2: station never reports precip -> N/A (null), even though sum would be 0.
    p.station_reports_precip = lambda sid, tz, d, lookback_days=14: False
    r2 = p.get_daily_summary("KXYZ", __import__("datetime").date(2026, 7, 7))
    assert r2["precipReported"] is False
    assert r2["precipTotalIn"] is None
    print("✅ precip 0.00 vs N/A distinction")


if __name__ == "__main__":
    test_conversions()
    test_summarize_day_basic()
    test_summarize_day_all_null()
    test_precip_zero_vs_na()
    print("\nAll smoke tests passed. (Live api.weather.gov validation was done on the source script.)")
