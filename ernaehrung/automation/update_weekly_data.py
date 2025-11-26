#!/usr/bin/env python3
"""Ensure Ernaehrung data is refreshed once per calendar week."""

from __future__ import annotations

import argparse
import subprocess
import sys
from datetime import date, timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
GENERATOR = BASE_DIR / "generate_wochenplan.py"
PLANS_DIR = BASE_DIR / "wochenplaene"


def monday_of_week(target: date) -> date:
    return target - timedelta(days=target.weekday())


def ensure_weekly_plan(force: bool, week_offset: int) -> None:
    week_start = monday_of_week(date.today()) + timedelta(days=7 * week_offset)
    canonical = PLANS_DIR / f"wochenplan_{week_start.isoformat()}.txt"
    iso_year, iso_week, _ = week_start.isocalendar()

    if canonical.exists() and not force:
        print(
            "Plan bereits vorhanden:"
            f" KW {iso_week:02d}/{iso_year} (Start {week_start.isoformat()})"
        )
        return

    if not GENERATOR.exists():
        raise SystemExit(f"Generator-Skript nicht gefunden: {GENERATOR}")

    cmd = [sys.executable, str(GENERATOR), "--force"]
    if week_offset:
        cmd.append(f"--week-offset={week_offset}")
    print("Starte Generierung:", " ".join(cmd))
    subprocess.run(cmd, check=True, cwd=str(BASE_DIR))


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Aktualisiert Ernaehrungsdaten fuer die aktuelle Kalenderwoche"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Erzwingt eine neue Generierung auch wenn bereits ein Plan existiert",
    )
    parser.add_argument(
        "--week-offset",
        type=int,
        default=0,
        help="Verschiebung in Wochen relativ zur aktuellen Kalenderwoche",
    )
    parser.add_argument(
        "--next-week",
        action="store_true",
        help="Erzeugt den Plan fuer die kommende Kalenderwoche",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    week_offset = args.week_offset
    if args.next_week:
        week_offset += 1
    ensure_weekly_plan(force=args.force, week_offset=week_offset)

if __name__ == "__main__":
    main()
