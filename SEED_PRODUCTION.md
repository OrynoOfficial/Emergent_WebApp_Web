# Seeding Production from Preview Data

A one-shot workflow to copy the **catalogue** (operators, services, films, hotels, restaurants, etc.) from the preview database into a fresh production database. Users, bookings, payments, and audit data are **deliberately not copied** — your real customers will sign up fresh on production.

## What gets copied

✅ 290 documents across 31 collections:

| Tier | Collections |
|------|-------------|
| Reference data | `countries`, `regions`, `market_segments`, `roles`, `operator_roles`, `employee_access_scopes`, `pods`, `pod_memberships` |
| Operators (businesses) | `operators` |
| Cinema | `cinemas`, `films`, `showtimes` |
| Hospitality | `hotels`, `rooms`, `restaurants`, `restaurant_menu`, `banquets` |
| Travel | `travel_routes`, `vehicles`, `car_rentals` |
| Other services | `pressings`, `pressing`, `pressing_services`, `services`, `events`, `packages`, `package_services` |
| Loyalty & promos | `loyalty_programs`, `loyalty_rewards`, `promotions`, `promo_codes` |

❌ Not copied: `users`, `bookings`, `orders`, `payments`, `commission_records`, `receipts`, `activity_logs`, `verification_tokens`, `otps`, `notifications`, `support_tickets`, `ratings`, `favourites`, `loyalty_redemptions`, `system_settings`, `analytics_daily_rollup`, and every other transactional/ephemeral collection.

User foreign-key fields (`owner_user_id`, `created_by`, `updated_by`, `manager_id`, …) are scrubbed to `null` at export time so we don't carry dangling references into prod. **Operator owners will need to be re-invited on production** via the Add-Operator wizard — the operator records arrive ownerless and ready to accept a fresh owner.

## How to run the import

### Step 1 — Download the seed bundle
The export lives in the preview pod at `/app/oryno_seed.json` (≈273 KB, 290 docs).
Download it via the Emergent Files panel (right-click → Download), or pull it via the API from your laptop:

```bash
PREVIEW_URL="https://<your-preview-host>.preview.emergentagent.com"
PREVIEW_TOKEN=$(curl -s -X POST "$PREVIEW_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@oryno.com","password":"YOUR_PREVIEW_PASSWORD"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

curl -L -o oryno_seed.json \
  -H "Authorization: Bearer $PREVIEW_TOKEN" \
  "$PREVIEW_URL/api/admin/seed-bootstrap/export"
```

> ⚠️ Do **not** use `curl -I` to "ping" the endpoint — that sends a `HEAD` request and the route only accepts `GET`, so you'll get `405 Method Not Allowed`. A 405 here actually *confirms* the route exists; a missing route would return `404`.

### Step 2 — Sign in to production as super-admin
Go to `https://<your-prod-host>/login` and sign in with `superadmin@oryno.com` (or whatever the production super-admin is). Grab a fresh access token via curl (shown in Step 3).

### Step 3 — Dry-run via curl first (recommended)

```bash
# Grab a fresh access token
TOKEN=$(curl -s -X POST https://app.oryno.tech/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@oryno.com","password":"YOUR_PROD_PASSWORD"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['access_token'])")

# DRY RUN — see what would happen, doesn't write anything
curl -X POST https://app.oryno.tech/api/admin/seed-bootstrap \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./oryno_seed.json" \
  -F "dry_run=true" | jq
```

You should see `totals.inserted ≈ 290` and `updated = 0` on a brand-new production DB.

### Step 4 — Real import

```bash
curl -X POST https://app.oryno.tech/api/admin/seed-bootstrap \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@./oryno_seed.json" | jq
```

Idempotent: re-running with the same file is a no-op (everything will show as `updated: 0, skipped: N`). Re-running with a *newer* file refreshes existing docs and adds new ones.

### Step 5 — Verify in the UI
- `Super-Admin → Operators` — should now list 7 operators
- `Cinema` → see 5 films + 28 showtimes
- `Hotels` → see 17 hotels with 40 rooms
- etc.

### Step 6 — Re-invite operator owners
For each operator that arrived ownerless, use the wizard:

`Super-Admin → Operators → [pick operator] → Add team member` → choose role `owner` → enter their real email.

They'll get a verification email + must-rotate-password modal on first login (already wired).

## Audit trail

Every import run writes a row to `activity_logs` with:
- The super-admin who ran it
- File name + format version
- Per-collection insert/update/skip counts
- Source DB name + export timestamp

Browse via `Super-Admin → Audit Logs` and filter by action `admin.seed_bootstrap.imported`.

## Regenerating the bundle

If you need a fresh snapshot (e.g. preview keeps evolving and you want to top up production):

```bash
cd /app/backend && python3 scripts/export_catalogue.py /app/oryno_seed.json
```

The script is safe to run any time — read-only against the source.
