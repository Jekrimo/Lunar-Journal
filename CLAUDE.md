# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Lunations is a lunar journal PWA that tracks mood, energy, dreams, and astrology across moon cycles. Live at lunations.app. The frontend is a single vanilla HTML/CSS/JS file (`index.html`) with zero build step. The backend is Vercel serverless functions.

## Development Commands

```bash
# Install dependencies
npm install

# Run locally (serves frontend + API functions)
vercel dev

# Deploy (auto-deploys on push to main via Vercel)
vercel --prod
```

There is no build step, no bundler, no test suite. The app is developed by editing files directly and deploying to Vercel.

## Architecture

### Frontend
- **`index.html`** — the entire app UI (single monolithic file, vanilla JS, ~8800 lines)
- **`landing.html`** — marketing/landing page at `/`
- **`science.html`** — science content page at `/science`
- **`sw.js`** — service worker for offline PWA support
- **`manifest.json`** — PWA manifest

### Backend (Vercel Serverless Functions)
All API routes live in `api/` as individual JS files, mapped via `vercel.json` routing:

- **`api/config.js`** — serves runtime env vars (Supabase URL, Stripe price IDs) as JS to the frontend
- **`api/reading.js`** — proxies to Anthropic Claude API for AI-generated daily readings; has in-memory rate limiting (15/hr per IP)
- **`api/entries.js`** — CRUD for journal entries (authenticated via Supabase)
- **`api/sync.js`** — bulk upsert of entries from localStorage to Supabase
- **`api/profile.js`** — user profile CRUD (name, DOB, birth time, rising sign, settings)
- **`api/people.js`** — manage tracked people (contacts with astro signs); uses ESM (`import`/`export default`)
- **`api/create-checkout.js`** — creates Stripe checkout sessions for subscription tiers
- **`api/billing.js`** — manages Stripe billing portal and subscription status
- **`api/webhook.js`** — Stripe webhook handler; updates user tier in Supabase on subscription events
- **`api/delete-account.js`** — account deletion
- **`api/health.js`** — health check endpoint
- **`api/spaceweather.js`** — space weather data

### Shared Libraries
- **`lib/stripe-client.js`** — Stripe SDK initialization
- **`lib/stripe-webhook.js`** — Stripe webhook event construction/verification

### Database
- **Supabase (Postgres)** with Row Level Security — schema in `api/schema.sql`
- Tables: `profiles`, `entries`, `intentions`; plus a `people` table (schema in `api/signs_table.sql`)
- Auth is Supabase Auth; API functions pass the user's JWT via Authorization header

### Module Style
Most API files use CommonJS (`require`/`module.exports`). Note `api/people.js` uses ESM (`import`/`export default`) — be consistent with whichever style the file already uses.

### Payments
Three tiers: free, plus, pro. Stripe handles subscriptions with monthly/yearly price IDs configured via env vars. The webhook updates the user's `tier` column in the `profiles` table.

## Environment Variables

See `.env.example`. Key vars: `ANTHROPIC_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and Stripe price IDs.

---

## Build Rules (follow every session)

1. **Always validate JS before saving** — after editing `index.html`, extract the last `<script>` block to `/tmp/test_script.js` and run `node --check` before writing the final file.

2. **Never use `font-family:'Cinzel'` inside JS strings** — this breaks template literals. Reference it only in CSS.

3. **Schumann `onerror` regex** — there is a recurring structural bug where a stray `>` after the Schumann card closing div creates orphan Sky tab elements. Re-check and fix this via regex each session if touching that section of `index.html`.

4. **Grep before you edit** — always run `grep -n` + `sed -n` to locate the exact target before any `str_replace`. Never edit blind.

5. **Use Python `content.replace()` as fallback** — if a `str_replace` fails due to whitespace/encoding, fall back to Python file replacement rather than re-attempting str_replace repeatedly.

6. **Always commit, push, and deploy after changes** — after each set of changes, commit to git, push to GitHub (`git push origin main`), and deploy with `vercel --prod`. If GitHub push fails (e.g. account suspended), still deploy via `vercel --prod` and note the push failure.

## Known Issues / Active Work

### people-save bug (`api/people.js`)
- **Problem:** new records with no `cloudId` must use `.insert()` — never pass `undefined` as `id` to Supabase
- **Fix:** check for absence of `cloudId` and branch to `.insert()` for new records vs `.upsert()` for existing

### Vercel auto-deploy broken
- GitHub lockout is blocking Vercel's auto-deploy hook
- Workaround: deploy manually with `vercel --prod`

### localStorage EK key
- Encryption key stored in localStorage under a specific key — do not rename or reassign without migrating existing user data

## Diagnostic Patterns

```js
// Wrap async diagnostics like this:
(async () => { ... })()

// Filter network calls to just API routes:
// use read_network_requests with /api/ filter

// JS validation:
// extract last <script> block → /tmp/test_script.js → node --check
```

## Test User

For relationship compatibility overlay testing:
- **Name:** Maya Torres
- **DOB:** 1991-07-14
- **Sun:** Cancer | **Moon:** Aquarius

## Privacy Model

DOB never leaves the device. Only computed signs (sun, moon, rising) are stored in Supabase. Do not alter this model without explicit instruction.
