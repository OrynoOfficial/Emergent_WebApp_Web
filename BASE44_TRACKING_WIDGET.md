# Oryno Public Tracking Widget — integration snippet (Base 44)

The public tracking endpoint now returns photo data:

```
GET https://YOUR-BACKEND.example.com/api/packages/track/{TRACKING_NUMBER}

{
  "tracking_number": "ORYNO-303RDZHI",
  "status": "delivered",                    // pending | picked_up | in_transit | out_for_delivery | delivered | cancelled
  "description": "...",
  "origin": "Yaoundé",
  "destination": "Douala",
  "estimated_delivery": "2026-05-04",
  "weight": 2.0,
  "current_location": "Receiver Door",
  "vehicle": "Truck CE-1234",

  // NEW — sender's photos taken at booking
  "package_photos": [
    "/api/static/package_bookings/uuid1.jpg",
    "/api/static/package_bookings/uuid2.jpg",
    "/api/static/package_bookings/uuid3.jpg"
  ],

  // NEW — operator's proof-of-delivery photos (only present after the
  //       operator marks the package as delivered)
  "delivery_photos": [
    "/api/static/package_pod/pod1.jpg",
    "/api/static/package_pod/pod2.jpg",
    "/api/static/package_pod/pod3.jpg"
  ],

  "events": [
    {
      "status": "delivered",
      "title": "Delivered",
      "description": "Handed over",
      "timestamp": "2026-05-02T10:11:12",
      "location": "Receiver Door",
      // NEW — event-level photos (currently used for the delivered event)
      "photos": ["/api/static/package_pod/pod1.jpg", ...]
    }
  ]
}
```

> **Important** — image URLs are returned as **relative paths** (`/api/static/...`).
> You must prefix them with the backend origin to render them.

---

## Drop-in HTML/JS update for your Base 44 widget

```html
<!-- Add this CSS once -->
<style>
  .oryno-photos      { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
  .oryno-photos img  { width: 100%; aspect-ratio: 1 / 1; object-fit: cover; border-radius: 12px;
                       box-shadow: 0 2px 6px rgba(0,0,0,.08); cursor: zoom-in; transition: transform .15s; }
  .oryno-photos img:hover { transform: scale(1.03); }
  .oryno-section h4  { margin: 20px 0 8px; font-size: 13px; text-transform: uppercase;
                       letter-spacing: .5px; color: #6b7280; }
  .oryno-pod-banner  { background:#ecfdf5; border:1px solid #a7f3d0; color:#065f46;
                       padding:10px 14px; border-radius:10px; font-size:13px;
                       display:flex; align-items:center; gap:8px; margin-top:14px; }
</style>

<script>
  // ⚠ IMPORTANT — keep this URL in sync with your live Oryno backend.
  // Each Emergent preview/deploy gets its own URL; if tracking shows
  // "No package found" on Base 44, the most common cause is this constant
  // pointing to a previous (stale) deployment URL.
  // Current backend (May 2026):
  const ORYNO_BACKEND = "https://delivery-platform-108.preview.emergentagent.com";
  const fullUrl = (u) => (u && u.startsWith("/")) ? ORYNO_BACKEND + u : u;

  function renderOrynoPhotos(label, urls) {
    if (!urls || !urls.length) return "";
    const imgs = urls.map((u, i) =>
      `<img src="${fullUrl(u)}" alt="${label} ${i + 1}" loading="lazy"
            onclick="window.open('${fullUrl(u)}', '_blank')" />`
    ).join("");
    return `
      <div class="oryno-section">
        <h4>${label}</h4>
        <div class="oryno-photos">${imgs}</div>
      </div>`;
  }

  async function trackOryno(trackingNumber, mountEl) {
    // Always trim + uppercase before sending — the Oryno API also normalises
    // on its end, but this avoids round-trip 404s on stray whitespace.
    const tn = String(trackingNumber || "").trim().toUpperCase();
    const res = await fetch(`${ORYNO_BACKEND}/api/packages/track/${encodeURIComponent(tn)}`);
    if (!res.ok) {
      mountEl.innerHTML = `<p>Tracking number not found.</p>`;
      return;
    }
    const data = await res.json();

    let html = `
      <h3>${data.origin} → ${data.destination}</h3>
      <p><strong>Status:</strong> ${data.status.replace(/_/g, " ")}</p>
      <p><strong>ETA:</strong> ${data.estimated_delivery || "—"}</p>
    `;

    // Sender's photos taken at booking
    html += renderOrynoPhotos("Package photos (at pickup)", data.package_photos);

    // Operator's proof-of-delivery
    if (data.delivery_photos && data.delivery_photos.length) {
      html += `<div class="oryno-pod-banner">
                 ✓ Proof of delivery received from operator
               </div>`;
      html += renderOrynoPhotos("Proof of delivery", data.delivery_photos);
    }

    // Timeline (events)
    html += `<div class="oryno-section"><h4>Timeline</h4>`;
    data.events.forEach(ev => {
      html += `<div style="margin-bottom:12px;">
                 <strong>${ev.title}</strong>
                 <span style="color:#6b7280">— ${new Date(ev.timestamp).toLocaleString()}</span>
                 <p style="margin:2px 0 0; color:#4b5563;">${ev.description}${ev.location ? ` · ${ev.location}` : ""}</p>
                 ${renderOrynoPhotos("Event photos", ev.photos)}
               </div>`;
    });
    html += `</div>`;

    mountEl.innerHTML = html;
  }

  // wire your form / button to call:
  //   trackOryno("ORYNO-XXXXXX", document.getElementById("track-result"));
</script>

<div id="track-result"></div>
```

### What changes from the previous integration
1. New top-level `package_photos[]` and `delivery_photos[]` arrays — render them as image grids.
2. New per-event `photos[]` array (used for the `delivered` event today, future-proof for any event).
3. **All photo URLs are relative paths** prefixed with `/api/static/...`. Always concatenate `ORYNO_BACKEND` before using them in `<img src>`.
4. The `delivery_photos` array is empty until the operator marks the package as delivered with 3 PoD photos — your UI should treat empty arrays gracefully.
