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
├── pages/
│   ├── about.html              ← Our Story
│   ├── wines.html              ← Full wine menu + seasonal cocktails
│   ├── events-calendar.html    ← Live ICS calendar (Outlook)
│   ├── live-music-sundays.html ← Live Music SEO page
│   ├── event-packages.html     ← Private events & pricing
│   ├── gallery.html            ← Photo gallery with lightbox
│   ├── contact.html            ← Visit Us / Hours / Map
│   ├── reviews.html            ← Review landing (Google, Yelp, Facebook)
│   └── circle.html             ← ⚠️ Owners Circle — private, not linked publicly
├── tools/
│   ├── post-generator.html          ← Internal: AI Facebook post generator
│   ├── photobooth.html              ← Photo booth with EmailJS + Vercel Blob
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
| Live Music Sundays | `pages/live-music-sundays.html` | ✅ Live |
| Private Events | `pages/event-packages.html` | ✅ Live |
| Gallery | `pages/gallery.html` | ✅ Live |
| Visit Us | `pages/contact.html` | ✅ Live |
| Reviews | `pages/reviews.html` | ✅ Live |
| Owners Circle | `pages/circle.html` | ✅ Live — private URL, not linked from site |
| Post Generator | `tools/post-generator.html` | ✅ Internal tool |
| Photo Booth | `tools/photobooth.html` | ✅ Live — EmailJS + Vercel Blob |

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

Signups POST to `api/circle-signup.js` which adds the contact to the Brevo list and sends a notification to `contact@frcwine.com`.

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

Pulls from Outlook. Uses a 3-proxy fallback chain for CORS:
1. `api.allorigins.win`
2. `corsproxy.io`
3. `api.codetabs.com`

To add images/descriptions to events, add these to the event Notes field in Outlook:

```
image: https://yourphoto.com/artist.jpg
desc: Soulful acoustic duo from Kalamazoo.
type: live-music
admission: Free
url: https://tickets.example.com
status: sold-out
```

**Supported types:** `live-music` · `tasting` · `special` · `ticketed`

**Supported status values:** `sold-out` — replaces the action button with a greyed-out "Sold Out" pill and adds a red "Sold Out" badge on the event image. Omit the field (or leave blank) for normal display.

---

## Image Swap Guide

Images are CSS variables at the top of each HTML file. To swap: upload to GoDaddy Image Manager → copy CDN URL → paste in. GoDaddy CDN is used for large hero/gallery photos only; logos and brand assets are self-hosted in `/public/images/`.

CDN format: `https://img1.wsimg.com/isteam/ip/e003f7b8-bd50-4872-a2d0-83a80d992e8e/FILENAME.jpeg`

| Variable | File | Description |
|----------|------|-------------|
| `--img-hero` | `AS259838.jpeg` | Vineyard rows at golden hour |
| `--img-story` | `R06A2367.jpeg` | Trish & Prashanth toasting |
| `--img-patio` | `R06A1556.jpeg` | Outdoor patio & umbrellas |
| `--img-wine` | `R06A1589r.jpeg` | Pinot Gris bottle on rope swing |
| `--img-events` | `untitled-31.jpeg` | Flutist performing live |
| `--img-wedding` | `untitled-985.jpeg` | Wedding couple in vineyard |
| `--img-pond` | `IMG_4007.jpeg` | Spring-fed pond |
| `--img-sign` | `AS259819.jpeg` | Exterior sign at dusk |

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
| Moersch Hospitality (wine sales) | https://www.moerschhospitalitygroup.com |

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

Wine currently sold online via Moersch Hospitality to avoid multi-state sales tax complexity. Future plan: WooCommerce + TaxJar/Avalara once licensing confirmed. Do not build an in-house shop until that decision is made.

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
- [x] Owners Circle page built (`pages/circle.html`) — awaiting Brevo env vars before sharing URL
- [ ] Owners Circle: set `BREVO_API_KEY` + `BREVO_CIRCLE_LIST_ID` in Vercel env vars
- [ ] Owners Circle: legal review of "dividends into credits" language (Michigan winery regs)
- [ ] Replace placeholder reviews with real Google/Facebook reviews
- [ ] Newsletter → connect to proper email list (Mailchimp or EmailJS)
- [x] Josh Bishop (preferred caterer) — section live on event-packages.html
- [x] Instagram handle confirmed — @freeruncellars live in nav, contact, and reviews pages
- [x] AI chatbot / inquiry assistant — fully live (api/chat.js + embedded on all pages)
- [ ] Blog: Chikmagalur coffee terroir vs SW Michigan wine terroir
- [ ] Partnership page for neighboring vineyards
- [ ] Favicon — export `FR_WinePress.png` as 512×512 square transparent PNG, generate favicon.ico + apple-touch-icon

---

*Last updated: March 16, 2026 (Owners Circle page + Brevo integration)*
