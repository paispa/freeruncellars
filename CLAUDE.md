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
| Email | EmailJS (photo booth) · Brevo (Owners Circle) |
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
│   ├── chat.js                   # AI chat assistant (Anthropic Claude Haiku)
│   ├── calendar.js               # Outlook ICS calendar proxy (CORS workaround)
│   ├── upload-photo.js           # Photo booth image storage (Vercel Blob)
│   └── circle-signup.js          # Owners Circle form → Brevo + email notification
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
Shared utilities imported by all three API handlers. Exports:
- `ALLOWED_ORIGINS` — CORS allowlist (`freeruncellars.com`, `www.freeruncellars.com`, `freeruncellars.vercel.app`)
- `applyCors(req, res)` — sets `Access-Control-Allow-Origin` for known browser origins; allows no-Origin requests (curl, server-to-server) through without restriction; returns `false` for unknown browser origins
- `makeRateLimiter(max, windowMs)` — factory returning a per-IP in-memory rate-limiter function
- `getClientIp(req)` — reads `x-forwarded-for` or falls back to `socket.remoteAddress`
- `escapeHtml(str)` — HTML-encodes `& < > " '` for safe email body interpolation
- `DATA_URI_RE`, `ALLOWED_MIME_TYPES`, `MAX_IMAGE_BYTES` — upload validation constants
- `INTERESTS_MAP`, `normalizePhone(phone)` — Owners Circle business logic

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
| `BREVO_API_KEY` | `api/circle-signup.js` | Brevo API key (xkeysib-…) |
| `BREVO_CIRCLE_LIST_ID` | `api/circle-signup.js` | Numeric ID of the "Owners Circle" Brevo list |

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
- POSTs to `/api/circle-signup` which:
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
- [ ] Reviews page has placeholder content — needs real Google/Facebook reviews
- [x] `freeruncellars.com` DNS migrated to Vercel — `frcwine.com` and `www.frcwine.com` now permanently redirect to `freeruncellars.com`
- [x] Instagram confirmed — `@freeruncellars` live in index, contact, and reviews pages
- [x] Facebook confirmed — `facebook.com/FreRunCellars` linked from contact page and reviews page
- [ ] WordPress migration planned (2-phase: host selection → theme conversion)
- [ ] Wine sales handled externally via Drink Michigan (https://drinkmichigan.com/collections/freeruncellars#/) — no e-commerce on this site

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

- **Events calendar — ticketed event support**: `parseNotes` now reads `type: ticketed` and `status: sold-out` from Outlook event descriptions. Setting `type: ticketed` marks the event as ticketed (shows "Ticketed" admission badge; changes URL button label to "Get Tickets"). Setting `status: sold-out` replaces the action button with a greyed-out "Sold Out" pill and shows a red "Sold Out" badge on the event image thumbnail.
- **Events calendar — HTML description parsing**: Outlook exports calendar descriptions as HTML (`<p>type: ticketed</p>`). `parseNotes` now strips HTML block elements (converting to newlines) and inline tags before parsing `key: value` fields, so all metadata fields work regardless of Outlook's formatting.

### Events Calendar — Supported Description Fields

Add these in the Outlook event's Notes/Description field (one per line):

```
image: https://yourphoto.com/artist.jpg
desc: Soulful acoustic duo from Kalamazoo.
type: live-music
admission: Free
url: https://tickets.example.com
status: sold-out
```

| Field | Values | Effect |
|-------|--------|--------|
| `type` | `live-music` · `tasting` · `special` · `ticketed` | Sets filter category and type tag |
| `admission` | Any text (e.g. `Free`, `$15`, `Ticketed`) | Shows admission badge on event card |
| `url` | Full URL | Shows "Get Tickets" (if ticketed) or "Learn More" button |
| `status` | `sold-out` | Replaces button with greyed "Sold Out" pill; adds red badge on image |
| `image` | Full URL | Event thumbnail photo |
| `desc` | Plain text | Short event description on card |

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
| GitHub | Source control + CI/CD trigger | github.com/paispa/freeruncellars |

---

## Do Not

- Do not add npm packages or a build pipeline without explicit approval
- Do not commit `.env` files or API keys
- Do not modify `vercel.json` redirect rules without testing (could break DNS)
- Do not delete images from `/public/images/` without verifying no page references them
- Do not create a shared CSS file unless converting all pages to use it consistently
