"""
Legal content cache + scraper.

Fetches the canonical Terms / Privacy content from oryno.tech once per day
and caches the cleaned HTML in MongoDB. The client reads the cached copy
through GET /api/legal/content?type=terms|privacy.

Why cache instead of iframe?
- The Settings page must work offline / when oryno.tech is unreachable.
- Iframing third-party HTML breaks our CSP and design system.
- Scraping + caching gives us a server-side fallback and prevents per-user
  hammering of the marketing site.
"""
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException, Query

from config.database import get_database

router = APIRouter(prefix="/api/legal", tags=["legal"])
logger = logging.getLogger(__name__)

# Source of truth — production marketing site
LEGAL_SOURCES = {
    "terms": "https://oryno.tech/terms",
    "privacy": "https://oryno.tech/privacy",
}

# Cache invalidation window
CACHE_TTL_HOURS = 24


def _clean_scraped_html(raw: str) -> dict:
    """Extract a usable {title, html_content, text_content} from a scraped page.

    Strips out the marketing site's nav/footer/scripts and keeps just the
    article body. Falls back to the full <main> if no <article> is present.
    """
    soup = BeautifulSoup(raw, "html.parser")

    # Drop noise
    for tag in soup(["script", "style", "noscript", "iframe", "header", "footer", "nav"]):
        tag.decompose()

    # Find the main content node
    main = soup.find("article") or soup.find("main") or soup.find("body")
    if not main:
        return {"title": "", "html_content": "", "text_content": ""}

    # Title
    title_node = main.find(["h1", "h2"])
    title = title_node.get_text(strip=True) if title_node else ""

    html_content = str(main)
    text_content = re.sub(r"\n{3,}", "\n\n", main.get_text("\n", strip=True))

    return {
        "title": title,
        "html_content": html_content,
        "text_content": text_content,
    }


async def _fetch_remote(url: str) -> Optional[dict]:
    """Fetch and clean the marketing page. Returns None on any failure."""
    try:
        async with httpx.AsyncClient(timeout=20.0, follow_redirects=True) as client:
            resp = await client.get(url, headers={"User-Agent": "OrynoLegalSync/1.0"})
        if resp.status_code != 200:
            logger.warning("Legal fetch %s returned %s", url, resp.status_code)
            return None
        return _clean_scraped_html(resp.text)
    except Exception as exc:
        logger.warning("Legal fetch %s failed: %s", url, exc)
        return None


@router.get("/content")
async def get_legal_content(
    content_type: str = Query(..., alias="type", regex="^(terms|privacy)$"),
    refresh: bool = Query(False, description="Force re-scrape from upstream"),
):
    """Return cached legal content. Re-scrapes when the cache is stale or absent."""
    db = get_database()
    source_url = LEGAL_SOURCES[content_type]
    cache_key = f"legal_{content_type}"

    now = datetime.now(timezone.utc)
    cached = await db.legal_content_cache.find_one({"_id": cache_key})

    # Mongo strips tzinfo on read — normalise to UTC-aware before arithmetic.
    cached_at = None
    if cached:
        cached_at = cached.get("fetched_at")
        if isinstance(cached_at, datetime) and cached_at.tzinfo is None:
            cached_at = cached_at.replace(tzinfo=timezone.utc)

    needs_refresh = (
        refresh
        or not cached
        or not cached.get("html_content")
        or cached_at is None
        or (now - cached_at) > timedelta(hours=CACHE_TTL_HOURS)
    )

    if needs_refresh:
        scraped = await _fetch_remote(source_url)
        if scraped and scraped.get("html_content"):
            doc = {
                "_id": cache_key,
                "type": content_type,
                "source_url": source_url,
                "title": scraped["title"],
                "html_content": scraped["html_content"],
                "text_content": scraped["text_content"],
                "fetched_at": now,
            }
            await db.legal_content_cache.update_one(
                {"_id": cache_key}, {"$set": doc}, upsert=True
            )
            cached = doc

    if not cached:
        # Final fallback — never block the Settings page entirely.
        return {
            "type": content_type,
            "title": "",
            "html_content": "",
            "text_content": "",
            "source_url": source_url,
            "fetched_at": None,
            "stale": True,
        }

    return {
        "type": cached["type"],
        "title": cached.get("title", ""),
        "html_content": cached.get("html_content", ""),
        "text_content": cached.get("text_content", ""),
        "source_url": cached.get("source_url", source_url),
        "fetched_at": (
            cached["fetched_at"].isoformat()
            if isinstance(cached.get("fetched_at"), datetime)
            else None
        ),
        "stale": needs_refresh and (not cached.get("html_content")),
    }


@router.post("/content/refresh")
async def force_refresh_all():
    """Admin utility — force a re-scrape of every legal page right now."""
    db = get_database()
    results = {}
    for ctype, url in LEGAL_SOURCES.items():
        scraped = await _fetch_remote(url)
        if scraped:
            await db.legal_content_cache.update_one(
                {"_id": f"legal_{ctype}"},
                {"$set": {
                    "_id": f"legal_{ctype}",
                    "type": ctype,
                    "source_url": url,
                    **scraped,
                    "fetched_at": datetime.now(timezone.utc),
                }},
                upsert=True,
            )
            results[ctype] = "refreshed"
        else:
            results[ctype] = "failed"
    return {"results": results}
