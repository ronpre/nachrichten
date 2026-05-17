#!/usr/bin/env python3
"""
fetch_news.py – holt RSS-Feeds und schreibt news.json
Wird von GitHub Actions stündlich ausgeführt (06–17 Uhr MEZ).
"""

import json
import re
import feedparser
from datetime import datetime, timezone, timedelta
from email.utils import parsedate_to_datetime

FEEDS = {
    "wirtschaft": [
        {"url": "https://www.tagesschau.de/xml/rss2_wirtschaft/", "src": "tagesschau"},
        {"url": "https://www.n-tv.de/wirtschaft/rss",             "src": "n-tv"},
        {"url": "https://www.finanznachrichten.de/rss/nachrichten","src": "finanznachrichten"},
    ],
    "politik": [
        {"url": "https://www.tagesschau.de/xml/rss2_inland/",     "src": "tagesschau inland"},
        {"url": "https://www.tagesschau.de/xml/rss2_ausland/",    "src": "tagesschau ausland"},
        {"url": "https://www.n-tv.de/politik/rss",                "src": "n-tv"},
    ],
    "it": [
        {"url": "https://www.heise.de/rss/heise-atom.xml",                   "src": "heise"},
        {"url": "https://www.golem.de/rss.php",                              "src": "golem"},
        {"url": "https://feeds.arstechnica.com/arstechnica/technology-lab",  "src": "ars technica"},
    ],
}

MAX_PER_FEED  = 10
MAX_PER_CAT   = 20


def strip_html(text: str) -> str:
    if not text:
        return ""
    clean = re.sub(r"<[^>]+>", " ", text)
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean[:200] + "…" if len(clean) > 200 else clean


def parse_date(entry) -> str | None:
    """Gibt ISO-8601-String zurück oder None."""
    for attr in ("published", "updated"):
        raw = getattr(entry, attr, None)
        if raw:
            try:
                dt = parsedate_to_datetime(raw)
                return dt.astimezone(timezone.utc).isoformat()
            except Exception:
                pass
    # feedparser-eigenes struct_time
    for attr in ("published_parsed", "updated_parsed"):
        t = getattr(entry, attr, None)
        if t:
            try:
                dt = datetime(*t[:6], tzinfo=timezone.utc)
                return dt.isoformat()
            except Exception:
                pass
    return None


def fetch_feed(url: str, src: str) -> list[dict]:
    try:
        feed = feedparser.parse(url, request_headers={"User-Agent": "Mozilla/5.0 (compatible; NewsBot/1.0)"})
        items = []
        for entry in feed.entries[:MAX_PER_FEED]:
            title = (entry.get("title") or "").strip()
            if not title:
                continue
            link    = entry.get("link") or ""
            summary = strip_html(entry.get("summary") or entry.get("description") or "")
            pub     = parse_date(entry)
            items.append({"title": title, "link": link, "summary": summary, "source": src, "pubDate": pub})
        return items
    except Exception as exc:
        print(f"  FEHLER {src}: {exc}")
        return []


def dedup(articles: list[dict]) -> list[dict]:
    seen: set[str] = set()
    result = []
    for a in articles:
        key = a["title"].lower()[:55]
        if key not in seen:
            seen.add(key)
            result.append(a)
    return result


def main():
    output: dict[str, list] = {}

    for category, feeds in FEEDS.items():
        print(f"\n── {category} ──")
        all_items = []
        for feed_cfg in feeds:
            print(f"  Lade {feed_cfg['src']} …", end=" ")
            items = fetch_feed(feed_cfg["url"], feed_cfg["src"])
            print(f"{len(items)} Artikel")
            all_items.extend(items)

        # Sortiere nach Datum (neueste zuerst), filter >24h, dedupliziere, begrenze
        cutoff = datetime.now(timezone.utc) - timedelta(hours=24)
        all_items = [
            item for item in all_items
            if item.get("pubDate") is None or
               datetime.fromisoformat(item["pubDate"]) >= cutoff
        ]
        all_items.sort(key=lambda x: x["pubDate"] or "", reverse=True)
        output[category] = dedup(all_items)[:MAX_PER_CAT]
        print(f"  → {len(output[category])} Artikel gespeichert")

    payload = {
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        **output,
    }

    with open("news.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    print(f"\n✓ news.json geschrieben ({datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')})")


if __name__ == "__main__":
    main()
