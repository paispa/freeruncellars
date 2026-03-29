# Free Run Cellars — Website

**Live site:** https://www.freeruncellars.com
**Vercel preview:** https://freeruncellars.vercel.app  
**GitHub repo:** https://github.com/paispa/freeruncellars  
**Owners:** Trish Slevin & Prashanth Pais  
**Address:** 10062 Burgoyne Road, Berrien Springs, MI 49103  
**Phone:** (269) 815-6885  
**Email:** contact@frcwine.com  

---

## Project Overview

Full website for Free Run Cellars, a boutique winery in Berrien Springs, Michigan. Built as static HTML hosted on Vercel at `www.freeruncellars.com`. `frcwine.com` and `www.frcwine.com` redirect here. Future plan is to migrate to WordPress.

**Current stack:** Static HTML → GitHub → Vercel → www.freeruncellars.com
**Analytics:** Google Analytics 4 — Measurement ID `G-T51K1F9DVS`
**Target stack:** WordPress (WP Engine or Kinsta) + custom theme based on these prototypes
**DNS:** freeruncellars.com and frcwine.com managed via Cloudflare · A record `216.198.79.1` · CNAME `www` → Vercel
**Redirects:** `frcwine.com` and `www.frcwine.com` → `freeruncellars.com` (308 permanent) handled by `vercel.json`
**Clean URLs:** `"cleanUrls": true` in `vercel.json` — pages served at `/pages/about` (no `.html`)

---

## Folder Structure

```
freeruncellars/
├── index.html                  ← Homepage
├── vercel.json                 ← Redirect config (frcwine.com → freeruncellars.com)
├── test-api-handlers.js        ← Unit tests for api/_helpers.js (run: node test-api-handlers.js)
├── api/
│   ├── _helpers.js             ← Shared: CORS allowlist, rate limiting, escapeHtml, upload/signup constants
│   ├── brevo.js                ← Unified Brevo endpoint — routes by type: circle, contact, lead, wifi
│   ├── chat.js                 ← AI chat (Anthropic Claude Haiku) — CORS restricted, rate limited
│   ├── calendar.js             ← Outlook ICS calendar proxy (5 min cache)
│   ├── upload-photo.js         ← Photo booth storage (Vercel Blob) — MIME + size validated
│   ├── generate-post.js        ← AI Facebook post generator backend
│   ├── poynt-auth.js           ← Poynt OAuth2 token (RS256 JWT, cached)
│   ├── poynt-sales.js          ← Poynt POS sales data, flight allocation, inventory predictions
│   ├── frost-alert.js          ← Vineyard frost alerts — password-protected, sends SMS/email
│   └── frost-alert-cron.js     ← Cron job: checks weather forecast and triggers frost alerts
├── pages/
│   ├── about.html                          ← Our Story
│   ├── wines.html                          ← Full wine menu + seasonal cocktails
│   ├── events-calendar.html                ← Live ICS calendar (Outlook)
│   ├── live-music-sundays.html             ← Live Music SEO page
│   ├── event-packages.html                 ← Private events & pricing
│   ├── gallery.html                        ← Photo gallery with lightbox
│   ├── contact.html                        ← Visit Us / Hours / Map
│   ├── reviews.html                        ← Review landing (Google, Yelp, Facebook)
│   ├── circle.html                         ← ⚠️ Owners Circle — private, not linked publicly
│   ├── wifi-welcome.html                   ← WiFi splash page — guest email/SMS signup via Brevo
│   ├── starry-night-paint-sip.html         ← Event page: Starry Night Paint & Sip (May 8)
│   ├── starry-night-signage.html           ← TV signage: Starry Night (noindex, no GA, no links)
│   ├── eight-hundred-grapes-book-discussion.html  ← Event page: book club (Apr 17, free)
│   └── eight-hundred-grapes-signage.html   ← TV signage: book club (noindex, no GA, no links)
├── tools/
│   ├── dashboard.html               ← Internal: sales dashboard (Poynt POS, password-protected) + Ramato Launch Planner
│   ├── post-generator.html          ← Internal: AI Facebook post generator
│   ├── photobooth.html              ← Photo booth with EmailJS + Vercel Blob
│   ├── vineyard-season.html         ← Internal: frost alert manager + bud break tracker (password-protected)
│   ├── healthcheck.html             ← Internal: production API health monitor (password-protected)
│   ├── email-template-single.html   ← EmailJS template: single photo
│   └── email-template-strip.html    ← EmailJS template: 3-photo composited strip
├── assets/
│   ├── images/                 ← Brand assets
│   └── docs/
│       └── photo-library.md    ← Full photo inventory with CDN URLs
└── .gitignore
```

---

## Page Status

| Page | File | Status |
|------|------|--------|
| Homepage | `index.html` | ✅ Live |
| Our Story | `pages/about.html` | ✅ Live |
| Wines | `pages/wines.html` | ✅ Live |
| Events Calendar | `pages/events-calendar.html` | ✅ Live — pulls live Outlook ICS |
| Events Calendar Signage | `pages/events-calendar-signage.html` | ✅ TV display — noindex, no GA, no links, auto-refreshes |
| Live Music Sundays | `pages/live-music-sundays.html` | ✅ Live |
| Private Events | `pages/event-packages.html` | ✅ Live |
| Gallery | `pages/gallery.html` | ✅ Live |
| Visit & Contact | `pages/contact.html` | ✅ Live |
| Reviews | `pages/reviews.html` | ✅ Live |
| Owners Circle | `pages/circle.html` | ✅ Live — private URL, not linked from site |
| Starry Night Paint & Sip | `pages/starry-night-paint-sip.html` | ✅ Live — event page (May 8, $35) |
| Starry Night Signage | `pages/starry-night-signage.html` | ✅ TV display — noindex, no GA, no links |
| Eight Hundred Grapes | `pages/eight-hundred-grapes-book-discussion.html` | ✅ Live — event page (Apr 17, free) |
| Eight Hundred Grapes Signage | `pages/eight-hundred-grapes-signage.html` | ✅ TV display — noindex, no GA, no links |
| Sales Dashboard | `tools/dashboard.html` | ✅ Internal — Poynt POS, password-protected; includes Ramato Launch Planner |
| Post Generator | `tools/post-generator.html` | ✅ Internal — AI Facebook post generator |
| Photo Booth | `tools/photobooth.html` | ✅ Live — EmailJS + Vercel Blob |
| WiFi Welcome | `pages/wifi-welcome.html` | ✅ Live — guest email/SMS signup (Brevo) |
| Vineyard Season | `tools/vineyard-season.html` | ✅ Internal — frost alert manager, password-protected |
| Health Check | `tools/healthcheck.html` | ✅ Internal — API health monitor, password-protected |

---

## Photo Booth Setup

CONFIG keys are filled in at the top of `tools/photobooth.html`. Two additional requirements:

**Vercel Blob** — photos are stored server-side so email only carries a URL:
1. Vercel dashboard → Storage → Create Blob store
2. Copy `BLOB_READ_WRITE_TOKEN` → add to Vercel project environment variables

**EmailJS templates** — paste the HTML from `tools/email-template-single.html` and `tools/email-template-strip.html` into the matching templates in the EmailJS dashboard. Set the **To Email** field to `{{to_email}}` and enable the HTML editor.

**3-photo strip** — the browser composites all three frames into one vertical film-strip image (dark background, FRC logo at the bottom) before uploading. One image is stored and emailed, just like a traditional photo booth print.

---

## Owners Circle

Private membership page at `/pages/circle` — shared by direct URL only, not linked from the main site.

**Brevo setup** (one-time, before the page goes live):

1. Sign up at [brevo.com](https://brevo.com) (free tier: 300 emails/day)
2. **Settings → API Keys** → Generate → add to Vercel as `BREVO_API_KEY`
3. **Contacts → Lists** → "New List" named `Owners Circle` → copy numeric ID → add to Vercel as `BREVO_CIRCLE_LIST_ID`
4. **Contacts → Settings → Contact Attributes** → add Text attributes: `INTERESTS`, `MEMBERSHIP_TYPE`, `CIRCLE_MESSAGE`
5. Optional: build a welcome email automation in Brevo triggered when a contact is added to the Owners Circle list

Signups POST to `api/brevo` (type: `circle`) which adds the contact to the Brevo list and sends a notification to `contact@frcwine.com`.

---

## Newsletter Signup

Currently uses a mailto fallback. To connect EmailJS, uncomment this block in `index.html`:

```javascript
await emailjs.send('YOUR_SERVICE_ID', 'YOUR_NEWSLETTER_TEMPLATE', {
  subscriber_email: email,
  to_email: 'contact@frcwine.com'
});
```

---

## Events Calendar ICS Feed

Pulls from Outlook via `api/calendar.js` (5-minute cache). The iCal API **does not return the Description/Notes field** — only the title, date/time, and location are available.

**To set metadata**, append pipe-separated tags to the event title in Outlook:

```
Event Name | type: special | admission: Free | status: sold-out
```

| Tag | Values | Effect |
|-----|--------|--------|
| `type` | `live-music` · `tasting` · `special` | Filter category. Auto-detected from title keywords if omitted. |
| `admission` | Any text e.g. `Free`, `$15 · Ticketed` | Shows admission badge. Text containing `$` or `ticket` → "Get Tickets" button; otherwise → "Learn More" button. |
| `status` | `sold-out` | Replaces button with greyed "Sold Out" pill. |

**To link to an event page or tickets**, put the full URL in the Outlook **Location** field (not the address):

```
https://freeruncellars.com/pages/my-event-page
```

**TV signage** — `pages/events-calendar-signage.html` pulls the same feed, shows up to 6 upcoming events in a 3-column grid, and auto-refreshes every 5 minutes. Point AbleSign at `/pages/events-calendar-signage`.

---

## Image Swap Guide

GoDaddy CDN is used for large hero/gallery photos only; logos and brand assets are self-hosted in `/public/images/`.

CDN format: `https://img1.wsimg.com/isteam/ip/e003f7b8-bd50-4872-a2d0-83a80d992e8e/FILENAME.jpeg`

### `index.html` — background images

The LCP hero image is preloaded in `<head>`:
```html
<link rel="preload" as="image" href="/public/images/AS259838.jpeg" fetchpriority="high">
```

Below-fold background images are **lazy-loaded via `data-bg` attributes** (not CSS variables). An IntersectionObserver near `</body>` reads each element's `data-bg` value and sets `style.backgroundImage` as the element scrolls into view (200px rootMargin).

| Element / CSS Class | File | Description |
|---------------------|------|-------------|
| `#hero` (above fold) | `AS259838.jpeg` | Vineyard rows at golden hour — preloaded, eager |
| `.story-img-inner` | `R06A2367.jpeg` | Trish & Prashanth toasting |
| `.photo-break-bg` | `R06A1556.jpeg` | Outdoor patio & umbrellas |
| `.wines-img-bg` | `R06A1589r.jpeg` | Pinot Gris bottle on rope swing |
| `.eb-bg` | `untitled-31.jpeg` | Flutist performing live |
| `.private-img-bg` | `untitled-985.jpeg` | Wine bottles close-up |
| `.grounds-img-bg` | `IMG_4007.jpeg` | Spring-fed pond |
| `.visit-img-bg` | `AS259819.jpeg` | Exterior sign at dusk |

### `pages/event-packages.html` — inline CSS class references

| CSS Class | File | Description |
|-----------|------|-------------|
| `.intro-img-1` | `untitled-716.jpeg` | Champagne fountain table |
| `.intro-img-2` | `AS259847.jpeg` | Copper mule cup with flowers |
| `.pkg-img-1` | `R06A1556.jpeg` | Outdoor patio & umbrellas (Roped Off card) |
| `.pkg-img-2` | `untitled-589.jpeg` | Evening wedding event with string lights (After Hours card) |
| `.pkg-img-3` | `untitled-985.jpeg` | Wine bottles close-up (Wine All Day card) |
| `.photo-break-bg` | `untitled-601.jpeg` | Catering food spread (full-bleed banner) |

---

## Brand Standards

**Primary color:** `#537f71` (PMS 625C teal)  
**Secondary:** `#707271` grey · `#cbc7c7` light grey · `#000000` black  
**Primary font:** Uniform → web substitute: **Jost**  
**Accent font:** Znikomitno24 → web substitute: **Cormorant Garamond**  
**Logo:** `/public/images/free-run-cellars-logo-horizontal-black-323a89.webp` (self-hosted)
**Wine press logo:** `/public/images/FR_WinePress.png` — used in nav (48px, left of wordmark) and as a centred footer stamp (90px) on all pages

---

## Brand Philosophy

**Atithidevo Bhav** — Sanskrit: *the guest is akin to God*

Prashanth grew up at Mathathota, his grandparents' coffee estate in Chikmagalur, Karnataka, India — where the gate was always open and guests were never strangers. Trish grew up in LaPorte, Indiana, built a career in corporate strategy advising C-suite executives across Chicago, Nashville, and Denver. They met in Chicago. Free Run is their home. When you're here, it's yours too.

---

## Property Facts

- **4 acres** Pinot Gris vines (estate grown)
- **3 acres** walnut trees lining the driveway
- **¼ acre** spring-fed pond (turtles & fish)
- **10+ acres** total grounds
- **90 minutes** from Chicago

---

## Business Hours

| Day | Hours |
|-----|-------|
| Monday – Thursday | By appointment only |
| Friday | 2:00 – 6:00 PM |
| Saturday | 12:00 – 7:00 PM |
| Sunday | 2:00 – 6:00 PM · Live Music 3:00–5:00 PM |

*Hours may vary — contact to confirm*

---

## Partners & Community

| Partner | URL |
|---------|-----|
| Fruitful Vine Tours | https://fruitfulvinetours.com |
| St. Joe Today | https://stjoetoday.com/member/free-run-cellars |
| Harbor Country Chamber | https://business.harborcountry.org/list/member/free-run-cellars-145 |
| Moody on the Market | https://www.moodyonthemarket.com/free-run-cellars-to-begin-new-chapter-as-independent-winery/ |
| Lake Michigan Shore AVA | https://www.lmswine.com |
| Drink Michigan (wine sales) | https://drinkmichigan.com/collections/freeruncellars#/ |

**Podcast — If Vines Could Talk, Episode 108:**
- Spotify: https://open.spotify.com/episode/2QQvuKemIWH9dlWREocD2u
- Apple: https://podcasts.apple.com/us/podcast/episode-108-free-run-cellars-under-new-owners/id1700454745?i=1000720996083
- Amazon: https://music.amazon.com/podcasts/2e1cc431-4278-47d5-88d6-ebe5224230ff/episodes/f76eb1c7-d098-4aa6-a505-f7e8478386b1/if-vines-could-talk-episode-108-free-run-cellars-%E2%80%93-under-new-owners

---

## SEO Targets

| Page | Keywords |
|------|----------|
| Homepage | "winery Berrien Springs MI", "winery near Chicago" |
| Live Music Sundays | "live music Berrien Springs", "winery live music near Chicago" |
| Private Events | "vineyard wedding Berrien Springs", "winery events Southwest Michigan" |
| Wines | "Pinot Gris Michigan", "Lake Michigan Shore wines" |
| About | "Free Run Cellars owners", "boutique winery Berrien Springs" |
| Visit | "things to do Berrien Springs MI", "Southwest Michigan wine trail" |

---

## E-Commerce Notes

Wine currently sold online via Drink Michigan (https://drinkmichigan.com/collections/freeruncellars#/). Do not build an in-house shop without explicit approval.

---

## WordPress Migration Plan

1. ✅ Prototype all pages as static HTML (complete)
2. Choose host: **WP Engine** (~$25–35/mo) or **Kinsta**
3. Convert to WordPress using **Kadence** or **GeneratePress** theme
4. Plugins: Yoast/Rank Math · WPForms · Smush · WP Rocket
5. E-commerce via WooCommerce + TaxJar — separate timeline

---

## Pending Items

- [x] EmailJS keys → filled in (service_9x5fnh1, g6DwhDedu0HLzfAw8)
- [x] GoDaddy tip/payment link → filled in
- [x] Hamburger menu fixed on all pages (missing `id="navLinks"`, leaked CSS, broken IIFEs)
- [x] Events calendar JS crash fixed
- [x] Gallery filter and hamburger fixed (unclosed IIFE caused SyntaxError)
- [x] Reviews page scroll fixed (`body: position fixed` was blocking scroll)
- [x] Wines filter JS implemented (buttons existed but had no handler)
- [x] Clean URLs enabled (`/pages/about` instead of `/pages/about.html`)
- [x] Wines section mobile layout fixed (single-column stacking)
- [x] Live Music and Visit Us mobile hero padding fixed
- [x] Chatbot updated to direct users to events calendar page for upcoming events
- [x] Photo booth: switched to Vercel Blob storage + URL-based email delivery
- [x] Photo booth: 3-photo strip composited into single film-strip image client-side
- [x] Email templates: added fallback "view photo" links for image-blocking email clients
- [x] Switch `freeruncellars.com` DNS to Vercel — complete
- [x] Logo replaced with self-hosted horizontal logo (removed GoDaddy CDN logo dependency)
- [x] Wine press logo added to nav on all pages (left of wordmark, flex container, gap 12px)
- [x] Wine press footer stamp added to all pages (90px, centred, above copyright bar)
- [x] Live Music page mobile layout overhauled (767px breakpoint, reduced paddings, Season/Time/Admission 2-col grid)
- [x] Johnny Poracky artist photo on Live Music page (600px max-width, 12px corners, caption)
- [x] Google Analytics 4 added to all pages (G-T51K1F9DVS)
- [x] Contact page: email mailto with subject line, Google Maps directions, mobile single-column layout, tel:+1 links, Facebook card, updated social copy
- [x] Owners Circle page built (`pages/circle.html`) — live at `/pages/circle`
- [x] Owners Circle: `BREVO_API_KEY` + `BREVO_CIRCLE_LIST_ID` set in Vercel env vars
- [x] Owners Circle: phone number required (future SMS/Supabase auth)
- [x] Owners Circle: interests saved to Brevo as text string (INTERESTS attribute)
- [x] Owners Circle: duplicate phone/email handled gracefully — friendly error with contact@frcwine.com
- [x] API security hardening: CORS allowlist (replaces `*`), per-IP rate limiting, honeypot on circle form, HTML escaping in notification email, upload MIME/size validation — issues #38 #39 #42 #43
- [x] Shared API helpers extracted to `api/_helpers.js`; unit test suite added (`test-api-handlers.js`, 69 tests)
- [x] Post generator: CORS fix (Anthropic calls now proxied through `api/generate-post.js`; API key never exposed client-side)
- [x] Post generator: model selector (Haiku default / Sonnet toggle), weather auto-fetch (Open-Meteo, 16-day window), post type toggle (Announcement / Reminder), featured wine field
- [x] Contact page: replaced `mailto:` link with inline Brevo contact form — inquiry types: Perform here, Host an event, Food truck, Host an activity
- [x] Chat widget lead capture: `/api/lead.js` created — was silently failing before (endpoint didn't exist)
- [x] Contact page hamburger fixed — stray `d` character + duplicate IntersectionObserver caused JS SyntaxError that prevented mobile nav from attaching
- [x] Age gate: switched from `sessionStorage` to `localStorage` — now persists across sessions instead of asking every visit
- [x] Nav link renamed "Visit Us" → "Visit & Contact" across all 9 pages
- [x] Contact form: optional event date picker (shown only for Host an event / Food truck / Host an activity)
- [x] Contact form: mailing list opt-in checkbox — phone required when checked, contact added to Brevo list 11
- [ ] Owners Circle: legal review of "dividends into credits" language (Michigan winery regs)
- [ ] Replace placeholder reviews with real Google/Facebook reviews
- [ ] Newsletter → connect to proper email list (Mailchimp or EmailJS)
- [x] Josh Bishop (preferred caterer) — section live on event-packages.html
- [x] Instagram handle confirmed — @freeruncellars live in nav, contact, and reviews pages
- [x] AI chatbot / inquiry assistant — fully live (api/chat.js + embedded on all pages)
- [x] Preferred Partners section added to event-packages.html — Modern Table Cuisine + Fruitful Vine Tours cards; homepage callout links to `#partners`
- [x] event-packages.html hamburger menu fixed — removed stray JS fragment (broken template literal + orphaned brace) that caused SyntaxError blocking mobile nav IIFE
- [x] event-packages.html photo break image swapped to `untitled-601.jpeg` (catering/food photo)
- [x] event-packages.html intro bottom image swapped to `AS259847.jpeg` (copper mule cup & flowers)
- [x] Frost alert endpoint secured with `DASHBOARD_PASSWORD` server-side auth; `auth_check` action added
- [x] Dashboard login bypass fixed — login gate now only unlocks on explicit `{ ok: true }` response, not on any non-401
- [x] healthcheck.html protected behind password gate (validates via poynt-sales auth_check)
- [x] CI expanded: `node --check` syntax validation for all api/*.js files + unit tests run in checks.yml
- [x] CI smoke tests expanded: public pages, staff tools, API auth endpoints (frost-alert + poynt-sales return 401 unauthenticated)
- [x] robots.txt: fixed `/pages/wifi-welcome.html` → `/pages/wifi-welcome` to match clean URL routing
- [x] Canonical tags added to all 11 public pages (index.html + all pages/*.html)
- [x] Homepage image performance: LCP hero preloaded; below-fold background images lazy-loaded via `data-bg` IntersectionObserver
- [x] Stale CORS preview origin removed from `api/_helpers.js` (`f-prashanths-projects-58faea9a.vercel.app`)
- [x] Ramato Launch Planner added to sales dashboard — countdown to June 28, 2026 launch, depletion timeline table, replacement recommendations, and menu gap warning; wires to existing Poynt velocity data
- [ ] Blog: Chikmagalur coffee terroir vs SW Michigan wine terroir
- [ ] Partnership page for neighboring vineyards
- [ ] Favicon — export `FR_WinePress.png` as 512×512 square transparent PNG, generate favicon.ico + apple-touch-icon

---

*Last updated: March 29, 2026 (Ramato Launch Planner added to sales dashboard: depletion timeline, replacement recommendations, menu gap warning)*
