"""
HTTP cache-header helpers for catalog-style GET endpoints.

When the platform sits behind a CDN (Cloudflare, Fastly, Cloudfront), edge
nodes will cache responses bearing `Cache-Control: public, s-maxage=N`. The
TTL applies only to anonymous GETs — we never cache authenticated user-
specific responses (would be a data leak).

Usage in a route:

    from utils.cache_headers import edge_cache, NO_STORE

    @router.get("/")
    async def list_things(request: Request, response: Response):
        response.headers["Cache-Control"] = edge_cache(60)
        ...

The default policy: 60s public cache, 600s stale-while-revalidate. Edge can
serve stale during a slow origin without spiking origin latency.
"""

NO_STORE = "no-store, no-cache, must-revalidate, private"


def edge_cache(
    s_maxage: int = 60,
    stale_while_revalidate: int = 600,
    browser_max_age: int = 0,
) -> str:
    """Build a Cache-Control header that:
    - The browser does NOT cache (max-age=0) — we want fresh on hard refresh.
    - The CDN caches for s-maxage seconds.
    - During s-maxage..s-maxage+stale_while_revalidate, the CDN serves stale
      while it triggers an async background refresh.
    """
    parts = [
        "public",
        f"max-age={browser_max_age}",
        f"s-maxage={s_maxage}",
        f"stale-while-revalidate={stale_while_revalidate}",
    ]
    return ", ".join(parts)
