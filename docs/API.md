# API outline

All responses containing market data include `timestamp`, `source`, and `dataStatus` (`LIVE`, `DELAYED`, `STALE`, `UNAVAILABLE`, or `DEMO`). Validation errors return HTTP 400; provider outages use 503 and never fabricate a quote.

Broker credentials are accepted only by `POST /api/broker/connect`. They are stored in an encrypted httpOnly cookie (Vercel/serverless) or `DHAN_*` env vars — never in `localStorage` or frontend bundles. They are never returned to the client. There is no `placeOrder`, `modifyOrder`, or `cancelOrder` route.

- `GET /api/health`
- `GET /api/market/status`
- `GET /api/indices`
- `GET /api/stocks?page=1&limit=50&search=RELIANCE`
- `GET /api/stocks/:symbol`
- `POST /api/broker/connect` `{ clientId, accessToken }` — validates against Dhan `/profile`, read-only
- `POST /api/broker/disconnect`
- `GET /api/broker/status`
- `GET /api/broker/profile`
- `GET /api/broker/funds`
- `GET /api/broker/holdings`
- `GET /api/broker/positions`
- `GET /api/broker/orders`
- `POST /api/paper/orders`

`POST /api/paper/orders` accepts `{ symbol, side, quantity, price, stopLoss?, target? }` and always returns `paperTrade: true`, `status: "SIMULATED"`. It is not connected to a broker.
