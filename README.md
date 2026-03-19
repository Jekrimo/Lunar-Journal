# 🌙 Lunar Journal

A devotional daily journal that tracks your mood, energy, and inner state alongside the lunar cycle. 13 cycles per year. Personalized daily readings powered by AI. Pattern tracking across cycles.

**Live demo:** *(add your Vercel URL here once deployed)*

---

## What it does

- **Daily readings** — AI-generated interpretation of your natal chart against today's sky
- **Moon phase tracking** — astronomically calculated, every day
- **Planet influence popups** — tap any planet to understand its current effect, cross-referenced with your natal placements
- **Last Cycle comparison** — side-by-side mirror of today vs 29 days ago across all metrics
- **13-cycle calendar** — lunar month view with entry dots and energy bars
- **Pattern charts** — energy and mood averaged by moon phase, revealing your personal rhythms over time
- **Full sky view** — all planetary positions, zodiac strip, year overview

---

## Stack

- **Frontend** — vanilla HTML/CSS/JS, single file, no build step
- **API** — Vercel serverless function (Node.js) proxying Anthropic Claude
- **Storage** — browser localStorage (per-user, private, no database needed)
- **Hosting** — Vercel (free tier)

---

## Deploying

### 1. Fork or clone this repo

```bash
git clone https://github.com/Jekrimo/Lunar-Journal
cd Lunar-Journal
```

### 2. Connect to Vercel

- Go to [vercel.com](https://vercel.com) and sign in with GitHub
- Click **Add New Project** → import `Lunar-Journal`
- Vercel will auto-detect the config from `vercel.json`

### 3. Add your Anthropic API key

In Vercel: **Project Settings → Environment Variables**

```
ANTHROPIC_API_KEY = sk-ant-...your key here...
```

Get a key at [console.anthropic.com](https://console.anthropic.com)

### 4. Deploy

Vercel deploys automatically on every push to `main`. That's it.

---

## Local development

No build step needed. Just open `frontend/index.html` in a browser for the UI.

To test the API function locally, install [Vercel CLI](https://vercel.com/docs/cli):

```bash
npm i -g vercel
vercel dev
```

This spins up the serverless function locally at `localhost:3000/api/reading`.

Create a `.env` file (never commit this):
```
ANTHROPIC_API_KEY=your_key_here
```

---

## Project structure

```
Lunar-Journal/
├── frontend/
│   └── index.html        # The entire app — HTML, CSS, JS in one file
├── api/
│   └── reading.js        # Vercel serverless function — Claude API proxy
├── vercel.json           # Routing config
├── .env.example          # Template for required environment variables
├── .gitignore
└── README.md
```

---

## Roadmap

- [ ] Supabase auth + cloud storage (so entries sync across devices)
- [ ] Transit alerts (when current planets aspect your natal planets)
- [ ] Dream symbol tagging + search
- [ ] Cycle intention thread (set at new moon, visible throughout)
- [ ] Export as printable PDF
- [ ] PWA / installable on mobile
- [ ] Stripe subscription for premium features

---

## Built with

[Claude](https://anthropic.com) · [Vercel](https://vercel.com) · [Chart.js](https://chartjs.org)

---

*Made with devotion. The sky is always reading you back.*
