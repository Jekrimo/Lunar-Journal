# 🌙 Lunar Journal

A devotional daily journal that tracks your mood, energy, and inner state alongside the lunar cycle. 13 cycles per year. Personalized daily readings powered by AI. Pattern tracking across cycles.

**Live:** https://lunar-journal-lac.vercel.app

---

## Features

- **Landing screen** — clean intro for new visitors
- **Daily AI readings** — personalized to your natal chart + today's sky
- **Moon phase tracking** — astronomically calculated
- **Planet influence popups** — tap any planet for interpretation + natal cross-reference  
- **Transit alerts** — flags when current sky hits your natal placements
- **Cycle intention** — set at new moon, stays visible for 29 days
- **Last Cycle comparison** — side-by-side mirror of today vs 29 days ago
- **13-cycle calendar** — lunar month grid with entry dots and energy bars
- **Pattern charts** — energy/mood averaged by moon phase over time
- **Full sky view** — all planetary positions, zodiac strip, year overview
- **Export** — download all entries as JSON
- **PWA** — installable on phone, works offline

---

## Stack

- **Frontend** — vanilla HTML/CSS/JS, single file, zero build step
- **API** — Vercel serverless function proxying Anthropic Claude (rate limited)
- **Storage** — browser localStorage (private, no database)
- **Hosting** — Vercel free tier

---

## Repo structure

```
Lunar-Journal/
├── public/
│   ├── index.html      # The entire app
│   ├── manifest.json   # PWA manifest
│   └── sw.js           # Service worker (offline support)
├── api/
│   └── reading.js      # Secure Claude API proxy with rate limiting
├── vercel.json         # Routing config
├── .env.example        # Required environment variables
├── .gitignore
└── README.md
```

---

## Deploy

### 1. Clone and push to your GitHub

```bash
git clone https://github.com/Jekrimo/Lunar-Journal
# drop in files, then:
git add . && git commit -m "v2" && git push
```

### 2. Connect to Vercel

- [vercel.com](https://vercel.com) → Add New Project → import repo
- Vercel auto-detects `vercel.json`

### 3. Add environment variable

In Vercel: **Project Settings → Environment Variables**

```
ANTHROPIC_API_KEY = sk-ant-...
```

Get a key at [console.anthropic.com](https://console.anthropic.com)

### 4. Done — auto-deploys on every push to main

---

## Local dev

```bash
npm i -g vercel
vercel dev
```

Create `.env` locally:
```
ANTHROPIC_API_KEY=your_key
```

---

## Roadmap

- [ ] Supabase auth + cloud sync (entries across devices)
- [ ] Dream symbol tagging + search
- [ ] Printable cycle report PDF
- [ ] Stripe subscription tier
- [ ] Custom domain

---

*Made with devotion. The sky is always reading you back.*
