import {breakout, momentum, type ScanQuote} from '../services/engines.js';
import type {Quote} from './MarketDataProvider.js';
import {bySecurityId, type ListedStock} from './universe.js';

export type DhanOhlc = {open?: number; high?: number; low?: number; close?: number};
export type DhanQuotePayload = {
  last_price?: number;
  net_change?: number;
  volume?: number;
  last_trade_time?: string;
  average_price?: number;
  ohlc?: DhanOhlc;
};

export function formatVolume(n: number) {
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1e7) return `${(n / 1e7).toFixed(1)}Cr`;
  if (n >= 1e5) return `${(n / 1e5).toFixed(1)}L`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return String(Math.round(n));
}

export function mapDhanQuote(
  securityId: string,
  payload: DhanQuotePayload,
  meta: ListedStock | undefined,
  nowIso: string
): (Quote & {volumeLabel: string; relVol: number; momentum: number; breakout: boolean; name: string; sector: string}) | null {
  const last = Number(payload.last_price);
  if (!Number.isFinite(last) || last <= 0) return null;
  const listed = meta ?? bySecurityId.get(String(securityId));
  if (!listed) return null;
  const ohlc = payload.ohlc ?? {};
  const previousClose = Number(ohlc.close);
  const open = Number(ohlc.open);
  const high = Number(ohlc.high);
  const low = Number(ohlc.low);
  const prev = Number.isFinite(previousClose) && previousClose > 0 ? previousClose : null;
  const net = Number(payload.net_change);
  const change = Number.isFinite(net) ? net : prev ? last - prev : 0;
  const changePercent = prev ? (change / prev) * 100 : 0;
  const volume = Number(payload.volume);
  const vol = Number.isFinite(volume) && volume > 0 ? volume : 0;
  const safeHigh = Number.isFinite(high) && high > 0 ? high : last;
  const safeLow = Number.isFinite(low) && low > 0 ? low : last;
  const safeOpen = Number.isFinite(open) && open > 0 ? open : last;
  const scan: ScanQuote = {
    symbol: listed.symbol,
    changePercent,
    relativeVolume: 1,
    intradayRangePercent: prev ? ((safeHigh - safeLow) / prev) * 100 : 0,
    distanceFromHighPercent: last ? ((safeHigh - last) / last) * 100 : 0,
    aboveShortMA: last >= safeOpen,
    breakoutLevel: safeHigh,
    price: last
  };
  const score = momentum(scan).score;
  return {
    timestamp: nowIso,
    source: 'dhan',
    dataStatus: 'LIVE',
    symbol: listed.symbol,
    price: last,
    previousClose: prev ?? last,
    change,
    changePercent: +changePercent.toFixed(2),
    open: safeOpen,
    high: safeHigh,
    low: safeLow,
    volume: vol,
    volumeLabel: formatVolume(vol),
    relVol: 1,
    momentum: score,
    breakout: breakout(scan, 1, 0),
    name: listed.name,
    sector: listed.sector
  };
}
