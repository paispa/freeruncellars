# CLAUDE.md — Free Run Cellars Website

This document provides guidance for AI assistants working on the Free Run Cellars website codebase.

## Project Overview

**Free Run Cellars** is a boutique winery website for a family-owned estate in Berrien Springs, Michigan (90 minutes from Chicago), owned by Trish Slevin & Prashanth Pais. The philosophy is *Atithidevo Bhav* — "the guest is akin to God."

- **Live site:** https://www.frcwine.com
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
| Email | EmailJS (photo booth) |
| DNS redirect | vercel.json (frcwine.com → www.frcwine.com) |
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
├── .gitignore                    # Excludes .DS_Store, node_modules, .env, logs
│
├── api/                          # Vercel serverless functions
│   ├── chat.js                   # AI chat assistant (Anthropic Claude Haiku)
│   ├── calendar.js               # Outlook ICS calendar proxy (CORS workaround)
│   └── upload-photo.js           # Photo booth image storage (Vercel Blob)
│
├── pages/                        # All public content pages
│   ├── about.html                # Our Story / owner bios
│   ├── wines.html                # Wine menu, flights, cocktails
│   ├── events-calendar.html      # Live events (ICS feed from Outlook)
│   ├── live-music-sundays.html   # Live music SEO landing page
│   ├── event-packages.html       # Private events & wedding pricing
│   ├── gallery.html              # Photo gallery with lightbox
│   ├── contact.html              # Hours, map, contact form
│   └── reviews.html              # Links to Google/Yelp/Facebook reviews
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

### `api/chat.js`
Anthropic Claude Haiku chatbot for the winery website. Key details:
- Uses `ANTHROPIC_API_KEY` environment variable (set in Vercel project settings)
- System prompt contains: wine menu, hours, pricing, property facts, event packages
- Max 400 tokens per response, maintains 10-message conversation history
- CORS enabled for browser requests

### `api/calendar.js`
CORS proxy for the Outlook ICS calendar feed. Caches for 5 minutes with 10-minute stale-while-revalidate. Falls back through three CORS proxy services if the primary fails.

### `api/upload-photo.js`
Receives a base64 image from the photo booth, uploads binary to Vercel Blob, and returns the public URL. Requires `BLOB_READ_WRITE_TOKEN` environment variable (set in Vercel dashboard under Storage → Blob store → token).

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
```
https://img1.wsimg.com/isteam/ip/e003f7b8-bd50-4872-a2d0-83a80d992e8e/blob-d682120.png
```

### Image CDN Base URL
```
https://img1.wsimg.com/isteam/ip/e003f7b8-bd50-4872-a2d0-83a80d992e8e/
```

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
- Responsive breakpoints use `@media (max-width: 768px)` for mobile
- Animations use `@keyframes` defined inline
- Hover transitions typically `transition: all 0.3s ease`

When editing styles, check both the desktop and mobile (`max-width: 768px`) sections.

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

## Known Limitations & Pending Work

- [ ] Newsletter signup uses `mailto:` fallback — needs Mailchimp or EmailJS integration
- [ ] Reviews page has placeholder content — needs real Google/Facebook reviews
- [ ] `freeruncellars.com` DNS not yet pointed to Vercel (only `frcwine.com` is live)
- [ ] No Instagram link confirmed (assumed `@freeruncellars`)
- [ ] WordPress migration planned (2-phase: host selection → theme conversion)
- [ ] Wine sales handled externally by Moersch Hospitality Group — no e-commerce on this site

## Recent Fixes (March 2026)

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

---

## External Services

| Service | Purpose | Config Location |
|---------|---------|----------------|
| Anthropic Claude API | AI chat + post generator | `ANTHROPIC_API_KEY` in Vercel env |
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
