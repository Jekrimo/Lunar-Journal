# 🌙 Lunations

**A lunar journal. Track yourself across cycles.**

A lunation is one complete cycle of the moon — 29.5 days of inner weather. Lunations helps you track yours across all 13 cycles of the year, with personalized daily readings, Vedic astrology, and pattern insight that deepens over time.

**Live:** https://lunations.app *(or current: https://lunar-journal-lac.vercel.app)*

---

## What it does

- **Daily readings** — AI-generated, personalized to your natal chart against today's sky
- **Moon phase tracking** — astronomically calculated every day
- **Vedic day panel** — Tithi, Nakshatra, and Vara with quality indicators and ritual guidance
- **Planet influence popups** — tap any planet for interpretation cross-referenced with your natal placements
- **Transit alerts** — flags when current planets hit your natal positions
- **Cycle intention** — set at the new moon, stays visible the full 29 days
- **Last Cycle comparison** — side-by-side mirror of today vs 29 days ago
- **13-cycle calendar** — full lunar year view with entry dots and energy bars
- **Pattern charts** — energy and mood averaged by moon phase, revealing your rhythms over time
- **Full sky view** — all planetary positions, zodiac strip, 13-cycle year overview
- **Settings** — icon picker, display toggles, backup and restore
- **Export / Import** — full JSON backup of all entries and profile
- **PWA** — installable on phone, works offline

---

## Stack

- **Frontend** — vanilla HTML/CSS/JS, single file, zero build step
- **API** — Vercel serverless function proxying Anthropic Claude Haiku (rate limited 10/hr per IP)
- **Storage** — browser localStorage (private, no database required)
- **Hosting** — Vercel free tier

---

## Repo structure

```
Lunations/
├── index.html              # The entire app
├── manifest.json           # PWA manifest
├── sw.js                   # Service worker (offline support)
├── icon-192.png            # App icon
├── icon-512.png            # App icon large
├── api/
│   └── reading.js          # Secure Claude API proxy with rate limiting
├── vercel.json             # Routing config
├── .env.example            # Required environment variables
├── .gitignore
└── README.md
```

---

## Deploy

### 1. Clone

```bash
git clone https://github.com/Jekrimo/Lunar-Journal
cd Lunar-Journal
```

### 2. Connect to Vercel

- [vercel.com](https://vercel.com) → Add New Project → import repo
- All build settings blank

### 3. Add environment variable

**Project Settings → Environment Variables**
```
ANTHROPIC_API_KEY = sk-ant-...
```

Get a key at [console.anthropic.com](https://console.anthropic.com)

### 4. Deploy — auto-deploys on every push to main

---

## Local dev

Open `index.html` directly in a browser for the full UI.

For the API function locally:
```bash
npm i -g vercel
vercel dev
```

---

## Roadmap

- [ ] Custom domain — lunations.app
- [ ] Supabase auth + cloud sync (entries across devices)
- [ ] Dream symbol tagging + search
- [ ] Printable cycle report
- [ ] Stripe subscription tier
- [ ] Transit depth — aspects, not just sign conjunctions

---

*Lunations — a lunar journal. Track yourself across cycles.*
*The sky is always reading you back.*
