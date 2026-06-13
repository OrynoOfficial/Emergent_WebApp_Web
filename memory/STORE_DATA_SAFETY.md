# Oryno — App Store Data Safety Disclosure

This document is the **single source of truth for the Apple App Store Privacy Nutrition Labels and the Google Play Data Safety form**. When submitting either app, paste the relevant section into the respective console — they match the platforms' exact field names.

> 📌 **Update rule**: every time you add a new screen that asks for new data (camera, contacts, location, etc.) or wire a new analytics SDK, **update this file in the same PR**. The two stores audit submissions for "missed data points" and reject re-submissions when reality drifts from this manifest.

---

## 1 · Data points Oryno collects

| # | Data point | Source / collected when | Stored where | Linked to user? | Used for tracking? |
|---|---|---|---|---|---|
| 1 | **Email address** | Signup, invite, profile edit | MongoDB `users.email` | Yes | No |
| 2 | **Phone number** | Signup, profile edit, OTP recovery | MongoDB `users.phone` | Yes | No |
| 3 | **Full name** | Signup, profile edit | MongoDB `users.full_name` | Yes | No |
| 4 | **Profile photo** | Profile upload | Emergent S3-compatible object storage | Yes | No |
| 5 | **Hashed password** | Signup, password reset | MongoDB `users.password_hash` (bcrypt) | Yes | No |
| 6 | **Two-factor secret** (optional) | 2FA enrolment | MongoDB `users.two_fa_secret` (encrypted at rest) | Yes | No |
| 7 | **Government ID document** (operator KYC only) | Operator onboarding | Object storage, encrypted | Yes | No |
| 8 | **Approximate location** | Cinema/hotel "near me" search (browser geolocation, opt-in) | Not persisted server-side — used only to filter the search response in-memory | No | No |
| 9 | **Device language** | First page load | localStorage `oryno_lang` (client-only) | No | No |
| 10 | **Booking history** (showtimes, restaurants, hotels, laundry, parcels) | Every successful checkout | MongoDB `bookings`, `orders` | Yes | No |
| 11 | **Payment method (last 4 digits, brand)** | Stripe checkout | Stripe (PCI scope; only `payment_method_id` stored in Oryno DB) | Yes | No |
| 12 | **Support ticket messages** | Customer Service module | MongoDB `support_tickets` | Yes | No |
| 13 | **Operator team scopes & permissions** | Admin/operator onboarding | MongoDB `users.permissions`, `users.scoped_permissions` | Yes | No |
| 14 | **In-app product reviews / ratings** | Customer post-purchase | MongoDB `ratings` | Yes | No |
| 15 | **Crash reports / diagnostics** | Sentry (post-launch) | Sentry SaaS | Anonymous device-id only | No |
| 16 | **Approximate geolocation** (server-derived from IP) | Every authenticated request | MongoDB `audit_logs` (90-day TTL) | Yes | No |

Tracking definition (Apple): we **do not** share any of the above with third-party data brokers or advertising networks. No SDK in the app links Oryno data with data from other apps/websites.

---

## 2 · Apple App Store — Privacy Nutrition Labels

Map of Apple's three privacy tiers → Oryno's data points above.

### Data used to track you
*(none)*

### Data linked to you
- **Contact Info**: Name, Email Address, Phone Number, Physical Address (only for parcel deliveries)
- **Health & Fitness**: *(none)*
- **Financial Info**: Payment Info (last 4, brand only — full PAN stays at Stripe)
- **Location**: Coarse Location (only when user explicitly taps "near me")
- **Sensitive Info**: *(none)*
- **Contacts**: *(none)*
- **User Content**: Photos (profile picture, KYC documents for operators), Customer Support
- **Browsing History**: *(none)*
- **Search History**: *(none)*
- **Identifiers**: User ID
- **Purchases**: Purchase History
- **Usage Data**: Product Interaction
- **Diagnostics**: Crash Data, Performance Data (post-Sentry launch)
- **Other Data**: *(none)*

### Data not linked to you
- **Diagnostics**: Crash Data (anonymous device-id from Sentry until user logs in)
- **Identifiers**: Device ID (Sentry only)

---

## 3 · Google Play — Data Safety form

Paste the following into each section of the Data Safety questionnaire.

### Data collection & security
- **Is all user data encrypted in transit?** → **Yes** (TLS 1.3 via Cloudflare + uvicorn).
- **Do you provide a way for users to request that their data be deleted?** → **Yes** (Settings → Privacy → "Delete my account" — wipes user doc, anonymises bookings, GDPR Article 17 compliant).
- **Has the app been independently validated against a global security standard?** → No (not yet — SOC 2 Type I is on the roadmap).

### Personal info
| Field | Collected? | Shared? | Optional? | Purpose |
|---|---|---|---|---|
| Name | Yes | No | No | Account management |
| Email | Yes | No | No | Account, App functionality, Communications |
| Phone | Yes | No | No | Account, Communications |
| User IDs | Yes | No | No | Account management |
| Address | Yes | No | Yes | App functionality (parcel deliveries) |
| Race & ethnicity | No | — | — | — |
| Political/religious beliefs | No | — | — | — |
| Sexual orientation | No | — | — | — |
| Other personal info | No | — | — | — |

### Financial info
| Field | Collected? | Shared? | Optional? | Purpose |
|---|---|---|---|---|
| User payment info | Yes | No (Stripe processes — see below) | No | App functionality (checkout) |
| Purchase history | Yes | No | No | App functionality, Analytics |
| Credit score | No | — | — | — |
| Other financial info | No | — | — | — |

> Stripe processes the full PAN under PCI-DSS scope. Oryno only stores `payment_method_id` and last-4 / brand for receipts. This split is the standard "Stripe is the data processor" pattern.

### Location
| Field | Collected? | Shared? | Optional? | Purpose |
|---|---|---|---|---|
| Approximate location | Yes | No | **Yes** | App functionality ("near me" search) |
| Precise location | No | — | — | — |

### Messages
| Field | Collected? | Shared? | Optional? |
|---|---|---|---|
| Emails | No | — | — |
| SMS or MMS | No | — | — |
| Other in-app messages | Yes (support tickets) | No | Yes |

### Photos and videos
| Field | Collected? | Shared? | Optional? |
|---|---|---|---|
| Photos | Yes (avatar + operator KYC docs) | No | Avatar optional, KYC mandatory for operators only |
| Videos | No | — | — |

### App activity
| Field | Collected? | Shared? | Optional? |
|---|---|---|---|
| App interactions | Yes | No | No |
| In-app search history | No | — | — |
| Installed apps | No | — | — |
| Other user-generated content | Yes (reviews) | Yes — reviews are public | Yes |
| Other actions | No | — | — |

### App info and performance
| Field | Collected? | Shared? | Optional? |
|---|---|---|---|
| Crash logs | Yes (Sentry — post-launch) | Yes (sent to Sentry, our processor) | No |
| Diagnostics | Yes (Sentry — post-launch) | Yes | No |
| Other app performance data | No | — | — |

### Device or other IDs
| Field | Collected? | Shared? | Optional? |
|---|---|---|---|
| Device or other IDs | Yes (Sentry device-id, app install token for push) | Yes (Sentry, FCM) | No |

---

## 4 · Required policy URLs

Put these on the marketing site **before** submitting to either store. Both apps' listings need them filled in:

- Privacy Policy → `https://oryno.tech/privacy`
- Terms of Use → `https://oryno.tech/terms`
- Support → `https://oryno.tech/contact`

These three URLs already work (the gate modal links to them today).

---

## 5 · Data deletion endpoint (Google Play requirement, Apple recommendation)

Google Play **requires** an in-app + web-accessible way for the user to request account deletion. Oryno already supports this via `Settings → Privacy → Delete my account` which calls `DELETE /api/users/me/self`. Document the web entry point on the marketing site at `https://oryno.tech/delete-account` (a copy of the in-app explanation + a "sign in to delete" CTA).

---

## 6 · Changelog
- **2026-02-13** — initial draft (E1 fork agent).
