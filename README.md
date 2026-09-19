# TradeMate AI — NSE 500 Market Scanner

Mobile-first market scanner and deterministic paper-trading PWA foundation. **It cannot place real-money orders.** The broker interface is intentionally read-only and contains no `placeOrder`, `modifyOrder`, or `cancelOrder` method.

## Current data mode

Without Dhan credentials the UI uses a small, deterministic fixture set clearly marked **DEMO DATA**. Index values stay unavailable rather than fabricated. After you connect DhanHQ, quotes, funds, holdings, positions and orders are fetched **read-only** from Dhan and labelled **LIVE**. Failed Dhan calls show **LIVE DATA UNAVAILABLE** — prices are never invented. Demo and live data are never mixed.

## Connect DhanHQ (read-only)

1. Login at [web.dhan.co](https://web.dhan.co) → **My Profile → Access DhanHQ APIs**.
2. Generate a 24-hour Access Token. Copy your Client ID.
3. Run **both** `npm run dev` and `npm run dev:api`.
4. In the app: **Settings → Connect DhanHQ** and paste Client ID + token.
5. Token is POSTed to the API server only. It is not stored in the browser.

You can instead put `DHAN_CLIENT_ID` and `DHAN_ACCESS_TOKEN` in `.env` (never in `VITE_*`). TradeMate **cannot place, modify or cancel real orders**. Place those yourself in the official Dhan app.

On Vercel, Connect Dhan stores an **encrypted httpOnly cookie** (not `localStorage`). Set `SESSION_SECRET` in the Vercel dashboard.

## Deploy on Vercel (keeps it online)

Step-by-step (Hindi + English): [`docs/VERCEL.md`](docs/VERCEL.md)

1. Push this repo to GitHub.
2. [vercel.com](https://vercel.com) → Add New Project → import the repo (root `./`).
3. Env: `SESSION_SECRET` (32+ random chars), `BROKER_READ_ONLY=true`. Never add `VITE_DHAN_*`.
4. Deploy. Open `https://your-app.vercel.app` on computer and phone.
5. Settings → Connect DhanHQ. Phone: Add to Home Screen.

```bash
npx vercel --prod
```

## Run locally

```bash
cp .env.example .env
npm install
npm run dev       # web on :5173
npm run dev:api   # API on :4000, separate terminal
npm test
npm run build
```

## Architecture

- `apps/web`: React + TypeScript + Vite, responsive desktop sidebar/mobile bottom navigation
- `apps/api`: Express + TypeScript REST boundary, Zod validation, rate limiting, Helmet
- `prisma/schema.prisma`: PostgreSQL entities and query indexes
- `MarketDataProvider`: quote/history/status/index/subscription abstraction
- `BrokerAdapter`: read-only account abstraction
- `services/engines.ts`: transparent movers, momentum, breakout and paper-order rules

Frontend → Backend API → Provider adapter → licensed data source. The production feed should publish one multiplexed WebSocket with heartbeat, exponential reconnect, timestamps and stale-status transitions.

## Implemented review flows

Dashboard, mover filters, top gainers, momentum, breakouts, local watchlist, stock detail, simulated order ticket with risk metrics, local paper positions, alerts, settings, unavailable states and responsive navigation. Demo orders persist in browser local storage and are explicitly simulation-only.

## Production checklist

1. Import a licensed, current NIFTY 500 constituent file into `Stock`; do not hard-code index membership.
2. Implement a licensed provider and map every object to `timestamp`, `source`, `dataStatus`.
3. Add session authentication, CSRF tokens, authorization and encrypted server-side secrets.
4. Run Prisma migrations, add Redis cache and WebSocket fan-out.
5. Implement server-owned paper ledger with transactions/idempotency, then expand integration tests.
6. Configure HTTPS, secure cookies, CSP, origin allowlist and managed secret storage.
7. Never label delayed/stale/demo data as live.

See [`docs/API.md`](docs/API.md) for endpoint contracts.
