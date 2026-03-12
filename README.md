# Free Run Cellars — Website

**Live preview:** https://freeruncellars.vercel.app  
**Owners:** Trish Slevin & Prashanth Pais  
**Address:** 10062 Burgoyne Road, Berrien Springs, MI 49103  
**Phone:** (269) 815-6885  
**Email:** contact@frcwine.com  

---

## Project Overview

This repo contains the full website for Free Run Cellars, a boutique winery in Berrien Springs, Michigan. We are prototyping in HTML/CSS here before migrating to a WordPress-hosted site.

**Current stack:** Static HTML → GitHub Pages + Vercel  
**Target stack:** WordPress (WP Engine or Kinsta) + custom theme based on these prototypes

---

## Folder Structure

```
freeruncellars/
├── index.html                  ← Homepage (v4)
├── pages/
│   ├── about.html              ← Our Story (to build)
│   ├── wines.html              ← Wines & Menu (to build)
│   ├── events-calendar.html    ← Live ICS calendar feed ✓
│   ├── live-music-sundays.html ← Live Music SEO page (to build)
│   ├── event-packages.html     ← Private Events & pricing (to build)
│   ├── gallery.html            ← Photo gallery (to build)
│   ├── contact.html            ← Visit Us / Hours / Map (to build)
│   └── reviews.html            ← Review landing page ✓
├── tools/
│   └── post-generator.html     ← Internal: AI Facebook post generator ✓
├── assets/
│   ├── images/                 ← Brand assets inherited from previous owners
│   └── docs/
│       ├── brand-standards.md  ← Colors, fonts, logo usage
│       ├── photo-library.md    ← Full photo inventory with CDN URLs
│       └── image-cdn-swap-guide.md ← How to swap image placeholders
└── .gitignore
```

---

## Page Build Status

| Page | File | Status |
|------|------|--------|
| Homepage | `index.html` | ✅ Built (v4) |
| Events Calendar | `pages/events-calendar.html` | ✅ Built — pulls live ICS feed |
| Review Landing | `pages/reviews.html` | ✅ Built |
| Post Generator | `tools/post-generator.html` | ✅ Built — internal tool for Trish |
| About / Our Story | `pages/about.html` | 🔲 To build |
| Wines | `pages/wines.html` | 🔲 To build |
| Live Music Sundays | `pages/live-music-sundays.html` | 🔲 To build — strong SEO target |
| Event Packages | `pages/event-packages.html` | 🔲 To build |
| Gallery | `pages/gallery.html` | 🔲 To build |
| Visit Us / Contact | `pages/contact.html` | 🔲 To build |

---

## Image Swap Guide

All homepage images are defined as CSS variables at the top of `index.html`:

```css
--img-hero:    url('IMG_1_REPLACE_WITH_CDN_URL');
--img-story:   url('IMG_2_REPLACE_WITH_CDN_URL');
--img-patio:   url('IMG_3_REPLACE_WITH_CDN_URL');
--img-wine:    url('IMG_4_REPLACE_WITH_CDN_URL');
--img-events:  url('IMG_5_REPLACE_WITH_CDN_URL');
--img-wedding: url('IMG_6_REPLACE_WITH_CDN_URL');
--img-pond:    url('IMG_7_REPLACE_WITH_CDN_URL');
--img-sign:    url('IMG_8_REPLACE_WITH_CDN_URL');
```

**To swap:** Upload each photo in GoDaddy Image Manager → copy the CDN URL → paste in place of the placeholder. Format: `https://img1.wsimg.com/isteam/ip/e003f7b8.../filename.jpeg`

| Variable | File | Description |
|----------|------|-------------|
| `--img-hero` | `AS259838.jpeg` | Vineyard rows at golden hour |
| `--img-story` | `R06A2367.jpeg` | Prashanth & Trish toasting |
| `--img-patio` | `R06A1556.jpeg` | Outdoor patio & umbrellas |
| `--img-wine` | `R06A1589r.jpeg` | Pinot Gris bottle on rope swing |
| `--img-events` | `untitled-31.jpeg` | Flutist performing live |
| `--img-wedding` | `untitled-985.jpeg` | Wedding couple in vineyard |
| `--img-pond` | `IMG_4007.jpeg` | Spring-fed pond, blue sky |
| `--img-sign` | `AS259819.jpeg` | Lit exterior sign at dusk |

---

## Brand Standards

**Primary color:** `#537f71` (PMS 625C teal)  
**Secondary:** `#707271` grey · `#cbc7c7` light grey · `#000000` black  
**Primary font:** Uniform → web substitute: **Jost**  
**Accent font:** Znikomitno24 → web substitute: **Cormorant Garamond**  
**Logo:** Block version teal only; white on dark backgrounds  
**Logo CDN:** `https://img1.wsimg.com/isteam/ip/e003f7b8-bd50-4872-a2d0-83a80d992e8e/blob-d682120.png`

---

## Brand Philosophy

**Atithidevo Bhav** — Sanskrit: *the guest is akin to God*

Prashanth grew up spending summers at Mathathota, his grandparents' coffee estate in Chikmagalur, Karnataka, India — where the gate was always open and guests were never strangers. Trish grew up in LaPorte, Indiana and built a career across Chicago, Nashville, and Denver before finding Free Run together with Prashanth. What they've built here draws from both worlds: Midwestern warmth and a deep belief that hospitality isn't a service — it's a way of being.

**Free Run is their home. When you're here, it's yours too.**

---

## Property Facts

- **4 acres** Pinot Gris vines
- **3 acres** walnut trees (lining the driveway)
- **¼ acre** spring-fed pond (turtles & fish)
- **10+ acres** total grounds
- **90 minutes** from Chicago

---

## E-Commerce Notes

Wine is currently sold online via **Moersch Hospitality** to avoid multi-state sales tax complexity. Future plan: migrate to WooCommerce + TaxJar or Avalara once licensing and tax strategy is confirmed. Do not build an in-house shop until that decision is made.

---

## WordPress Migration Plan

1. Finish prototyping all pages as HTML in this repo
2. Choose host: **WP Engine** (~$25–35/mo) or **Kinsta**
3. Convert to WordPress using **Kadence** or **GeneratePress** theme
4. Plugins: Yoast/Rank Math (SEO) · WPForms · Smush · WP Rocket
5. E-commerce via WooCommerce + TaxJar — on a separate timeline

---

## Key SEO Targets by Page

| Page | Target Keywords |
|------|----------------|
| Homepage | "winery Berrien Springs MI", "winery near Chicago" |
| Live Music Sundays | "live music Berrien Springs", "winery live music near Chicago" |
| Private Events | "vineyard wedding Berrien Springs", "winery events Southwest Michigan" |
| Wines | "Pinot Gris Michigan", "Lake Michigan Shore wines" |
| About | "Free Run Cellars owners", "boutique winery Berrien Springs" |
| Visit | "things to do Berrien Springs MI", "Southwest Michigan wine trail" |

---

## Partners & Links

- **Fruitful Vine Tours** — Southwest Michigan wine tours: https://fruitfulvinetours.com
- **If Vines Could Talk Podcast** — Episode 108 with Trish & Prashanth: https://open.spotify.com/episode/2QQvuKemIWH9dlWREocD2u
- **Moersch Hospitality** — Current online wine sales partner

---

*Last updated: March 2026*
