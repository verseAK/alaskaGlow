# Alaska Glow — Technical Specification
**Project:** alaskaglow.com — Aurora forecast website for Alaska  
**Stack:** Next.js 14 (App Router) on Netlify  
**Last Updated:** February 24, 2026

---

## Overview

Alaska Glow is an aurora forecast website that answers one question for each Alaska location: **"Can I see the northern lights tonight?"**

It combines multiple real-time data sources (geomagnetic activity, cloud cover, darkness, moon phase) into a simple composite score with a traffic-light rating for 6 Alaska locations. The site targets both Alaska residents and tourists planning aurora viewing trips.

---

## Phase 1: Data Pipeline

### Task 1.1: NOAA Data Fetching Module

Create a data fetching module that pulls from these NOAA SWPC endpoints. All return JSON, no authentication required, no rate limits published (but be respectful — cache results for 5 minutes minimum).

#### Source 1: Kp Index Forecast (3-hour blocks)
- **URL:** `https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json`
- **Format:** Array of arrays: `["time_tag", "kp", "observed", "noaa_scale"]`
- **Update frequency:** Every 15 minutes
- **Usage:** Get forecast Kp values for the next 24-72 hours. Rows where `observed` = `"observed"` are historical; rows where `observed` = `"estimated"` or `null` are forecasts.
- **Example row:** `["2026-02-24 03:00:00", "5.67", "estimated", "G1"]`

#### Source 2: Current Kp (1-minute resolution)
- **URL:** `https://services.swpc.noaa.gov/json/planetary_k_index_1m.json`
- **Format:** Array of objects: `{time_tag, kp_index, estimated_kp, kp}`
- **Update frequency:** Every minute
- **Usage:** Get the current real-time estimated Kp. Use the last entry in the array for the most recent value. `estimated_kp` is the numeric value to use.

#### Source 3: OVATION Aurora Model
- **URL:** `https://services.swpc.noaa.gov/json/ovation_aurora_latest.json`
- **Format:** `{Observation Time, Forecast Time, Data Format, coordinates: [[lon, lat, aurora], ...]}`
- **Grid:** 360×181 (1-degree resolution, longitude 0-359, latitude -90 to 90)
- **Update frequency:** Every 5 minutes
- **Usage:** Extract aurora probability for each of our 6 locations by finding the nearest grid point. The `aurora` value is the probability/intensity (higher = better). This gives location-specific aurora probability beyond what Kp alone provides.

#### Source 4: Solar Wind Bz Component
- **URL:** `https://services.swpc.noaa.gov/products/solar-wind/mag-2-hour.json`
- **Format:** Array of arrays: `["time_tag", "bx_gsm", "by_gsm", "bz_gsm", "lon_gsm", "lat_gsm", "bt"]`
- **First row is headers.** Skip it.
- **Update frequency:** Every ~2 minutes
- **Usage:** Use the last entry's `bz_gsm` value. Negative Bz (southward) is favorable for aurora. Bz below -5 nT is a significant boost; below -10 nT is strong.

### Task 1.2: NWS Cloud Cover Fetching

#### Source 5: NWS Hourly Forecast (Cloud Cover)
- **Step 1 (build time only):** Look up grid coordinates for each location:
  `GET https://api.weather.gov/points/{lat},{lon}`
  Response contains `properties.gridId` (office code), `properties.gridX`, `properties.gridY`.
- **Step 2 (runtime):** Fetch hourly forecast:
  `GET https://api.weather.gov/gridpoints/{office}/{gridX},{gridY}/forecast/hourly`
  Response contains `properties.periods[]` — each period has `skyCover.value` (percentage, 0-100).
- **Headers required:** `User-Agent: alaskaglow.com (contact@alaskaglow.com)` — NWS requires this.
- **Update frequency:** Hourly is fine. Cache aggressively.
- **Usage:** Get cloud cover % for the next 12 hours for each location. This is the timeline approach — not just current cloud cover, but when clear windows might open.

#### NWS Grid Coordinates (Look these up at build time)

| Location | Lat | Lon | NWS Office |
|---|---|---|---|
| Fairbanks | 64.84 | -147.72 | AFG |
| Anchorage | 61.22 | -149.90 | AFC |
| Palmer-Wasilla | 61.60 | -149.11 | AFC |
| Denali | 63.73 | -148.91 | AFG |
| Kenai/Soldotna | 60.55 | -151.26 | AFC |
| Juneau | 58.30 | -134.42 | AJK |

Use `https://api.weather.gov/points/{lat},{lon}` to get the exact gridX and gridY for each. Store these as constants — they never change.

### Task 1.3: Darkness & Moon Calculations

Use the `suncalc` npm package (or equivalent) to calculate:

1. **Darkness window:** Astronomical twilight end → astronomical twilight start (next morning). Aurora is only visible when it's dark enough. In Alaska winter, this can be 18+ hours; in summer, it might be 0 hours.
2. **Moon phase:** 0 = new moon (best), 0.5 = full moon (worst). Moon illumination percentage.
3. **Moon rise/set times:** A bright moon above the horizon significantly reduces aurora visibility.

Calculate these for each location using their lat/lon coordinates.

### Task 1.4: Composite Scoring Function

For each location, compute a composite score (0-100) combining all factors:

#### Input Factors

| Factor | Weight | Source | Notes |
|---|---|---|---|
| Kp vs threshold | 35% | NOAA Kp forecast or real-time | How far above the location's visibility threshold |
| Cloud cover | 25% | NWS hourly forecast | Lower is better. Use the minimum cloud cover in the next 6 hours (cloud gaps) |
| Darkness | 15% | SunCalc | Binary: is it dark enough? Bonus for deep darkness. Zero score if not dark. |
| Moon | 10% | SunCalc | New moon = full points, full moon = 0. Moon below horizon = full points regardless of phase. |
| Bz bonus | 10% | NOAA solar wind | Bz < -5 nT adds bonus. Bz < -10 nT adds more. Positive Bz = 0 bonus. |
| OVATION probability | 5% | NOAA OVATION model | Direct aurora probability for the grid point |

#### Kp Scoring Detail

Each location has two thresholds from the table below:

| Location | Kp Visible | Kp Good Display |
|---|---|---|
| Fairbanks | 1 | 3 |
| Anchorage | 3 | 5 |
| Palmer-Wasilla | 3 | 5 |
| Denali | 2 | 3 |
| Kenai/Soldotna | 4 | 5 |
| Juneau | 5 | 6 |

- Kp below "Visible" threshold → Kp score = 0
- Kp at "Visible" threshold → Kp score = 40
- Kp at "Good Display" threshold → Kp score = 75
- Kp 2+ above "Good Display" → Kp score = 100
- Interpolate linearly between these points

#### Traffic Light Output

Map the composite score to a traffic light:

| Score Range | Rating | Label | Description |
|---|---|---|---|
| 75-100 | 🟢 | Great | High Kp + clear skies + dark + low moon |
| 50-74 | 🟡 | Possible | Moderate Kp, or partial clouds, or bright moon |
| 30-49 | 🟠 | Active but Cloudy | Good Kp but overcast — watch for cloud gaps |
| 0-29 | 🔴 | Unlikely | Low Kp, or overcast, or not dark enough |

**Special case:** If Kp is above threshold but cloud cover > 80%, use 🟠 "Active but Cloudy" regardless of composite score. This tells users "the aurora is happening but you can't see it — watch for breaks in the clouds."

**Special case:** If it's not dark (summer months, or daytime), always return 🔴 "Unlikely" with message "Not dark enough for aurora viewing."

### Task 1.5: Scheduled Data Refresh

Create a Netlify Scheduled Function that runs every 5-15 minutes:

1. Fetch all NOAA data sources (Kp forecast, current Kp, OVATION, solar wind Bz)
2. Fetch NWS cloud cover for all 6 locations (can be less frequent — every 30 min)
3. Calculate darkness/moon for all 6 locations
4. Run composite scoring for all 6 locations
5. Write results to a JSON blob (Netlify Blob Store or a static JSON file that gets committed)

**Output JSON structure:**

```json
{
  "updated_at": "2026-02-24T10:00:00Z",
  "current_kp": 3.67,
  "current_bz": -4.2,
  "locations": {
    "fairbanks": {
      "name": "Fairbanks",
      "lat": 64.84,
      "lon": -147.72,
      "score": 82,
      "rating": "great",
      "label": "Great",
      "kp_current": 3.67,
      "kp_threshold_visible": 1,
      "kp_threshold_good": 3,
      "cloud_cover_now": 15,
      "cloud_cover_min_6h": 10,
      "cloud_timeline": [
        {"hour": "10PM", "cover": 15},
        {"hour": "11PM", "cover": 10},
        {"hour": "12AM", "cover": 20}
      ],
      "is_dark": true,
      "darkness_start": "2026-02-24T02:30:00Z",
      "darkness_end": "2026-02-24T17:00:00Z",
      "moon_phase": 0.15,
      "moon_illumination": 22,
      "moon_above_horizon": false,
      "bz_current": -4.2,
      "ovation_probability": 45,
      "summary": "Excellent conditions tonight. Kp 3.7 well above Fairbanks threshold, mostly clear skies, and the crescent moon sets early."
    }
  },
  "kp_forecast": [
    {"time": "2026-02-24T03:00:00Z", "kp": 3.67, "type": "observed"},
    {"time": "2026-02-24T06:00:00Z", "kp": 4.00, "type": "forecast"}
  ]
}
```

### Task 1.6: Summary Generation (Template-Based)

Generate a plain-English summary for each location using templates (NO LLM calls — zero marginal cost):

**Template logic:**
- If rating is "great": "Excellent conditions tonight. Kp {kp} is well above the {location} threshold of {threshold}, {cloud_phrase}, and {moon_phrase}."
- If rating is "possible": "Moderate chance tonight. {primary_limiting_factor}. {suggestion}."
- If rating is "active_but_cloudy": "The aurora is active (Kp {kp}) but cloud cover is {cloud}%. Watch for breaks in the clouds {best_window}."
- If rating is "unlikely": "{primary_reason}. {next_good_window}."

Cloud phrases: "skies are mostly clear" / "expect partial clouds" / "overcast conditions"
Moon phrases: "the moon is below the horizon" / "a thin crescent moon won't interfere" / "the bright {phase} moon will wash out fainter displays"

---

## Phase 2: Frontend MVP

### Task 2.1: Homepage Dashboard

**Route:** `/`

The homepage shows all 6 locations at a glance with their current rating.

**Layout:**
- Hero: "Alaska Glow" title + "Can you see the aurora tonight?" tagline
- Current conditions bar: Current Kp, Bz direction, last updated timestamp
- 6 location cards in a grid (2 columns on desktop, 1 on mobile):
  - Location name
  - Traffic light indicator (colored circle or badge)
  - Rating label ("Great", "Possible", etc.)
  - Current Kp vs threshold
  - Cloud cover %
  - One-line summary
  - Link to location detail page
- Kp forecast chart (next 24-48 hours, simple bar or line chart)
- "What is Kp?" brief explainer with link to full article

**Design:**
- Dark theme (dark navy/black background — aurora viewing context)
- Green (#00ff88 or similar aurora green) as primary accent color
- Clean, high-contrast typography
- Mobile-first responsive design
- Subtle aurora-inspired gradients or glow effects (don't overdo it)

### Task 2.2: Location Detail Pages

**Route:** `/locations/[slug]` (e.g., `/locations/fairbanks`, `/locations/anchorage`)

Each location page shows detailed aurora viewing information:

- Large traffic light rating with label and summary
- Composite score breakdown showing each factor's contribution
- Cloud cover timeline (next 12 hours, bar chart showing % cover per hour)
- Darkness window visualization (when it gets dark, when it gets light)
- Moon phase and position
- Kp forecast for next 48 hours
- "Best viewing window tonight" — the hour(s) with the best combination of low clouds + darkness + Kp
- Location-specific tips (e.g., "Fairbanks: Head to Cleary Summit or Murphy Dome for dark skies")
- Viewing tips for this specific Kp threshold level

**Slug mapping:**
- `fairbanks` → Fairbanks
- `anchorage` → Anchorage
- `palmer-wasilla` → Palmer-Wasilla
- `denali` → Denali
- `kenai-soldotna` → Kenai/Soldotna
- `juneau` → Juneau

### Task 2.3: API Route

**Route:** `/api/aurora` (Next.js API route or Netlify Function)

Returns the current JSON blob from Task 1.5. This powers the frontend and can be consumed by third parties later.

**Headers:** CORS enabled, Cache-Control: max-age=300 (5 min)

---

## Phase 3: SEO Content Pages + Email Alerts

### Task 3.1: SEO Content Pages

Create static content pages targeting high-volume tourist search queries. Each page should be genuinely useful, well-written, and include real-time data widgets where relevant.

**Target pages (11 planned):**

1. `/guides/best-time-to-see-northern-lights-alaska` — Seasonal guide, solar cycle info, equinox advantage
2. `/guides/northern-lights-anchorage` — Anchorage-specific guide with live widget showing current Anchorage rating
3. `/guides/northern-lights-fairbanks` — Fairbanks guide with live widget
4. `/guides/northern-lights-denali` — Denali guide with live widget
5. `/guides/aurora-viewing-spots-alaska` — Overview of all 6 locations with comparison
6. `/guides/alaska-aurora-photography-guide` — Camera settings, lens recommendations, tripod tips
7. `/guides/what-is-kp-index` — Explainer of Kp, what the numbers mean for each Alaska location
8. `/guides/northern-lights-from-cruise-ship-alaska` — Guide for cruise tourists (September shoulder season)
9. `/guides/northern-lights-forecast-explained` — How our scoring works, what each factor means
10. `/guides/best-time-to-visit-alaska-for-aurora` — Travel planning guide with lodging, tours
11. `/guides/aurora-alerts-alaska` — Explanation of our alert system + signup CTA

**SEO requirements for each page:**
- Unique title tag and meta description
- H1 matching the target query
- Schema.org FAQ markup where appropriate
- Internal links to location pages and other guides
- 1,500-2,500 words of genuine, useful content (not filler)
- Open Graph tags for social sharing

### Task 3.2: Email Alert System (Resend)

**Service:** Resend (resend.com) — free tier, 100 emails/day

**Signup flow:**
1. User enters email + selects location(s) + sets minimum rating threshold (Great only, Possible+, etc.)
2. Store in a simple JSON file or Netlify Blob: `{email, locations: ["fairbanks", "anchorage"], threshold: "possible", subscribed_at, last_alert_at}`
3. Confirmation email via Resend with verification link

**Alert trigger logic (runs with each data refresh):**
1. For each subscriber, check if any of their selected locations crossed ABOVE their threshold since the last check
2. If yes, AND last_alert_at is more than 6 hours ago → send alert
3. Update last_alert_at

**Alert email template:**
- Subject: "🟢 Aurora Alert: Great conditions in Fairbanks tonight!"
- Body: Location name, rating, summary, link to location page, unsubscribe link
- Plain text + HTML versions

**Rate limiting:**
- Max 1 alert per user per 6 hours
- Max 2 alerts per user per 24 hours
- Global: Don't exceed 80 emails per day (leave buffer on 100/day free tier)

### Task 3.3: Sitemap and Robots.txt

Generate `sitemap.xml` including all location pages, guide pages, and the homepage.
Standard `robots.txt` allowing all crawlers.
Submit sitemap to Google Search Console.

---

## Phase 4: Monetization (Future)

### Affiliate links
- Aurora tour operators in Fairbanks (Face The Outdoors, Alaska Photo Treks, Borealis Basecamp)
- Photography gear (Amazon Associates — camera, tripod, lens recommendations)
- Alaska lodging (booking.com, hotels with aurora viewing)

### Display ads
- Google AdSense once traffic exceeds 10K monthly pageviews
- Travel content commands premium CPMs ($15-30 RPM)

### Premium alerts
- If demand proven: $3-5/month for SMS alerts, custom Kp thresholds, 15-min refresh
- Only consider after 1,000+ email subscribers

---

## Technical Notes

### Netlify Configuration (`netlify.toml`)

```toml
[build]
  command = "npm run build"
  publish = ".next"

[build.environment]
  NODE_VERSION = "20"

[[plugins]]
  package = "@netlify/plugin-nextjs"

# Scheduled function for data refresh
[functions.aurora-refresh]
  schedule = "*/10 * * * *"
```

### Environment Variables (set in Netlify dashboard)

- `RESEND_API_KEY` — from Resend dashboard (Phase 3)
- No other secrets needed — all NOAA/NWS APIs are public

### Dependencies

```json
{
  "dependencies": {
    "next": "^14",
    "react": "^18",
    "react-dom": "^18",
    "suncalc": "^1.9.0"
  }
}
```

Add `resend` package in Phase 3.

### Error Handling

- If any NOAA endpoint is down: serve stale data with "Last updated X minutes ago" warning
- If NWS is down: show "Cloud data temporarily unavailable" but still show Kp-based rating
- Never show a blank page — always show the last known good data

### Performance

- All data fetching happens server-side in scheduled functions
- Frontend only reads a static JSON blob — no client-side API calls to NOAA
- Pages should be statically generated with ISR (Incremental Static Regeneration) or revalidate every 5 minutes
- Target: < 2 second page load on mobile

---

## File Structure

```
alaskaGlow/
├── SPEC.md                          # This file
├── README.md
├── netlify.toml
├── package.json
├── next.config.js
├── public/
│   ├── favicon.ico
│   └── og-image.png
├── src/
│   ├── app/
│   │   ├── layout.js                # Root layout (dark theme, fonts)
│   │   ├── page.js                  # Homepage dashboard
│   │   ├── locations/
│   │   │   └── [slug]/
│   │   │       └── page.js          # Location detail pages
│   │   ├── guides/
│   │   │   └── [slug]/
│   │   │       └── page.js          # SEO content pages
│   │   └── api/
│   │       └── aurora/
│   │           └── route.js         # JSON API endpoint
│   ├── lib/
│   │   ├── noaa.js                  # NOAA data fetchers
│   │   ├── nws.js                   # NWS cloud cover fetcher
│   │   ├── scoring.js               # Composite scoring logic
│   │   ├── darkness.js              # SunCalc darkness/moon calculations
│   │   ├── summary.js               # Template-based summary generator
│   │   ├── locations.js             # Location data constants
│   │   └── alerts.js                # Email alert logic (Phase 3)
│   ├── components/
│   │   ├── LocationCard.js          # Dashboard location card
│   │   ├── RatingBadge.js           # Traffic light indicator
│   │   ├── KpChart.js               # Kp forecast chart
│   │   ├── CloudTimeline.js         # Cloud cover timeline
│   │   ├── DarknessWindow.js        # Darkness visualization
│   │   └── AlertSignup.js           # Email signup form (Phase 3)
│   └── data/
│       └── aurora-latest.json       # Current data blob (written by scheduled function)
└── netlify/
    └── functions/
        └── aurora-refresh.js        # Scheduled data refresh function
```
