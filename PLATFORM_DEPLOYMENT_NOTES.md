# Platform Deployment Notes

Items the **platform team / DevOps** owns. The application is hardened end-to-end (Phases 1-3) but a few production-only configs need to land on the platform side. Each item below is paste-ready.

---

## 1. Multi-worker uvicorn (replace dev `--reload` with prod `--workers`)

### Current (dev — single worker + hot reload)
File: `/etc/supervisor/conf.d/supervisord.conf`
```ini
[program:backend]
command=/root/.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Production replacement
```ini
[program:backend]
command=/root/.venv/bin/uvicorn server:app \
    --host 0.0.0.0 --port 8001 \
    --workers %(ENV_UVICORN_WORKERS)s \
    --no-access-log \
    --loop uvloop \
    --http httptools \
    --timeout-keep-alive 30 \
    --proxy-headers \
    --forwarded-allow-ips="*"
environment=UVICORN_WORKERS="4"
```

### Notes
- **Worker count rule of thumb**: `min(2 × CPU, 8)` per pod. On a 2-core pod set `UVICORN_WORKERS=4`.
- Drop `--reload` — it's dev-only and adds ~20% CPU overhead.
- `--proxy-headers` + `--forwarded-allow-ips` are required so the rate limiter and IP logging see the real client IP through Cloudflare/k8s ingress.
- **Important**: the in-process Arq worker we boot from `server.py` will start on EACH worker process. To avoid N copies, move the worker to a sidecar (see `scripts/supervisor-worker.conf.template`).

---

## 2. Cloudflare Cache Rule for `/api/services/*`

### Why
The application emits the right `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=600` on `GET /api/services/` and detail endpoints. Cloudflare currently strips/overrides these headers and forces `no-store`, so the edge cache benefit is wasted.

### Rule (Cloudflare → Rules → Cache Rules → Create Rule)

**Name**: `cache-public-catalog-endpoints`

**If incoming requests match (custom filter expression)**:
```
(http.request.uri.path matches "^/api/services(/|$)")
and (not http.request.headers["authorization"][0] eq "")
```
*(The second clause excludes any request carrying an `Authorization` header — never cache a per-user response.)*

**Then**:
- **Cache eligibility**: `Eligible for cache`
- **Edge TTL**: `Respect existing headers (use origin Cache-Control)`
- **Browser TTL**: `Override` → `0 seconds` (still no client caching)
- **Cache by query string**: `All` (so `?city=Yaoundé` is a distinct cache key from `?city=Douala`)
- **Bypass cache on cookie**: leave empty

### Verification
After the rule lands, the response from the preview URL should show
`cf-cache-status: HIT` (or `MISS` on the first hit, `HIT` on the next).

---

## 3. MongoDB read replicas + `readPreference=secondaryPreferred`

### What the app already does
`config/database.py` now creates the Motor client with:
```python
read_preference=ReadPreference.SECONDARY_PREFERRED
```
controlled by `MONGO_READ_PREFERENCE` env var. On a single-node deployment this is a no-op; the moment you point `MONGO_URL` at a replica set, reads automatically drain to secondaries.

### What you need on Atlas
- Create at least **1 replica** (3-node = primary + 2 secondaries is the cheapest HA tier).
- Connection string MUST include `replicaSet=...` and ideally `readPreference=secondaryPreferred` so external tools see the same policy.

### Sample MONGO_URL (Atlas)
```
mongodb+srv://user:pass@prod-cluster.xxxxx.mongodb.net/oryno_webapp?replicaSet=prod-cluster-shard-0&retryWrites=true&w=majority&readPreference=secondaryPreferred
```

### Tunables (env)
| Var | Default | Notes |
|---|---|---|
| `MONGO_READ_PREFERENCE` | `secondary_preferred` | `primary` to revert |
| `MONGO_MAX_POOL_SIZE` | `200` | Per-process pool ceiling |
| `MONGO_MIN_POOL_SIZE` | `10` | Keep warm |
| `MONGO_SELECT_TIMEOUT_MS` | `3000` | Fail fast on degraded clusters |

---

## 4. Stand-alone Arq worker container (for production isolation)

### What the app already does
- In-process worker is auto-started by `server.py` on dev/single-pod (good enough for now).
- WorkerSettings is also exposed for stand-alone use: `utils.task_queue.WorkerSettings`.

### What to deploy in prod
Spawn a separate pod (or process group on the same pod) that runs:
```
cd /app/backend && python -m scripts.run_worker
```
or equivalently:
```
cd /app/backend && arq utils.task_queue.WorkerSettings
```

A ready-to-drop supervisor program is at `backend/scripts/supervisor-worker.conf.template`.

### Recommended replicas
- 1 worker pod per 2 API pods is a good starting ratio.
- Scale workers up when the `arq:queue` length grows (Redis: `LLEN arq:queue`).

### One-time guard for API pods running multi-worker
If you DO keep the in-process worker on the API and run with `--workers 4`,
you'll get 4 in-process workers consuming the queue. That's not catastrophic
but is wasteful. To disable the in-process worker on API pods:

```python
# In server.py startup hook, change:
from utils.task_queue import start_worker_in_process
if os.environ.get("API_ROLE", "api") != "api":   # only run worker on non-api pods
    await start_worker_in_process()
```

Then set `API_ROLE=api` on API pods and (anything else) on worker pods.

---

## 5. Status flag: what the application emits today

These all light up correctly in `backend.err.log` on boot when Redis is reachable:
```
Indexes bootstrapped: created=0 existed=91 failed=0
Redis cache enabled at redis://localhost:6379/0
PubSub subscriber started on pattern seats:*
In-process arq worker started
Starting worker for 2 functions: send_email, send_promotion_fanout
```

If any of these are missing post-deploy, that subsystem is silently falling
back to its degraded mode (in-process cache / no cross-pod pub-sub / inline
task execution). All fallbacks are graceful — no API errors result, but the
scale benefit is lost.
