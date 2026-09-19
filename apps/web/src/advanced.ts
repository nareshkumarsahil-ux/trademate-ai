import type {Stock} from './data';
import type {OptionSetup} from './indexOptions';

export function prevClose(s: Stock) {
  return s.price / (1 + s.change / 100);
}

export function gapPercent(s: Stock) {
  const prev = prevClose(s);
  const open = s.open ?? s.price;
  if (!prev) return 0;
  return +((open - prev) / prev * 100).toFixed(2);
}

export function vwap(s: Stock) {
  return +(((s.high + s.low + s.price) / 3)).toFixed(2);
}

export function volumeSpikes(stocks: Stock[], minRel = 2) {
  return [...stocks].filter(s => s.relVol >= minRel).sort((a, b) => b.relVol - a.relVol);
}

export function gapScan(stocks: Stock[]) {
  return [...stocks].map(s => ({...s, gap: gapPercent(s)})).filter(s => Math.abs(s.gap) >= 1).sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap));
}

export function sectorHeat(stocks: Stock[]) {
  const map = new Map<string, {name: string; n: number; avg: number; up: number}>();
  for (const s of stocks) {
    const row = map.get(s.sector) || {name: s.sector, n: 0, avg: 0, up: 0};
    row.n += 1;
    row.avg += s.change;
    if (s.change > 0) row.up += 1;
    map.set(s.sector, row);
  }
  return [...map.values()].map(r => ({...r, avg: +(r.avg / r.n).toFixed(2)})).sort((a, b) => b.avg - a.avg);
}

export function optionBreadth(setups: OptionSetup[]) {
  const ce = setups.filter(s => s.type === 'CE');
  const pe = setups.filter(s => s.type === 'PE');
  const ceBr = ce.filter(s => s.breakout).length;
  const peBr = pe.filter(s => s.breakout).length;
  const pcr = ceBr + peBr === 0 ? 1 : peBr / Math.max(1, ceBr);
  return {ce: ce.length, pe: pe.length, ceBr, peBr, pcr: +pcr.toFixed(2)};
}
