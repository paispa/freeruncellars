# CLAUDE.md — Free Run Cellars Website

This document provides guidance for AI assistants working on the Free Run Cellars website codebase.

## Project Overview

**Free Run Cellars** is a boutique winery website for a family-owned estate in Berrien Springs, Michigan (90 minutes from Chicago), owned by Trish Slevin & Prashanth Pais. The philosophy is *Atithidevo Bhav* — "the guest is akin to God."

- **Live site:** https://freeruncellars.com
- **GitHub:** https://github.com/paispa/freeruncellars
- **Hosting:** Vercel (auto-deploys from GitHub `main` branch)
- **Preview URL:** https://freeruncellars.vercel.app

---

## Tech Stack

This is a **pure static HTML website** — no npm, no build process, no frameworks.

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML, CSS (inline), vanilla JavaScript |
| Hosting | Vercel (static + serverless functions) |
| Serverless API | Node.js (Vercel Functions in `/api/`) |
| AI Chat | Anthropic Claude API (claude-haiku model) |
| Email | EmailJS (photo booth) · Brevo (Owners Circle, contact form, chat leads) |
| Analytics | Google Analytics 4 (G-T51K1F9DVS) |
| DNS redirect | vercel.json (frcwine.com + www.frcwine.com → freeruncellars.com) |
| Images | Local `/public/images/` + GoDaddy CDN |

**There is no package.json, no build step, no transpilation.** Edit files directly.

---

## Repository Structure

```
freeruncellars/
├── index.html                    # Homepage (main entry point, ~1,924 lines)
├── chat-bubble.html              # Embeddable AI chat widget
├── vercel.json                   # Vercel config + DNS redirect (frcwine.com → www)
├── README.md                     # Project documentation for humans
├── CLAUDE.md                     # This file
├── test-api-handlers.js          # Node.js unit tests for api/_helpers.js logic (run with: node test-api-handlers.js)
├── .gitignore                    # Excludes .DS_Store, node_modules, .env, logs
│
├── api/                          # Vercel serverless functions
│   ├── _helpers.js               # Shared utilities: CORS, rate limiting, escapeHtml, validation constants
│   ├── brevo.js                  # Unified Brevo endpoint — routes by type: circle, contact, lead, wifi
│   ├── chat.js                   # AI chat assistant (Anthropic Claude Haiku)
│   ├── calendar.js               # Outlook ICS calendar proxy (CORS workaround)
│   ├── upload-photo.js           # Photo booth image storage (Vercel Blob)
│   ├── poynt-auth.js             # Poynt OAuth2 token management (JWT signing + caching)
│   └── poynt-sales.js            # Poynt POS sales data, flight allocation, inventory predictions
│
├── pages/                        # All public content pages
│   ├── about.html                # Our Story / owner bios
│   ├── wines.html                # Wine menu, flights, cocktails
│   ├── events-calendar.html      # Live events (ICS feed from Outlook)
│   ├── live-music-sundays.html   # Live music SEO landing page
│   ├── event-packages.html       # Private events & wedding pricing
│   ├── gallery.html              # Photo gallery with lightbox
│   ├── contact.html              # Hours, map, contact form
│   ├── reviews.html              # Links to Google/Yelp/Facebook reviews
│   └── circle.html               # ⚠️ Owners Circle — NOT linked publicly, share URL directly
│
├── tools/                        # Internal staff utilities (not linked publicly)
│   ├── dashboard.html            # Sales dashboard (Poynt POS integration, password-protected)
│   ├── post-generator.html       # AI-powered Facebook post generator
│   ├── photobooth.html           # Event photo booth (camera + email via EmailJS)
│   ├── email-template-single.html  # EmailJS template — single photo
│   └── email-template-strip.html   # EmailJS template — 3-photo composited strip
│
├── assets/
│   └── docs/
│       └── photo-library.md      # Photo inventory and CDN URLs
│
└── public/
    └── images/                   # 40+ high-res photos (~196 MB)
```

---

## Key Files

### `api/_helpers.js`
Shared utilities imported by all API handlers. Exports:
- `ALLOWED_ORIGINS` — CORS allowlist (`freeruncellars.com`, `www.freeruncellars.com`, `freeruncellars.vercel.app`)
- `applyCors(req, res)` — sets `Access-Control-Allow-Origin` for known browser origins; allows no-Origin requests (curl, server-to-server) through without restriction; returns `false` for unknown browser origins
- `makeRateLimiter(max, windowMs)` — factory returning a per-IP in-memory rate-limiter function
- `getClientIp(req)` — reads `x-forwarded-for` or falls back to `socket.remoteAddress`
- `escapeHtml(str)` — HTML-encodes `& < > " '` for safe email body interpolation
- `DATA_URI_RE`, `ALLOWED_MIME_TYPES`, `MAX_IMAGE_BYTES` — upload validation constants
- `INTERESTS_MAP`, `normalizePhone(phone)` — Owners Circle business logic

### `api/brevo.js`
Unified Brevo endpoint. Routes by `type` field in the POST body:
- `circle` — Owners Circle signup: validates fields + honeypot, adds/updates contact in the Owners Circle Brevo list, sends notification email to `contact@frcwine.com`. Rate-limited to 5/IP/10 min.
- `contact` — Contact form inquiry: validates fields + honeypot, sends inquiry notification email; optionally adds contact to mailing list (Brevo list 11) when `optIn` is true. Rate-limited to 5/IP/10 min.
- `lead` — Chat widget lead capture: receives name + email from the chat bubble, emails `contact@frcwine.com`. Rate-limited to 10/IP/hour.
- `wifi` — WiFi guest sign-up: creates/updates contact in Brevo with `WIFI_VISITS`, `WIFI_LAST_VISIT`, and optional newsletter/SMS list membership. Rate-limited to 10/IP/10 min.

All types share the same CORS allowlist and use `api/_helpers.js`. Requires `BREVO_API_KEY`; circle type also requires `BREVO_CIRCLE_LIST_ID`; wifi type also uses `BREVO_NEWSLETTER_LIST_ID` and `BREVO_SMS_LIST_ID`.

### `api/chat.js`
Anthropic Claude Haiku chatbot for the winery website. Key details:
- Uses `ANTHROPIC_API_KEY` environment variable (set in Vercel project settings)
- System prompt contains: wine menu, hours, pricing, property facts, event packages
- Max 400 tokens per response, maintains 10-message conversation history
- CORS restricted to `ALLOWED_ORIGINS`; rate-limited to 30 requests/IP/min

### `api/calendar.js`
CORS proxy for the Outlook ICS calendar feed. Caches for 5 minutes with 10-minute stale-while-revalidate. Falls back through three CORS proxy services if the primary fails.

### `api/upload-photo.js`
Receives a base64 image from the photo booth, uploads binary to Vercel Blob, and returns the public URL. Requires `BLOB_READ_WRITE_TOKEN` environment variable (set in Vercel dashboard under Storage → Blob store → token).
- Validates data URI format and MIME type (`image/jpeg`, `image/png`, `image/webp` only)
- Enforces a 5 MB cap on the decoded buffer
- Rate-limited to 10 uploads/IP/min

### `api/poynt-auth.js`
Poynt OAuth2 token management. Signs a self-issued JWT (RS256) using the app's private key, exchanges it for an access token at `services.poynt.net/token`, and caches the token in memory with a 60-second safety margin before expiry. Also exposes a diagnostic HTTP handler (POST with dashboard password) that returns a token preview.
- Uses `POYNT_APP_ID` and `POYNT_PRIVATE_KEY` environment variables
- Private key stored in Vercel env var with `\n`-escaped newlines (decoded at runtime)
- Rate-limited to 10 requests/IP/min

### `api/poynt-sales.js`
Fetches orders from the Poynt POS API and returns aggregated sales data. Key features:
- **Flight allocation**: distributes flight revenue equally across member wines (e.g. "Dry White Flight" → Dry Riesling + Pinot Gris + Fusion)
- **Inventory predictions**: given starting case counts, computes bottles used, remaining cases, bottles/day velocity, and runway (days until depletion)
- Paginates through up to 2,000 orders per request
- Returns summary metrics, per-wine breakdown, daily revenue timeline, and inventory results
- Rate-limited to 10 requests/IP/min; requires `DASHBOARD_PASSWORD`

### `tools/dashboard.html`
Password-protected staff sales dashboard (noindex, not linked from site). Dark-themed UI matching photobooth/post-generator style.
- **Quick-select date range**: This Week, Last 30 Days, This Month, Year to Date
- **Summary metrics**: total revenue, transaction count, top wine
- **Revenue timeline**: SVG line chart with daily data points
- **Sales by wine table**: glasses, bottles, flight shares, and revenue per wine
- **Inventory tracker**: enter starting case counts (persisted in localStorage), see bottles used, remaining cases, and depletion runway predictions with velocity (btl/day)

### `tools/photobooth.html`
CONFIG is filled in at the top of the file (keys committed to repo). For a 3-photo session the browser composites all three frames into one vertical film-strip canvas (dark background, FRC logo centred at the bottom) before uploading — so only a single image is stored and emailed.

Email templates live in `tools/email-template-single.html` and `tools/email-template-strip.html`. Paste their HTML into the corresponding EmailJS templates in the dashboard whenever they change.

```js
const CONFIG = {
  emailjs_public_key:       '...',
  emailjs_service_id:       '...',
  emailjs_template_single:  '...',   // single-photo EmailJS template ID
  emailjs_template_strip:   '...',   // strip EmailJS template ID
  godaddy_payment_url:      '...',
}
```

---

## Environment Variables

| Variable | Used In | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | `api/chat.js` | Anthropic API key for chat assistant |
| `BLOB_READ_WRITE_TOKEN` | `api/upload-photo.js` | Vercel Blob store token for photo storage |
| `BREVO_API_KEY` | `api/brevo.js` | Brevo API key (xkeysib-…) |
| `BREVO_CIRCLE_LIST_ID` | `api/brevo.js` | Numeric ID of the "Owners Circle" Brevo list |
| `BREVO_NEWSLETTER_LIST_ID` | `api/brevo.js` | Numeric ID of the newsletter Brevo list (WiFi signup) |
| `BREVO_SMS_LIST_ID` | `api/brevo.js` | Numeric ID of the SMS/text-alerts Brevo list (WiFi signup) |
| `POYNT_APP_ID` | `api/poynt-auth.js` | Poynt application ID (from Poynt Developer Portal) |
| `POYNT_PRIVATE_KEY` | `api/poynt-auth.js` | PEM-encoded RSA private key with `\n`-escaped newlines |
| `POYNT_BUSINESS_ID` | `api/poynt-sales.js` | Poynt business UUID (from HQ dashboard or terminal) |
| `DASHBOARD_PASSWORD` | `api/poynt-sales.js` | Staff password for the sales dashboard |

Set these in **Vercel project settings**, not in the repo.

---

## Brand Standards

### Colors
| Role | Hex | Notes |
|------|-----|-------|
| Primary teal | `#537f71` | PMS 625C — main brand color |
| Dark teal | `#3d6155` | Hover states, accents |
| Light teal | `#7aab9a` | Backgrounds |
| Pale teal | `#eef4f1` | Section backgrounds |
| Grey | `#707271` | Secondary text |

### Typography
| Role | Font | Fallback |
|------|------|---------|
| Body/headings | Jost (Google Fonts) | sans-serif |
| Accent/display | Cormorant Garamond (Google Fonts) | serif |

Both fonts are loaded via Google Fonts CDN in each HTML file's `<head>`.

### Logo
Self-hosted horizontal logo:
```
/public/images/free-run-cellars-logo-horizontal-black-323a89.webp
```
Use the full absolute URL in email templates and canvas contexts (photobooth film strip):
```
https://freeruncellars.com/public/images/free-run-cellars-logo-horizontal-black-323a89.webp
```
Wine press logo: `/public/images/FR_WinePress.png` (self-hosted PNG). Used in the nav (`.nav-press`, 48px, `margin-top:4px` for visual alignment) and as a footer stamp (90px, centred, `opacity:.3`) on all pages.

### Image CDN Base URL
Large hero/gallery photos only — **not** for logos or brand assets:
```
https://img1.wsimg.com/isteam/ip/e003f7b8-bd50-4872-a2d0-83a80d992e8e/
```

---

## Wine Menu

All wines are available by glass and bottle unless noted. When adding or changing wines, update both `pages/wines.html` and the system prompt in `api/chat.js`.

### Whites & Off-Whites

| Wine | Style | Tasting Notes | Flag |
|------|-------|---------------|------|
| Sur Lie Albariño | Dry · RS 0% | Honeysuckle, Almond Croissant, White Peach | |
| Dry Riesling | Dry · RS 0% | Apple, White Peach, Limestone | |
| Pinot Gris | Off-Dry · RS 0.25% | Yellow Pear, Lime Zest, Slate | 🍇 Estate Grown |
| Fusion | Off-Dry · RS 0.25% | Nectarine, Limestone, Green Apple | |
| Pinot Blanc | Semi-Dry · RS 0.3% | Apple, Yellow Plum, Honeydew | |
| Semi-Dry Albariño | Semi-Dry · RS 2.5% | White Peach, Honeysuckle, Lemon | |
| Mezzo | Sweet · RS 3.5% | Orange Blossom, Lime, Apple | |
| Valvin Muscat | Sweet · RS 5% | Grapefruit, Lemon, Lime | |

### Rosé & Reds

| Wine | Style | Tasting Notes |
|------|-------|---------------|
| Rosé | Dry · RS 0% | Strawberry, Red Currant, Kiwi |
| Pinot Noir | Dry · RS 0% | Plum, Fig, Cedar |
| Syrah | Dry · RS 0% | Tomato, Blackberry, Cherry |
| Lemberger | Dry · RS 0% | Leather, Oak, Chocolate |
| Meritage | Dry · RS 0% | Forest Floor, Cherry, Leather |
| Sangiovese Reserve | Dry · RS 0% | Sun-dried Tomato, Cherry, Oregano, Tobacco |
| Rosso | Semi-Sweet · RS 3% | Salal Berry, Black Plum, Sweet Tobacco |

### Coming Soon (Estate — Circle Members First)

| Wine | Style | Notes |
|------|-------|-------|
| Orange Ramato | Skin-contact orange wine | Estate Pinot Gris, first-ever estate release |
| Cabernet Blanc | TBD | Estate grown, to follow Ramato |

### Flights

| Flight | Price | Recommended Wines |
|--------|-------|-------------------|
| Dry Red Flight | $18 | Rosé, Lemberger, Meritage |
| Dry White Flight | $15 | Dry Riesling, Pinot Gris, Fusion |
| Sweet Flight | $15 | Mezzo, Valvin Muscat, Rosso |

### Wine Cocktails

| Cocktail | Price | Base |
|----------|-------|------|
| Espress-No Regrets | $14 | Pinot Gris · Honey Syrup · Coffee |
| Blood Orange Mule | $14 | Mezzo · Blood Orange · Ginger Beer |
| Lemberger Lemon Lift | $14 | Lemberger · Honey · Fresh Lemon |
| Campfire Confessions | $15 | Syrah · Hot Chocolate · Cacao Bitters |

### Chambong (Sparkling)
- Single: $12 · Four-pack: $40

---

## Business Information (Hardcoded in Pages)

**Hours:**
- Mon–Thu: By appointment only
- Fri: 2:00–6:00 PM
- Sat: 12:00–7:00 PM
- Sun: 2:00–6:00 PM (Live Music 3:00–5:00 PM)

**Contact:**
- Address: 10062 Burgoyne Road, Berrien Springs, MI 49103
- Phone: (269) 815-6885
- Email: contact@frcwine.com

**Event Packages:**
- Roped Off: $150 (25 guests, 3 hours)
- After Hours: $300 (25–75 guests, 3 hours after close)
- Wine All Day: $3,000 (up to 100 guests, full day)
- Weddings: Custom pricing

When updating business info (hours, prices, contact), search all HTML files — information is duplicated across pages.

---

## Development Workflow

### Making Changes
1. Edit HTML/CSS/JS directly — no build step needed
2. Test locally by opening HTML files in a browser, or use `npx serve .` for local server with API routes
3. Vercel serverless functions (`api/`) require the Vercel CLI to test locally: `npx vercel dev`

### Deployment
Pushing to `main` on GitHub triggers automatic Vercel deployment. The site is live within ~30 seconds.

```bash
git add <files>
git commit -m "descriptive message"
git push origin main
```

### Testing API Functions Locally
```bash
npx vercel dev   # starts local dev server at localhost:3000
```

---

## CSS Conventions

All CSS is **inline in `<style>` blocks** within each HTML file. There is no shared stylesheet.

- Use CSS custom properties (`--variable-name`) for repeated values within a page
- Responsive breakpoints use `@media (max-width: 767px)` for mobile (some older pages use `768px` — use `767px` on all new work)
- Animations use `@keyframes` defined inline
- Hover transitions typically `transition: all 0.3s ease`

When editing styles, check both the desktop and mobile (`max-width: 767px`) sections.

---

## Navigation Structure

Every page includes the same global navigation HTML. When updating navigation (adding pages, changing labels), **update all HTML files** — there is no shared nav component.

Primary nav links (clean URLs — no `.html` extension needed):
- Home (`/`)
- Wines (`/pages/wines`)
- Events (`/pages/events-calendar`)
- About (`/pages/about`)
- Gallery (`/pages/gallery`)
- Contact (`/pages/contact`)
- Private Events (`/pages/event-packages`)

### Hamburger Menu
The mobile nav is toggled by a single `<script>` block at the bottom of each page's `<body>`. The CSS lives inside a `@media (max-width: 960px)` block. **Do not add duplicate nav CSS outside a media query** — it will override the desktop styles and break the layout.

---

## Common Tasks

### Adding a New Wine
Edit `pages/wines.html` and also update the system prompt in `api/chat.js` so the chatbot knows about the new wine.

### Updating Hours
Hours appear in: `index.html`, `pages/contact.html`, `pages/about.html`, and the system prompt in `api/chat.js`. Update all four.

### Adding an Image
1. Add image file to `public/images/`
2. Reference as `/public/images/filename.jpg` in HTML
3. Or upload to GoDaddy CDN and use the CDN URL (preferred for large images)

### Modifying the Chatbot
Edit `api/chat.js`. The system prompt (starting around line 20) contains all winery context. Keep responses under 400 tokens by adjusting `max_tokens`.

### Adding an Event
Events are pulled live from an Outlook ICS calendar feed via `api/calendar.js`. Add events in Outlook/Microsoft 365 — they appear automatically on the site.

---

## Owners Circle (`pages/circle.html`)

Membership landing page shared by private URL only — `freeruncellars.com/pages/circle`. Has `<meta name="robots" content="noindex, nofollow">` and is **not linked anywhere on the main site**.

### What it does
- Presents the $249/yr membership with $150 credit back
- Collects interest sign-ups (name, email, phone, interests, message)
- POSTs to `/api/brevo` (type: `circle`) which:
  1. Adds/updates the contact in Brevo under the "Owners Circle" list
  2. Sends a notification email to `contact@frcwine.com` via Brevo transactional email

### Brevo setup checklist
1. Sign up at brevo.com (free tier handles up to 300 emails/day)
2. **Settings → API Keys** → Generate new key → add to Vercel as `BREVO_API_KEY`
3. **Contacts → Lists** → Create list named "Owners Circle" → note the numeric ID → add to Vercel as `BREVO_CIRCLE_LIST_ID`
4. **Contacts → Settings → Contact Attributes** → add these custom attributes (Text type):
   - `INTERESTS`
   - `MEMBERSHIP_TYPE`
   - `CIRCLE_MESSAGE`
   (Standard `FIRSTNAME`, `LASTNAME`, `SMS`, `JOIN_DATE` already exist in Brevo)
5. Optional: build a welcome automation in Brevo triggered when a contact is added to the Owners Circle list

### Legal note
The "dividend into credits" language has a pending legal review flag visible on the page. Do not remove it until the owners have confirmed legal sign-off on Michigan winery membership regulations.

---

## Known Limitations & Pending Work

- [ ] Newsletter signup uses `mailto:` fallback — needs Mailchimp or EmailJS integration
- [x] Reviews page updated — real Google reviews now live
- [x] `freeruncellars.com` DNS migrated to Vercel — `frcwine.com` and `www.frcwine.com` now permanently redirect to `freeruncellars.com`
- [x] Instagram confirmed — `@freeruncellars` live in index, contact, and reviews pages
- [x] Facebook confirmed — `facebook.com/FreRunCellars` linked from contact page and reviews page
- [ ] WordPress migration planned (2-phase: host selection → theme conversion)
- [ ] Wine sales handled externally via Drink Michigan (https://drinkmichigan.com/collections/freeruncellars#/) — no e-commerce on this site

## Recent Additions (March 2026 — part 15)

Bug fixes and image updates on `pages/event-packages.html`:

- **Hamburger menu fix**: Removed stray JS debris (broken backtick template-literal fragment, orphaned `setTimeout`, and unclosed `}`) sitting between the nav-scroll code and the mobile nav IIFE. The `SyntaxError` it caused silently prevented the hamburger listener from ever attaching.
- **Photo break image**: Swapped the full-bleed "Exchange vows among the vines" banner from `untitled-985.jpeg` (wine bottles) to `untitled-601.jpeg` (catering/food spread).
- **Intro bottom image**: Swapped the second stacked intro image from `untitled-985.jpeg` to `AS259847.jpeg` (copper mule cup with flowers).

## Recent Additions (March 2026 — part 14)

Preferred Partners section on event-packages.html:

- **Preferred Partners section** (`pages/event-packages.html`): New `#partners` section added above the footer, with two side-by-side cards (stacked on mobile). Styled consistently with the page — pale teal background, white cards, Cormorant Garamond partner names, brand teal accents. Section is linked from the homepage callout.
- **Modern Table Cuisine**: Executive Chef Joshua Bishop — fresh, seasonal catering for weddings, corporate luncheons & intimate gatherings. Contact: moderntablejosh@gmail.com, 574-849-6049.
- **Fruitful Vine Tours**: Guided wine tours through Southwest Michigan wine country including Free Run Cellars. Website: fruitfulvinetours.com.
- **index.html**: Replaced the full Fruitful Vine Tours promotional block (`.fruitful`) with a minimal one-line callout — "Planning a group visit? Meet our preferred partners →" — linking to `/pages/event-packages#partners`.
- **api/chat.js**: Added `PREFERRED PARTNERS` section to the system prompt with both partners' names, descriptions, and contact details.

## Recent Additions (March 2026 — part 13)

Event pages, TV signage, and events calendar fix:

- **Eight Hundred Grapes book discussion** (`pages/eight-hundred-grapes-book-discussion.html`): event page for the April 17 book club (free admission). Dark themed with grape cluster SVG, secrets/pairings sections, and no-reservation-needed CTA.
- **TV signage pages** — three new pages designed for AbleSign / TV display. All share: `noindex, nofollow`, no Google Analytics tag, no active links, fixed `100vw × 100vh` single-screen layout:
  - `pages/eight-hundred-grapes-signage.html` — book club event, two-column landscape layout
  - `pages/starry-night-signage.html` — Starry Night Paint & Sip, night sky palette, wine glass SVG
  - `pages/events-calendar-signage.html` — live calendar feed, 3-column event grid, "Next Up" highlight on first event, hours/phone footer bar, auto-refreshes every 5 minutes
- **Events calendar button fix**: "Get Tickets" now only shown when admission contains `$` or `ticket`. Free events with a Location URL correctly show "Learn More" instead.

## Recent Additions (March 2026 — part 12)

Consolidated four Brevo API handlers into a single `api/brevo.js` endpoint to stay under Vercel's free-plan limit of 12 serverless functions (was 13, now 10):

- **`api/brevo.js`**: unified POST endpoint routing by `type` field — `circle`, `contact`, `lead`, `wifi`. Each type runs its original logic exactly as-is: same validation, honeypot checks, rate limits, CORS, error handling, and Brevo calls. All four types import shared helpers from `api/_helpers.js`.
- **Deleted**: `api/circle-signup.js`, `api/contact.js`, `api/lead.js`, `api/wifi-signup.js` — replaced entirely by `api/brevo.js`.
- **Frontend updated**: `pages/circle.html`, `pages/contact.html`, `pages/wifi-welcome.html`, and `chat-bubble.html` all POST to `/api/brevo` with a `type` field instead of their individual endpoints.
- **No behavior changes**: env vars, Brevo list IDs, rate limits, and all logic are unchanged.

## Recent Additions (March 2026 — part 11)

Sales dashboard with Poynt POS integration:

- **Sales dashboard** (`tools/dashboard.html`): password-protected staff tool at `/tools/dashboard`. Dark-themed UI (noindex, not linked from site). Shows revenue, transaction count, top wine, daily revenue chart, and per-wine sales breakdown (glasses, bottles, flight shares). Date range selectable via quick-select buttons (This Week, Last 30 Days, This Month, YTD) or manual date pickers.
- **Poynt auth** (`api/poynt-auth.js`): serverless function for Poynt OAuth2. Signs a self-issued RS256 JWT, exchanges it for an access token, and caches in memory. Private key stored as `\n`-escaped PEM in `POYNT_PRIVATE_KEY` env var.
- **Poynt sales** (`api/poynt-sales.js`): fetches orders from Poynt API with pagination (up to 2,000 orders). Allocates flight revenue equally across member wines. Computes inventory predictions: bottles/day velocity over the queried period and runway (days until depletion) for each wine.
- **Flight allocation**: "Dry White Flight" → Dry Riesling + Pinot Gris + Fusion; "Dry Red Flight" → Rosé + Lemberger + Meritage; "Sweet Flight" → Mezzo + Valvin Muscat + Rosso. Revenue split equally; each member wine gets a `flightShares` count.
- **Inventory persistence**: starting case counts entered in the dashboard auto-save to `localStorage`, restored on next session.
- **Depletion predictions**: Runway column in inventory table — red (≤14d), amber (15–30d), green (31d+) — with bottles/day velocity sub-label. Server returns `bottlesPerDay` and `runwayDays` per wine.
- **Env vars**: `POYNT_APP_ID`, `POYNT_PRIVATE_KEY`, `POYNT_BUSINESS_ID`, `DASHBOARD_PASSWORD` — all set in Vercel project settings.

## Recent Additions (March 2026 — part 10)

Contact form enhancements and nav rename:

- **Nav rename** (all pages): "Visit Us" nav link renamed to "Visit & Contact" across all 9 HTML files (desktop + hamburger) to reflect that the page serves both purposes.
- **Event date field** (`pages/contact.html` + `api/contact.js`): optional date picker added to the contact form. Shown only for inquiry types where it's relevant — 🎉 Host an event · 🚚 Food truck · 🧘 Host an activity — hidden for 🎵 Perform here. Date is formatted as human-readable (e.g. *Saturday, April 5, 2026*) in the notification email.
- **Mailing list opt-in** (`pages/contact.html` + `api/contact.js`): "Add me to your mailing list" checkbox below the phone field. When checked, phone becomes required (client + server validation); placeholder updates to reflect this. On opt-in, contact is added/updated in Brevo list 11 with `FIRSTNAME`, `LASTNAME`, `SMS` attributes via `updateEnabled: true`. List add failure is non-fatal — notification email still succeeds. Success message confirms list signup to the visitor.

## Recent Additions (March 2026 — part 9)

Contact form, chat lead capture, and bug fixes:

- **Contact form** (`pages/contact.html` + `api/contact.js`): replaced the `mailto:` email card with an inline Brevo-powered inquiry form. Visitor picks an inquiry type first — 🎵 Perform here · 🎉 Host an event · 🚚 Food truck · 🧘 Host an activity — then fills in name (required), email (required), phone (optional), and a message. POSTs to `api/contact.js` which sends a notification to `contact@frcwine.com` via Brevo. Subject line and emoji vary by inquiry type; reply-to is set to the visitor's email. Includes honeypot field. Uses existing `BREVO_API_KEY` — no new env var needed.
- **Chat widget lead capture** (`api/lead.js`): the chat widget's lead form was POSTing to `/api/lead` which didn't exist — silently failing every time. Created the endpoint (CORS allowlist, rate limiting, Brevo email to `contact@frcwine.com`).
- **Contact page hamburger fix** (`pages/contact.html`): a stray `d` character and a duplicate `const io` (IntersectionObserver) declaration caused a JS `SyntaxError` that prevented the mobile nav IIFE from ever running. Both removed.
- **Age gate persistence** (`index.html`): switched from `sessionStorage` to `localStorage`. `sessionStorage` clears when the browser tab/session closes, so the age prompt was reappearing every visit. `localStorage` persists until the user clears browser data.

## Recent Additions (March 2026 — part 8)

Post generator improvements (`tools/post-generator.html` + `api/generate-post.js`):

- **CORS fix**: the tool was previously calling the Anthropic API directly from the browser, exposing the API key. All AI calls now go through `api/generate-post.js` (same CORS allowlist + rate limiting as the other handlers). API key stays server-side only.
- **Model selector**: Haiku is the default (fast, low-cost). A two-button toggle in Step 2 lets Trish switch to Sonnet for richer copy. The server validates the model against an allowlist (`claude-haiku-4-5-20251001`, `claude-sonnet-4-6`) and falls back to Haiku if anything unexpected is sent.
- **Weather auto-fetch**: on event selection, fetches a forecast from [Open-Meteo](https://open-meteo.com/) (free, no API key) for Berrien Springs, MI (lat 41.9478, lon -86.3483). Available up to 16 days out. Temperature range and a WMO condition icon appear in the event strip; the forecast is injected into the prompt as a soft hint — *"weave the weather in naturally if it fits."* Silently skipped if unavailable or out of range.
- **Post type toggle**: Announcement (build anticipation, save the date) vs Reminder (event is soon, create urgency). Changes the framing instruction sent to Claude.
- **Featured wine / special offer**: optional text field passed directly into the prompt so Claude can mention a specific wine or deal naturally within the post.

## Recent Additions (March 2026 — part 7)

Security hardening across all three API handlers (issues #38, #39, #42, #43):

- **CORS allowlist** (`api/_helpers.js` → all handlers): replaced `Access-Control-Allow-Origin: *` with an explicit allowlist. Known browser origins receive the exact `ACAO` header; unknown browser origins receive `403`. Requests with **no** Origin header (curl, server-to-server) are allowed through without restriction.
- **Rate limiting** (`api/_helpers.js` → all handlers): per-IP in-memory rate limiter via `makeRateLimiter(max, windowMs)`. Limits: 30 req/min for chat, 10/min for uploads, 5 per 10 min for circle-signup. Throttled requests return `429`.
- **Honeypot** (`pages/circle.html` + `api/circle-signup.js`): hidden `_hp` field on the signup form. Bots that fill it receive a silent `200`; the contact is never saved.
- **HTML escaping** (`api/circle-signup.js`): all user-provided values are passed through `escapeHtml()` before interpolation into the Brevo HTML notification email, preventing HTML injection.
- **Email error handling** (`api/circle-signup.js`): Brevo SMTP response is now checked; a failed notification logs a warning and returns `{ ok: true, warning: "signup_saved_notification_failed" }` so the contact record is not lost.
- **Upload validation** (`api/upload-photo.js`): strict data-URI regex, MIME type allowlist (`image/jpeg`, `image/png`, `image/webp`), 5 MB cap checked on the decoded `Buffer` (not the base64 string). `randomUUID()` sourced via `require('crypto')` for Node 18 compatibility.
- **Shared helpers** (`api/_helpers.js`): CORS, rate limiting, `escapeHtml`, upload constants, `INTERESTS_MAP`, and `normalizePhone` extracted into a single shared CJS module imported by all handlers. No logic is duplicated.
- **Unit tests** (`test-api-handlers.js`): 69 tests covering all shared helpers and handler logic. All constants and functions are imported from `api/_helpers.js` — no local copies. Run with `node test-api-handlers.js`.

## Recent Additions (March 2026 — part 6)

- **Owners Circle — phone required**: Phone number is now a required field (label, client-side validation, and API validation). Collected for future SMS-based login (Supabase auth).
- **Owners Circle — interests fix**: `INTERESTS` is a Text attribute in Brevo. Was incorrectly sending an array of numeric IDs; now sends a human-readable comma-separated string (e.g. `"First access to new wines, $150 credits + ongoing discount"`). Also fixed `MEMBERSHIP_TYPE` from integer `1` to string `"Owners Circle"`.
- **Owners Circle — duplicate error handling**: Brevo returns `{"code":"duplicate_parameter"}` when a phone or email is already associated with another contact. `api/circle-signup.js` now parses this and returns a friendly 409 message telling the user to contact `contact@frcwine.com` if they think it's a mistake.
- **Owners Circle — interest label**: "First access to Ramato & Cab Blanc" renamed to "First access to new wines" (more generic, future-proof).

## Recent Additions (March 2026 — part 5)

- **Events calendar — type/admission/status via title pipe syntax**: The iCal feed does **not** return the Outlook Description/Notes field, so metadata is set in the event **title** using a pipe separator, or auto-detected from title keywords.
- **Events calendar — "Learn More" button for free events**: Events with a URL in the Location field but no admission badge now show a teal "Learn More" button (previously no button was rendered at all). Events with both a URL and an admission badge show "Get Tickets".

### Events Calendar — How to Configure an Event in Outlook

**The Description/Notes field is not available** — the iCal API only returns the title, date/time, and location.

**To set type, admission, or status**, append pipe-separated tags to the event title:

```
Event Name | type: special | admission: Free | status: sold-out
```

**To link to an event page or ticket URL**, put the full URL in the **Location** field:

```
https://freeruncellars.com/pages/my-event-page
```

| Where | Field | Values | Effect |
|-------|-------|--------|--------|
| Title (pipe) | `type` | `live-music` · `tasting` · `special` | Sets filter category and type tag |
| Title (pipe) | `admission` | Any text (e.g. `Free`, `$15 · Ticketed`) | Shows admission badge on event card |
| Title (pipe) | `status` | `sold-out` | Replaces button with greyed "Sold Out" pill |
| Location | URL (`https://…`) | Full URL | Shows "Get Tickets" (if admission set) or "Learn More" button |

If `type` is omitted, it is auto-detected from title keywords (`tast`/`release`/`pairing` → tasting; `ticket`/`special`/`day` → special; everything else → live-music).

## Recent Additions (March 2026 — part 4)

- **Owners Circle page**: Added `pages/circle.html` — private membership landing page (noindex, not linked from site). Dark-background premium design with FRC branding (Jost body font, self-hosted logo, brand teal palette). Signup form POSTs to new `api/circle-signup.js`.
- **Brevo integration**: `api/circle-signup.js` serverless function adds contacts to the "Owners Circle" Brevo list and sends a notification email to `contact@frcwine.com`. API key and list ID stored in Vercel env vars (`BREVO_API_KEY`, `BREVO_CIRCLE_LIST_ID`) — never client-side.

## Recent Fixes (March 2026 — continued, part 3)

- **Contact page — email link**: Wrapped `contact@frcwine.com` in a full `.contact-method` card with `mailto:?subject=Visit%20Inquiry%20-%20Free%20Run%20Cellars`. Inherits existing text styling — no blue underline.
- **Contact page — maps link**: Replaced Apple Maps `href` on Get Directions with the Google Maps universal URL (`google.com/maps/dir/?api=1&destination=...`) — works on iOS, Android, and desktop.
- **Contact page — mobile layout**: Added `@media (max-width:767px)` — `.main-inner` collapses to single column (`grid-template-columns:1fr`), photo strip stacks vertically with 12px gap between panels, section padding reduced to `56px 20px`.
- **Contact page — tel links**: Corrected both phone `href` values from `tel:2698156885` to `tel:+12698156885` (E.164 format).
- **Contact page — live music photo**: Replaced `untitled-31.jpeg` (trumpet player) in the photo strip with `AS259847.jpeg`.
- **Contact page — Facebook card**: Added Facebook `.contact-method` card linking to `facebook.com/FreRunCellars` with sub-text "Last-minute event news & announcements". Added `.cm-icon.facebook { background:#1877f2 }` style.
- **Contact page — Instagram copy**: Updated sub-text from "Follow for updates & events" to "Stories, behind-the-scenes & last-minute updates".

## Recent Fixes (March 2026 — continued, part 2)

- **Google Analytics**: Added GA4 tag (`G-T51K1F9DVS`) to all 11 public HTML pages (`index.html`, all `pages/`, `tools/post-generator.html`, `tools/photobooth.html`). Snippet placed at the top of `<head>` on each page.

## Recent Fixes (March 2026 — continued)

- **Wine press logo — nav**: Added `FR_WinePress.png` to all page navs, left of the horizontal wordmark, in a flex container with `gap:12px`. Applied `margin-top:4px` globally for visual centring against the wordmark.
- **Wine press logo — footer stamp**: All pages now show a centred 90px wine press mark above the copyright bar. Inner pages use a new `.footer-bottom` wrapper; homepage uses `.f-stamp` between the footer grid and `.f-bottom`.
- **Live Music mobile layout**: Replaced `@media (max-width:600px)` with a comprehensive `@media (max-width:767px)` block — section paddings reduced ~25–30%, `expect-inner` stacks to one column, Season/Time/Admission detail list reflows to a 2-column grid, Happy Hour stat block shrunk, decorative spacers halved.
- **Live Music artist photo**: Johnny Poracky photo (`/public/images/IMG_8852.jpeg`) placed below the "Familiar faces" heading — 600px max-width, 12px rounded corners, muted uppercase caption.

## Recent Fixes (March 2026)

- **Domain migration**: Primary domain moved from `frcwine.com` to `freeruncellars.com`. Both `frcwine.com` and `www.frcwine.com` permanently redirect (308) to `freeruncellars.com` via `vercel.json`. Contact email (`contact@frcwine.com`) and Microsoft 365 tenant remain on `@frcwine.com`.
- **Hamburger menu (all pages)**: Removed leaked CSS outside `@media` queries overriding desktop styles. Removed broken `links`/`burger` event listeners. Added missing `id="navLinks"` to `<ul>` on `events-calendar.html` and `reviews.html` so `getElementById` resolves correctly.
- **Gallery filter + hamburger**: Removed unclosed `(function() {` stub that caused a JS SyntaxError, killing both the filter and hamburger in the same script block.
- **Events calendar**: Removed unclosed `(function() {` IIFE that caused a silent JS syntax error, leaving the events list permanently blank.
- **Reviews page scroll**: Removed `position: fixed !important` from `body` — was preventing the page from scrolling on mobile. Also removed orphaned incomplete IIFE stub.
- **Clean URLs**: Added `"cleanUrls": true` to `vercel.json` — pages now resolve at `/pages/about` without the `.html` extension. Old `.html` links 308-redirect automatically.
- **Wines filter**: Filter buttons existed in HTML but had no JS handler. Added click listener filtering `.wine-card` elements by `data-type` attribute.
- **Wines mobile layout**: `.wines-inner` now stacks to a single column at 768px with correct image height and background positioning.
- **Mobile hero padding**: `live-music-sundays.html` and `contact.html` had no mobile override for large desktop side padding — added responsive breakpoints so hero content isn't squeezed on phone.
- **Chatbot**: Added `EVENTS CALENDAR` section to system prompt directing users to the live events page for specific upcoming events and artist lineups.
- **Photo booth — image delivery**: Switched from base64 attachments to Vercel Blob storage. Photos are uploaded via `api/upload-photo.js` and emailed as public URLs, eliminating EmailJS payload size limits.
- **Photo booth — film strip**: 3-photo sessions now composite all three frames into a single vertical strip image on canvas (dark background, gaps, FRC logo) before upload. One image stored, one image emailed — just like a traditional photo booth print.
- **Email templates**: Added `tools/email-template-single.html` and `tools/email-template-strip.html` as source-of-truth for EmailJS template HTML. Both include a "View & download your photo →" fallback link for email clients that block external images.
- **Logo**: Replaced GoDaddy CDN logo (`blob-d682120.png`) with self-hosted horizontal logo at `/public/images/free-run-cellars-logo-horizontal-black-323a89.webp` across all four tools pages. Email templates use the full absolute URL; HTML `src` attributes use the root-relative path.

---

## External Services

| Service | Purpose | Config Location |
|---------|---------|----------------|
| Anthropic Claude API | AI chat + post generator | `ANTHROPIC_API_KEY` in Vercel env |
| Brevo | Owners Circle list + notification emails | `BREVO_API_KEY` + `BREVO_CIRCLE_LIST_ID` in Vercel env |
| EmailJS | Photo booth email delivery | `CONFIG` object in `tools/photobooth.html` |
| Vercel | Hosting + serverless functions | `vercel.json` + Vercel dashboard |
| GoDaddy | Domain + image CDN | GoDaddy dashboard |
| Outlook/Microsoft 365 | Events calendar (ICS feed) | Microsoft 365 calendar |
| Poynt POS | Sales data for staff dashboard | `POYNT_APP_ID` + `POYNT_PRIVATE_KEY` + `POYNT_BUSINESS_ID` in Vercel env |
| GitHub | Source control + CI/CD trigger | github.com/paispa/freeruncellars |

---

## Do Not

- Do not add npm packages or a build pipeline without explicit approval
- Do not commit `.env` files or API keys
- Do not modify `vercel.json` redirect rules without testing (could break DNS)
- Do not delete images from `/public/images/` without verifying no page references them
- Do not create a shared CSS file unless converting all pages to use it consistently
