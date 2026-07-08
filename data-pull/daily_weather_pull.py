"""
Daily weather summary puller for api.weather.gov (NOAA/NWS).

Ported and expanded from the verified KDEN puller. For a given NWS station ID it
pulls a target day's raw observations (yesterday by default) and computes:
  - max/min temperature (°F)
  - max wind gust (mph)
  - total precipitation (in)

Key expansion over the original script — the **precip N/A fix** (see §5.6 of the
build brief): official ASOS/NWS stations that do not report precipitation must be
distinguished from stations that genuinely recorded 0.00". We look back over a
longer window (default 14 days) and, if the station never reports a non-null
`precipitationLastHour`, we mark ``precipReported: False`` and emit ``null`` for
the total. Otherwise a genuine zero is emitted as ``0.00``.

Output is one JSON file per station per day at
``data-pull/output/{STATION_ID}_{YYYY-MM-DD}.json`` with typed nulls preserved so
the backend importer can tell "0.00 in" apart from "N/A".

No API key needed. Free, no usage limits for reasonable request volume.
NWS asks that requests include a descriptive User-Agent with contact info.

Usage:
    python daily_weather_pull.py KDEN                 # yesterday (station-local)
    python daily_weather_pull.py KDEN 2026-07-07      # explicit target date
    python daily_weather_pull.py KDEN --stdout        # print JSON, do not write file
"""

import argparse
import json
import os
import sys
from datetime import datetime, timedelta, date, timezone
from zoneinfo import ZoneInfo

import requests

# --- CONFIG: update this with a real contact so NWS can reach you if needed ---
USER_AGENT = "forecast-game (contact: ek.burgos@gmail.com)"

BASE_URL = "https://api.weather.gov"
HEADERS = {"User-Agent": USER_AGENT, "Accept": "application/geo+json"}

# How far back to look when deciding whether a station reports precipitation at all.
PRECIP_LOOKBACK_DAYS = 14

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "output")


def get_station_timezone(station_id: str) -> str:
    """Look up the station's local IANA timezone (e.g. 'America/Denver')."""
    url = f"{BASE_URL}/stations/{station_id}"
    resp = requests.get(url, headers=HEADERS, timeout=15)
    resp.raise_for_status()
    return resp.json()["properties"]["timeZone"]


def get_day_bounds_utc(station_tz: str, target_date: date) -> tuple[str, str]:
    """Convert a local calendar day (midnight to midnight) into UTC ISO timestamps."""
    tz = ZoneInfo(station_tz)
    start_local = datetime(target_date.year, target_date.month, target_date.day, 0, 0, 0, tzinfo=tz)
    end_local = start_local + timedelta(days=1)
    return start_local.isoformat(), end_local.isoformat()


def get_observations(station_id: str, start_iso: str, end_iso: str) -> list[dict]:
    """Pull raw observations for the station within the given time window."""
    url = f"{BASE_URL}/stations/{station_id}/observations"
    params = {"start": start_iso, "end": end_iso}
    resp = requests.get(url, headers=HEADERS, params=params, timeout=30)
    resp.raise_for_status()
    return resp.json()["features"]


def summarize_day(observations: list[dict]) -> dict:
    """Compute max/min temp (C), max wind gust (km/h), and total precip (mm).

    ``precip_reported_in_window`` tells the caller whether *this* window contained
    any non-null precipitation reading. That alone is not enough to decide N/A (a
    real dry day also has all-null hourly precip on some stations), which is why
    ``station_reports_precip`` uses the longer lookback below.
    """
    temps, gusts, precip_readings = [], [], []

    for obs in observations:
        props = obs["properties"]

        t = props.get("temperature", {}).get("value")
        if t is not None:
            temps.append(t)

        g = props.get("windGust", {}).get("value")
        if g is not None:
            gusts.append(g)

        # precipitationLastHour is the cleanest field to sum without double-counting
        p = props.get("precipitationLastHour", {}).get("value")
        if p is not None:
            precip_readings.append(p)

    return {
        "max_temp_c": max(temps) if temps else None,
        "min_temp_c": min(temps) if temps else None,
        "max_gust_kph": max(gusts) if gusts else None,
        "total_precip_mm": sum(precip_readings) if precip_readings else 0.0,
        "precip_reported_in_window": len(precip_readings) > 0,
        "num_observations": len(observations),
    }


def station_reports_precip(station_id: str, station_tz: str, target_date: date,
                           lookback_days: int = PRECIP_LOOKBACK_DAYS) -> bool:
    """Decide whether the station reports precipitation *at all*.

    Looks back ``lookback_days`` ending at the target day and checks whether any
    observation carried a non-null ``precipitationLastHour``. If none did, the
    station is treated as non-reporting and precip should be emitted as N/A.
    """
    tz = ZoneInfo(station_tz)
    window_start = datetime(target_date.year, target_date.month, target_date.day,
                            0, 0, 0, tzinfo=tz) - timedelta(days=lookback_days - 1)
    window_end = datetime(target_date.year, target_date.month, target_date.day,
                          0, 0, 0, tzinfo=tz) + timedelta(days=1)

    try:
        observations = get_observations(station_id, window_start.isoformat(), window_end.isoformat())
    except requests.RequestException:
        # If the lookback request fails, be conservative and assume it does report
        # (a genuine zero is safer than wrongly flagging a reporting station N/A).
        return True

    for obs in observations:
        p = obs["properties"].get("precipitationLastHour", {}).get("value")
        if p is not None:
            return True
    return False


def c_to_f(c):
    return None if c is None else c * 9 / 5 + 32


def kph_to_mph(kph):
    return None if kph is None else kph * 0.621371


def mm_to_in(mm):
    return None if mm is None else mm / 25.4


def get_daily_summary(station_id: str, target_date: date | None = None) -> dict:
    """Main entry point: get a day's summary for a station with the precip N/A fix."""
    tz = get_station_timezone(station_id)

    if target_date is None:
        target_date = (datetime.now(ZoneInfo(tz)) - timedelta(days=1)).date()

    start_iso, end_iso = get_day_bounds_utc(tz, target_date)
    observations = get_observations(station_id, start_iso, end_iso)
    summary = summarize_day(observations)

    # Precip N/A fix: distinguish a genuine 0.00" from a station that never reports precip.
    reports_precip = station_reports_precip(station_id, tz, target_date)
    if reports_precip:
        precip_total_in = round(mm_to_in(summary["total_precip_mm"]), 2)
    else:
        precip_total_in = None

    max_temp_f = c_to_f(summary["max_temp_c"])
    min_temp_f = c_to_f(summary["min_temp_c"])
    max_gust_mph = kph_to_mph(summary["max_gust_kph"])

    return {
        "stationId": station_id,
        "date": target_date.isoformat(),
        "timezone": tz,
        "maxTempF": round(max_temp_f, 2) if max_temp_f is not None else None,
        "minTempF": round(min_temp_f, 2) if min_temp_f is not None else None,
        "maxGustMph": round(max_gust_mph, 2) if max_gust_mph is not None else None,
        "precipReported": reports_precip,
        "precipTotalIn": precip_total_in,
        "numObservations": summary["num_observations"],
        "pulledAt": datetime.now(timezone.utc).isoformat(),
    }


def write_output(result: dict, output_dir: str = OUTPUT_DIR) -> str:
    """Write the summary to output/{STATION_ID}_{YYYY-MM-DD}.json and return the path."""
    os.makedirs(output_dir, exist_ok=True)
    filename = f"{result['stationId']}_{result['date']}.json"
    path = os.path.join(output_dir, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)
        f.write("\n")
    return path


def _fmt(value, unit, precision):
    return f"{value:.{precision}f} {unit}" if value is not None else "N/A"


def main():
    parser = argparse.ArgumentParser(description="Pull a daily NWS weather summary for one station.")
    parser.add_argument("station_id", nargs="?", default="KDEN", help="NWS station ID, e.g. KDEN")
    parser.add_argument("date", nargs="?", default=None, help="Target date YYYY-MM-DD (default: yesterday, station-local)")
    parser.add_argument("--stdout", action="store_true", help="Print JSON to stdout instead of writing a file")
    args = parser.parse_args()

    target_date = None
    if args.date:
        try:
            target_date = datetime.strptime(args.date, "%Y-%m-%d").date()
        except ValueError:
            print(f"❌ Invalid date '{args.date}'. Use YYYY-MM-DD.", file=sys.stderr)
            sys.exit(1)

    result = get_daily_summary(args.station_id, target_date)

    if args.stdout:
        print(json.dumps(result, indent=2))
        return

    path = write_output(result)

    print(f"\nDaily summary for {result['stationId']} on {result['date']} ({result['timezone']})")
    print(f"  Max temp:     {_fmt(result['maxTempF'], 'F', 1)}")
    print(f"  Min temp:     {_fmt(result['minTempF'], 'F', 1)}")
    print(f"  Max gust:     {_fmt(result['maxGustMph'], 'mph', 1)}")
    if result["precipReported"]:
        print(f"  Total precip: {_fmt(result['precipTotalIn'], 'in', 2)}")
    else:
        print(f"  Total precip: N/A (station does not report precipitation)")
    print(f"  (from {result['numObservations']} raw observations)")
    print(f"  → wrote {path}\n")


if __name__ == "__main__":
    main()
