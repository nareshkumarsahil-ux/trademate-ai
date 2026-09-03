import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import {z} from 'zod';
import {loadEnv} from './loadEnv.js';
import {attachSession, clearSession, getSession, maskClientId, setSession} from './credentials.js';
import {nseMarketStatus} from './marketHours.js';
import {DhanHttpError} from './providers/dhanHttp.js';
import {DhanReadOnlyAdapter} from './providers/DhanReadOnlyAdapter.js';
import {DhanMarketDataProvider, invalidateQuoteCache} from './providers/DhanMarketDataProvider.js';
import type {Quote} from './providers/MarketDataProvider.js';
import {bySymbol} from './providers/universe.js';
import {defaultBookId, getBook, paperDurable, putBook} from './paperStore.js';

loadEnv();

const app = express();
const liveMarket = new DhanMarketDataProvider();

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({origin: process.env.WEB_ORIGIN || true, credentials: true}));
app.use(express.json({limit: '80kb'}));
app.use(attachSession);
app.use('/api', rateLimit({windowMs: 60_000, limit: 120, validate: {xForwardedForHeader: false}}));
const connectLimit = rateLimit({windowMs: 60_000, limit: 10, validate: {xForwardedForHeader: false}});

function publicProfile(profile: unknown) {
  if (!profile || typeof profile !== 'object') return null;
  const p = profile as Record<string, unknown>;
  return {
    dhanClientId: typeof p.dhanClientId === 'string' ? maskClientId(p.dhanClientId) : undefined,
    tokenValidity: p.tokenValidity ?? p.expiryTime,
    activeSegment: p.activeSegment,
    dataPlan: p.dataPlan,
    dataValidity: p.dataValidity
  };
}

function broker() {
  const session = getSession();
  if (!session) return null;
  return new DhanReadOnlyAdapter(session.accessToken, session.clientId);
}

function fail(res: express.Response, err: unknown) {
  if (err instanceof DhanHttpError) return res.status(err.status === 401 ? 401 : 503).json({error: err.safeMessage, dataStatus: 'UNAVAILABLE'});
  return res.status(503).json({error: 'LIVE DATA UNAVAILABLE', dataStatus: 'UNAVAILABLE'});
}

app.get('/api/health', (_req, res) => {
  const session = getSession();
  res.json({
    ok: true,
    mode: session ? 'dhan-readonly' : 'unavailable',
    broker: session ? 'dhan' : null,
    readOnly: true
  });
});

app.get('/api/broker/status', async (_req, res) => {
  const session = getSession();
  if (!session) {
    return res.json({
      connected: false,
      broker: null,
      readOnly: true,
      marketData: 'UNAVAILABLE',
      orderPlacement: false,
      message: 'No broker connected. Live order placement is intentionally not implemented.'
    });
  }
  try {
    const profile = await new DhanReadOnlyAdapter(session.accessToken, session.clientId).getProfile();
    res.json({
      connected: true,
      broker: 'dhan',
      readOnly: true,
      source: session.source,
      clientIdMasked: maskClientId(session.clientId),
      connectedAt: session.connectedAt,
      marketData: 'LIVE',
      orderPlacement: false,
      profile: publicProfile(profile)
    });
  } catch (err) {
    fail(res, err);
  }
});

app.post('/api/broker/connect', connectLimit, async (req, res) => {
  const parsed = z.object({
    clientId: z.string().trim().min(4).max(32).regex(/^[A-Za-z0-9]+$/),
    accessToken: z.string().trim().min(20).max(4096)
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'Enter a valid Dhan Client ID and Access Token'});
  try {
    const adapter = new DhanReadOnlyAdapter(parsed.data.accessToken, parsed.data.clientId);
    const profile = await adapter.getProfile();
    try {
      setSession(parsed.data.clientId, parsed.data.accessToken, 'ui');
    } catch (err) {
      if (err instanceof Error && err.message === 'TOKEN_TOO_LARGE') {
        return res.status(413).json({error: 'Token too large for a browser cookie. Set DHAN_CLIENT_ID and DHAN_ACCESS_TOKEN in Vercel env instead.'});
      }
      throw err;
    }
    invalidateQuoteCache();
    res.json({
      connected: true,
      broker: 'dhan',
      readOnly: true,
      clientIdMasked: maskClientId(parsed.data.clientId),
      profile: publicProfile(profile),
      orderPlacement: false
    });
  } catch (err) {
    fail(res, err);
  }
});

app.post('/api/broker/disconnect', (_req, res) => {
  clearSession();
  invalidateQuoteCache();
  res.json({connected: false, broker: null, readOnly: true, orderPlacement: false});
});

app.get('/api/broker/profile', async (_req, res) => {
  const adapter = broker();
  if (!adapter) return res.status(401).json({error: 'Dhan is not connected', dataStatus: 'UNAVAILABLE'});
  try {
    res.json({item: publicProfile(await adapter.getProfile()), readOnly: true});
  } catch (err) {
    fail(res, err);
  }
});

app.get('/api/broker/funds', async (_req, res) => {
  const adapter = broker();
  if (!adapter) return res.status(401).json({error: 'Dhan is not connected', dataStatus: 'UNAVAILABLE'});
  try {
    res.json({item: await adapter.getFunds(), readOnly: true});
  } catch (err) {
    fail(res, err);
  }
});

app.get('/api/broker/holdings', async (_req, res) => {
  const adapter = broker();
  if (!adapter) return res.status(401).json({error: 'Dhan is not connected', dataStatus: 'UNAVAILABLE'});
  try {
    res.json({items: await adapter.getHoldings(), readOnly: true});
  } catch (err) {
    fail(res, err);
  }
});

app.get('/api/broker/positions', async (_req, res) => {
  const adapter = broker();
  if (!adapter) return res.status(401).json({error: 'Dhan is not connected', dataStatus: 'UNAVAILABLE'});
  try {
    res.json({items: await adapter.getPositions(), readOnly: true});
  } catch (err) {
    fail(res, err);
  }
});

app.get('/api/broker/orders', async (_req, res) => {
  const adapter = broker();
  if (!adapter) return res.status(401).json({error: 'Dhan is not connected', dataStatus: 'UNAVAILABLE'});
  try {
    res.json({items: await adapter.getOrders(), readOnly: true});
  } catch (err) {
    fail(res, err);
  }
});

app.get('/api/market/status', async (_req, res) => {
  const hours = nseMarketStatus();
  if (!getSession()) {
    return res.json({timestamp: new Date().toISOString(), source: 'none', dataStatus: 'UNAVAILABLE', status: hours.status});
  }
  try {
    res.json(await liveMarket.getMarketStatus());
  } catch (err) {
    fail(res, err);
  }
});

app.get('/api/indices', async (_req, res) => {
  if (!getSession()) return res.json({items: [], dataStatus: 'UNAVAILABLE'});
  try {
    const items = await liveMarket.getIndexData();
    res.json({items, dataStatus: 'LIVE', timestamp: new Date().toISOString(), source: 'dhan'});
  } catch (err) {
    fail(res, err);
  }
});

app.get('/api/stocks', async (_req, res) => {
  if (!getSession()) return res.json({items: [], dataStatus: 'UNAVAILABLE', source: 'none', timestamp: new Date().toISOString()});
  try {
    const quotes = await liveMarket.getQuotes();
    const items = quotes.map(q => {
      const extra = q as Quote & {volumeLabel?: string; relVol?: number; momentum?: number; breakout?: boolean; name?: string; sector?: string};
      const listed = bySymbol.get(q.symbol);
      return {
        symbol: q.symbol,
        name: extra.name ?? listed?.name ?? q.symbol,
        sector: extra.sector ?? listed?.sector ?? 'NSE',
        price: q.price,
        change: q.changePercent,
        volume: extra.volumeLabel ?? String(q.volume || '—'),
        relVol: extra.relVol ?? 1,
        momentum: extra.momentum ?? 0,
        high: q.high,
        low: q.low,
        open: q.open,
        breakout: extra.breakout ?? false,
        dataStatus: q.dataStatus,
        source: q.source,
        timestamp: q.timestamp
      };
    });
    res.json({items, dataStatus: items.length ? 'LIVE' : 'UNAVAILABLE', source: 'dhan', timestamp: new Date().toISOString()});
  } catch (err) {
    fail(res, err);
  }
});

app.get('/api/stocks/:symbol', async (req, res) => {
  const parsed = z.string().regex(/^[A-Z0-9&-]{1,24}$/).safeParse(req.params.symbol);
  if (!parsed.success) return res.status(400).json({error: 'Invalid symbol'});
  if (!getSession()) return res.status(503).json({error: 'LIVE DATA UNAVAILABLE', dataStatus: 'UNAVAILABLE'});
  try {
    const q = await liveMarket.getQuote(parsed.data);
    if (!q) return res.status(503).json({error: 'No live quote available.', dataStatus: 'UNAVAILABLE'});
    res.json(q);
  } catch (err) {
    fail(res, err);
  }
});

const bookIdSchema = z.string().trim().toUpperCase().regex(/^TM-[A-Z0-9]{4,12}$/);
const paperBody = z.object({
  positions: z.array(z.object({
    symbol: z.string().min(1).max(32),
    qty: z.number(),
    entry: z.number(),
    side: z.enum(['BUY', 'SELL'])
  }).passthrough()).max(80),
  watch: z.array(z.string().max(24)).max(100).optional(),
  updatedAt: z.number().int().positive().optional()
});

app.get('/api/paper/config', (_req, res) => {
  res.json({defaultBookId: defaultBookId(), durable: paperDurable()});
});

app.get('/api/paper/book/:id', async (req, res) => {
  const parsed = bookIdSchema.safeParse(req.params.id);
  if (!parsed.success) return res.status(400).json({error: 'Invalid book id'});
  const book = await getBook(parsed.data);
  res.json({
    id: parsed.data,
    positions: book?.positions || [],
    watch: (book as {watch?: string[]} | null)?.watch || [],
    updatedAt: book?.updatedAt || 0,
    durable: paperDurable()
  });
});

app.put('/api/paper/book/:id', async (req, res) => {
  const id = bookIdSchema.safeParse(req.params.id);
  if (!id.success) return res.status(400).json({error: 'Invalid book id'});
  const parsed = paperBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'Invalid paper book'});
  const saved = await putBook(id.data, {
    positions: parsed.data.positions,
    updatedAt: parsed.data.updatedAt || Date.now(),
    watch: parsed.data.watch
  } as {updatedAt: number; positions: unknown[]; watch?: string[]});
  res.json({ok: true, id: id.data, updatedAt: saved.updatedAt, durable: paperDurable()});
});

app.post('/api/paper/orders', (req, res) => {
  const parsed = z.object({
    symbol: z.string().regex(/^[A-Z0-9&-]+$/),
    side: z.enum(['BUY', 'SELL']),
    quantity: z.number().int().positive(),
    price: z.number().positive(),
    stopLoss: z.number().positive().optional(),
    target: z.number().positive().optional()
  }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({error: 'Validation failed', issues: parsed.error.issues});
  res.status(201).json({...parsed.data, id: crypto.randomUUID(), paperTrade: true, status: 'SIMULATED'});
});

app.use('/api', (_req, res) => res.status(404).json({error: 'Not found'}));
app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({error: 'Service temporarily unavailable'});
});

export {app};
export default app;

if (!process.env.VERCEL) {
  app.listen(Number(process.env.PORT || 4000), '0.0.0.0', () => {
    console.log('TradeMate API ready (read-only broker, no order placement)');
  });
}
