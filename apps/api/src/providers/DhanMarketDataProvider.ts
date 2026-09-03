import {nseMarketStatus} from '../marketHours.js';
import {getSession} from '../credentials.js';
import {dhanPost} from './dhanHttp.js';
import type {MarketDataProvider, Quote} from './MarketDataProvider.js';
import {mapDhanQuote, type DhanQuotePayload} from './quoteMap.js';
import {INDEX_UNIVERSE, NSE_EQUITY_UNIVERSE, bySymbol} from './universe.js';

type Cached = {at: number; quotes: ReturnType<typeof mapDhanQuote>[]};

const quoteCache = new Map<string, Cached>();
const TTL_MS = 2500;

function meta() {
  return {timestamp: new Date().toISOString(), source: 'dhan' as const, dataStatus: 'LIVE' as const};
}

export class DhanMarketDataProvider implements MarketDataProvider {
  private creds() {
    const session = getSession();
    if (!session) throw new Error('Dhan is not connected');
    return session;
  }

  private async fetchQuotes() {
    const {accessToken, clientId} = this.creds();
    const hit = quoteCache.get(clientId);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.quotes;
    const ids = NSE_EQUITY_UNIVERSE.map(s => s.securityId);
    const payload = await dhanPost('/marketfeed/quote', accessToken, clientId, {NSE_EQ: ids});
    const nowIso = new Date().toISOString();
    const bucket = (payload as {data?: {NSE_EQ?: Record<string, DhanQuotePayload>}} | null)?.data?.NSE_EQ ?? {};
    const quotes = Object.entries(bucket)
      .map(([id, q]) => mapDhanQuote(id, q ?? {}, undefined, nowIso))
      .filter((q): q is NonNullable<typeof q> => q !== null);
    quoteCache.set(clientId, {at: Date.now(), quotes});
    return quotes;
  }

  async getQuotes(symbols?: string[]) {
    const all = await this.fetchQuotes();
    const wanted = symbols?.length ? new Set(symbols) : null;
    return all.filter(q => q && (!wanted || wanted.has(q.symbol))) as Quote[];
  }

  async getQuote(symbol: string) {
    const listed = bySymbol.get(symbol);
    if (!listed) return null;
    const all = await this.fetchQuotes();
    return (all.find(q => q?.symbol === symbol) as Quote | undefined) ?? null;
  }

  async getHistoricalData() {
    return [];
  }

  async getMarketStatus() {
    const session = nseMarketStatus();
    return {...meta(), status: session.status};
  }

  async getIndexData() {
    const {accessToken, clientId} = this.creds();
    const body: Record<string, number[]> = {};
    for (const row of INDEX_UNIVERSE) {
      body[row.segment] = [...(body[row.segment] ?? []), row.securityId];
    }
    const payload = await dhanPost('/marketfeed/ohlc', accessToken, clientId, body);
    const data = (payload as {data?: Record<string, Record<string, DhanQuotePayload>>} | null)?.data ?? {};
    const nowIso = new Date().toISOString();
    return INDEX_UNIVERSE.map(row => {
      const q = data[row.segment]?.[String(row.securityId)];
      const last = Number(q?.last_price);
      const prev = Number(q?.ohlc?.close);
      if (!Number.isFinite(last) || last <= 0) {
        return {name: row.symbol, dataStatus: 'UNAVAILABLE' as const, timestamp: nowIso, source: 'dhan'};
      }
      const change = Number.isFinite(prev) && prev > 0 ? last - prev : 0;
      const changePercent = Number.isFinite(prev) && prev > 0 ? (change / prev) * 100 : 0;
      return {
        name: row.symbol,
        price: last,
        change,
        changePercent: +changePercent.toFixed(2),
        dataStatus: 'LIVE' as const,
        timestamp: nowIso,
        source: 'dhan'
      };
    });
  }

  subscribeMarketFeed(_symbols: string[], _onQuote: (q: Quote) => void) {
    return () => {};
  }
}

export function invalidateQuoteCache() {
  quoteCache.clear();
}
