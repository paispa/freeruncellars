# Free Run Cellars — Website

**Live site:** https://www.frcwine.com  
**Vercel preview:** https://freeruncellars.vercel.app  
**GitHub repo:** https://github.com/paispa/freeruncellars  
**Owners:** Trish Slevin & Prashanth Pais  
**Address:** 10062 Burgoyne Road, Berrien Springs, MI 49103  
**Phone:** (269) 815-6885  
**Email:** contact@frcwine.com  

---

## Project Overview

Full website for Free Run Cellars, a boutique winery in Berrien Springs, Michigan. Currently built as static HTML hosted on Vercel, connected to `frcwine.com` (test domain) while `freeruncellars.com` remains on the existing GoDaddy site. Future plan is to migrate to WordPress.

**Current stack:** Static HTML → GitHub → Vercel → frcwine.com  
**Target stack:** WordPress (WP Engine or Kinsta) + custom theme based on these prototypes  
**DNS:** frcwine.com managed via GoDaddy · A record `216.198.79.1` · CNAME `www` → Vercel  
**Redirect:** `frcwine.com` → `www.frcwine.com` handled by `vercel.json` in repo root

---

## Folder Structure

```
freeruncellars/
├── index.html                  ← Homepage
├── vercel.json                 ← Redirect config (frcwine.com → www.frcwine.com)
├── pages/
│   ├── about.html              ← Our Story
│   ├── wines.html              ← Full wine menu + seasonal cocktails
│   ├── events-calendar.html    ← Live ICS calendar (Outlook)
│   ├── live-music-sundays.html ← Live Music SEO page
│   ├── event-packages.html     ← Private events & pricing
│   ├── gallery.html            ← Photo gallery with lightbox
│   ├── contact.html            ← Visit Us / Hours / Map
│   └── reviews.html            ← Review landing (Google, Yelp, Facebook)
├── tools/
│   ├── post-generator.html     ← Internal: AI Facebook post generator
│   └── photobooth.html         ← Photo booth with EmailJS (needs config keys)
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
| Post Generator | `tools/post-generator.html` | ✅ Internal tool |
| Photo Booth | `tools/photobooth.html` | ⚙️ Built — needs EmailJS keys |

---

## Photo Booth Setup

Fill in the CONFIG block at the top of `tools/photobooth.html`:

```javascript
const CONFIG = {
  emailjs_public_key:      'YOUR_EMAILJS_PUBLIC_KEY',
  emailjs_service_id:      'YOUR_EMAILJS_SERVICE_ID',
  emailjs_template_single: 'YOUR_TEMPLATE_ID_SINGLE_PHOTO',
  emailjs_template_strip:  'YOUR_TEMPLATE_ID_3_PHOTO_STRIP',
  godaddy_payment_url:     'YOUR_GODADDY_TIP_LINK',
};
```

EmailJS is set up under Prashanth's login. Templates are in the EmailJS dashboard.

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
```

Supported types: `live-music` · `tasting` · `special`

---

## Image Swap Guide

Images are CSS variables at the top of each HTML file. To swap: upload to GoDaddy Image Manager → copy CDN URL → paste in.

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
**Logo CDN:** `https://img1.wsimg.com/isteam/ip/e003f7b8-bd50-4872-a2d0-83a80d992e8e/blob-d682120.png`

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

- [ ] EmailJS keys → fill into photo booth CONFIG
- [ ] GoDaddy tip/payment link → fill into photo booth CONFIG
- [ ] Switch `freeruncellars.com` DNS to Vercel when ready
- [ ] Replace placeholder reviews with real Google/Facebook reviews
- [ ] Newsletter → connect to proper email list (Mailchimp or EmailJS)
- [ ] Josh Bishop (preferred caterer) — add to site once permission confirmed
- [ ] Instagram handle confirmation (@freeruncellars assumed)
- [ ] Blog: Chikmagalur coffee terroir vs SW Michigan wine terroir
- [ ] AI chatbot / inquiry assistant
- [ ] Partnership page for neighboring vineyards

---

*Last updated: March 2026*
