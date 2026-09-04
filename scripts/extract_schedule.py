from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path

import pdfplumber


ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "30th PROFCON 2026 - Complete Event Schedule.pdf"
OUTPUT_PATH = ROOT / "src" / "data" / "schedule.json"


def clean(value: str | None) -> str:
    if not value:
        return ""
    return re.sub(r"\s+", " ", value).strip()


def normalize_time(value: str) -> str:
    parsed = datetime.strptime(clean(value), "%I:%M %p")
    return parsed.strftime("%H:%M")


def split_time_slot(value: str) -> tuple[str, str]:
    start, end = [part.strip() for part in clean(value).split(" - ", 1)]
    return normalize_time(start), normalize_time(end)


def category_for(title: str, section: str) -> str:
    upper = title.upper()
    if section == "workshop" or "WORKSHOP" in upper:
        return "Workshop"
    if section == "gathering":
        return "Gathering"
    if upper.startswith("CURIO"):
        return "Engagement"
    if "CLOSING CEREMONY" in upper or upper == "THE OPENING CHAPTER":
        return "Ceremony"
    if "BREAK" in upper or "ഇടംനേരം" in title:
        return "Break"
    if upper == "PROF-PULSE":
        return "Gathering"
    return "Session"


def add_rows(
    output: list[dict],
    rows: list[list[str | None]],
    *,
    date: str,
    day: str,
    track: str,
    venue: str | None = None,
    section: str = "session",
    page: int,
) -> None:
    inherited_venue = venue or ""
    for row in rows:
        if section in {"workshop", "gathering"}:
            row_venue, slot, title, details = row
            inherited_venue = clean(row_venue) or inherited_venue
        else:
            slot, title, details = row

        title = clean(title)
        details = clean(details)
        start_time, end_time = split_time_slot(clean(slot))
        sequence = len(output) + 1
        output.append(
            {
                "id": f"profcon-2026-{sequence:03d}",
                "date": date,
                "day": day,
                "track": track,
                "venue": inherited_venue,
                "start_time": start_time,
                "end_time": end_time,
                "title": title,
                "details": details,
                "category": category_for(title, section),
                "status": "Published",
                "last_updated": "2026-09-04T00:00:00+05:30",
                "source_page": page,
            }
        )


def main() -> None:
    with pdfplumber.open(PDF_PATH) as pdf:
        tables = {page_no: page.extract_tables() for page_no, page in enumerate(pdf.pages, 1)}

    schedule: list[dict] = []

    add_rows(
        schedule,
        tables[2][0][1:],
        date="2026-09-11",
        day="Friday",
        track="The Surface",
        venue="PRIME",
        page=2,
    )

    day2_prime = tables[3][0][1:] + tables[4][0][1:-1]
    continuation = [
        "7:30 PM - 8:00 PM",
        f"{clean(tables[4][0][-1][1])} {clean(tables[5][0][1][1])}",
        f"{clean(tables[4][0][-1][2])} {clean(tables[5][0][1][2])}",
    ]
    day2_prime += [continuation] + tables[5][0][2:]
    add_rows(
        schedule,
        day2_prime,
        date="2026-09-12",
        day="Saturday",
        track="The Deep",
        venue="PRIME",
        page=3,
    )

    add_rows(
        schedule,
        tables[6][0][1:] + tables[7][0][1:] + tables[8][0][1:],
        date="2026-09-12",
        day="Saturday",
        track="The Pinnacle",
        venue="FLORETS",
        page=6,
    )

    day2_global = tables[9][0][1:-1]
    day2_global.append(
        [
            "4:30 PM - 5:30 PM",
            clean(tables[9][0][-1][1]),
            clean(tables[9][0][-1][2]),
        ]
    )
    day2_global += tables[10][0][2:]
    add_rows(
        schedule,
        day2_global,
        date="2026-09-12",
        day="Saturday",
        track="The Peak",
        venue="GLOBAL",
        page=9,
    )

    add_rows(
        schedule,
        tables[11][0][1:],
        date="2026-09-12",
        day="Saturday",
        track="Exclusive Workshops",
        section="workshop",
        page=11,
    )

    add_rows(
        schedule,
        tables[12][0][1:],
        date="2026-09-13",
        day="Sunday",
        track="The Meadow",
        venue="PRIME",
        page=12,
    )

    add_rows(
        schedule,
        tables[13][0][1:],
        date="2026-09-13",
        day="Sunday",
        track="Day 3",
        venue="FLORETS",
        page=13,
    )

    add_rows(
        schedule,
        tables[13][1][1:] + tables[14][0][1:],
        date="2026-09-13",
        day="Sunday",
        track="The Root",
        venue="GLOBAL",
        page=13,
    )

    gatherings = tables[14][1][1:] + [["PROFCON RISE", *tables[15][0][1][1:]]]
    add_rows(
        schedule,
        gatherings,
        date="2026-09-13",
        day="Sunday",
        track="Special Gatherings",
        section="gathering",
        page=14,
    )

    replacements = {
        "അടിക്കുന്ന പുേരാഗമനം": "അടിക്കുന്ന പുരോഗമനം",
        '"അയിനിേ\x00ാ എ\x00ാ കുഴ\x00ം?!"': '"അയിനിപ്പോ എന്താ കുഴപ്പം?!"',
        "ഇടംേനരം": "ഇടംനേരം",
    }
    for item in schedule:
        item["title"] = replacements.get(item["title"], item["title"])

    if len(schedule) != 85:
        raise ValueError(f"Expected 85 schedule rows, extracted {len(schedule)}")
    if any(not item[field] for item in schedule for field in ("date", "venue", "start_time", "end_time", "title")):
        raise ValueError("One or more required fields are empty")

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(schedule, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(schedule)} sessions to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
