import type {IndexRow} from './api';
import type {Stock} from './data';
import {demoOptionPremium} from './pnl';
import type {AutoEvent, PaperAutoPosition} from './autoTrade';

export const INDEX_OPTION_AUTO = {
  name: 'Index option breakout · BUY ABOVE',
  maxPositions: 2,
  lots: 1,
  simulationOnly: true as const
};

export type IndexSpec = {
  key: string;
  title: string;
  match: string;
  step: number;
  lot: number;
  demoSpot: number;
  demoChange: number;
};

export const INDEX_SPECS: IndexSpec[] = [
  {key: 'NIFTY', title: 'NIFTY 50', match: 'NIFTY 50', step: 50, lot: 65, demoSpot: 24850, demoChange: 0.42},
  {key: 'BANKNIFTY', title: 'BANK NIFTY', match: 'NIFTY BANK', step: 100, lot: 15, demoSpot: 55100, demoChange: 0.31},
  {key: 'SENSEX', title: 'SENSEX', match: 'SENSEX', step: 100, lot: 10, demoSpot: 81200, demoChange: 0.28}
];

export type IndexSpot = IndexSpec & {spot: number; change: number; dataStatus: 'LIVE' | 'DEMO'};

export function indexStrike(spot: number, step: number) {
  return Math.round(spot / step) * step;
}

export function tick05(n: number) {
  return +(Math.round(n * 20) / 20).toFixed(2);
}

export type OptionSetup = {
  underlying: string;
  title: string;
  strike: number;
  type: 'CE' | 'PE';
  spot: number;
  change: number;
  premium: number;
  buyAbove: number;
  sl: number;
  tgt: number;
  lot: number;
  dataStatus: 'LIVE' | 'DEMO';
  label: string;
  line: string;
  breakout: boolean;
  reason: string;
  optionChange: number;
  kind: 'INDEX' | 'STOCK';
  underMomentum?: number;
};

export function resolveIndexSpots(indices: IndexRow[], feedMode: string): IndexSpot[] {
  return INDEX_SPECS.map(spec => {
    const row = indices.find(i => i.name === spec.match);
    const live = feedMode === 'LIVE' && row?.dataStatus === 'LIVE' && typeof row.price === 'number' && row.price > 0;
    return {
      ...spec,
      spot: live ? row!.price! : spec.demoSpot,
      change: live ? (row!.changePercent ?? 0) : spec.demoChange,
      dataStatus: live ? 'LIVE' : 'DEMO'
    };
  });
}

export function asIndexStock(spot: IndexSpot): Stock {
  return {
    symbol: spot.key,
    name: spot.title,
    sector: 'Index',
    price: spot.spot,
    change: spot.change,
    volume: '—',
    relVol: 1,
    momentum: 50,
    high: spot.spot,
    low: spot.spot,
    breakout: false,
    dataStatus: spot.dataStatus
  };
}

export function scanOptionBreakout(spot: IndexSpot, strike: number, type: 'CE' | 'PE') {
  const atm = indexStrike(spot.spot, spot.step);
  if (type === 'CE') {
    const ok = spot.change >= 0.35 && strike <= atm + spot.step && spot.spot >= strike - spot.step * 0.4;
    return {breakout: ok, reason: ok ? `Index +${spot.change.toFixed(2)}% · CE breakout near ${strike}` : `No CE breakout · need ≥0.35% up move`};
  }
  const ok = spot.change <= -0.35 && strike >= atm - spot.step && spot.spot <= strike + spot.step * 0.4;
  return {breakout: ok, reason: ok ? `Index ${spot.change.toFixed(2)}% · PE breakout near ${strike}` : `No PE breakout · need ≤-0.35% down move`};
}

export function makeSetup(spot: IndexSpot, strike: number, type: 'CE' | 'PE'): OptionSetup {
  const premium = demoOptionPremium(spot.spot, strike, type);
  const buyAbove = tick05(premium * 1.02);
  const sl = tick05(buyAbove * 0.85);
  const tgt = tick05(buyAbove * 1.3);
  const label = `${spot.key} ${strike} ${type}`;
  const scan = scanOptionBreakout(spot, strike, type);
  const delta = type === 'CE' ? 0.5 : 0.45;
  const indexPts = spot.spot * (spot.change / 100);
  const estPremMove = indexPts * delta * (type === 'CE' ? 1 : -1);
  const optionChange = premium > 0 ? +((estPremMove / premium) * 100).toFixed(2) : 0;
  return {
    underlying: spot.key,
    title: spot.title,
    strike,
    type,
    spot: spot.spot,
    change: spot.change,
    premium,
    buyAbove,
    sl,
    tgt,
    lot: spot.lot,
    dataStatus: spot.dataStatus,
    label,
    line: `${label} BUY ABOVE ${buyAbove}`,
    breakout: scan.breakout,
    reason: scan.reason,
    optionChange,
    kind: 'INDEX' as const
  };
}

export function stockStrikeStep(price: number) {
  if (price >= 5000) return 50;
  if (price >= 1000) return 10;
  if (price >= 200) return 5;
  return 2.5;
}

export function stockLot(price: number) {
  if (price >= 5000) return 50;
  if (price >= 1000) return 250;
  return 500;
}

export function stockAsUnder(s: Stock): IndexSpot {
  const step = stockStrikeStep(s.price);
  const lot = stockLot(s.price);
  return {
    key: s.symbol,
    title: s.name,
    match: s.symbol,
    step,
    lot,
    demoSpot: s.price,
    demoChange: s.change,
    spot: s.price,
    change: s.change,
    dataStatus: s.dataStatus === 'LIVE' ? 'LIVE' : 'DEMO'
  };
}

export function stockOptionSetups(stocks: Stock[]): OptionSetup[] {
  const out: OptionSetup[] = [];
  for (const s of stocks) {
    const under = stockAsUnder(s);
    const atm = indexStrike(s.price, under.step);
    const pairs: [number, 'CE' | 'PE'][] = [[atm, 'CE'], [atm, 'PE'], [atm + under.step, 'CE'], [atm - under.step, 'PE']];
    for (const [strike, type] of pairs) {
      const setup = makeSetup(under, strike, type);
      const ce = type === 'CE' && s.change >= 2 && (s.breakout || s.momentum >= 75);
      const pe = type === 'PE' && s.change <= -2 && s.momentum <= 50;
      setup.kind = 'STOCK';
      setup.underMomentum = s.momentum;
      setup.breakout = ce || pe;
      setup.reason = setup.breakout
        ? `Stock ${s.change.toFixed(2)}% · mom ${s.momentum} · ${type} option scan`
        : `No stock-option ${type} setup on ${s.symbol}`;
      out.push(setup);
    }
  }
  return out.sort((a, b) => Math.abs(b.optionChange) - Math.abs(a.optionChange));
}

export function combinedOptionSetups(indexSpots: IndexSpot[], stocks: Stock[]) {
  return [...indexSetups(indexSpots), ...stockOptionSetups(stocks)];
}

export function combinedMovers(indexSpots: IndexSpot[], stocks: Stock[], threshold: number) {
  return combinedOptionSetups(indexSpots, stocks).filter(s => Math.abs(s.optionChange) >= threshold);
}

export function combinedBreakouts(indexSpots: IndexSpot[], stocks: Stock[]) {
  return combinedOptionSetups(indexSpots, stocks).filter(s => s.breakout);
}

export function indexMovers(spots: IndexSpot[], threshold: number) {
  return indexSetups(spots).filter(s => Math.abs(s.optionChange) >= threshold);
}

export function indexSetups(spots: IndexSpot[]): OptionSetup[] {
  const out: OptionSetup[] = [];
  for (const spot of spots) {
    const atm = indexStrike(spot.spot, spot.step);
    out.push(makeSetup(spot, atm, 'CE'));
    out.push(makeSetup(spot, atm, 'PE'));
    out.push(makeSetup(spot, atm + spot.step, 'CE'));
    out.push(makeSetup(spot, atm - spot.step, 'PE'));
  }
  return out.sort((a, b) => Number(b.breakout) - Number(a.breakout) || Math.abs(b.change) - Math.abs(a.change));
}

export function indexBreakouts(spots: IndexSpot[]) {
  return indexSetups(spots).filter(s => s.breakout);
}

export function specFor(symbol: string) {
  return INDEX_SPECS.find(s => s.key === symbol);
}

export function runIndexOptionAuto(input: {
  spots: IndexSpot[];
  stocks?: Stock[];
  positions: PaperAutoPosition[];
  capital: number;
  allowEntries: boolean;
}) {
  const now = new Date().toLocaleTimeString('en-IN', {timeZone: 'Asia/Kolkata', hour12: false});
  const events: AutoEvent[] = [];
  let positions = [...input.positions];
  const byKey = new Map<string, {spot: number}>([
    ...input.spots.map(s => [s.key, {spot: s.spot}] as const),
    ...(input.stocks || []).map(s => [s.symbol, {spot: s.price}] as const)
  ]);

  for (const pos of [...positions]) {
    if (pos.source !== 'auto' || pos.product !== 'OPTION') continue;
    const spot = byKey.get(pos.symbol);
    if (!spot || !pos.strike || !pos.optionType) continue;
    const mark = demoOptionPremium(spot.spot, pos.strike, pos.optionType);
    const stop = pos.stop ?? pos.entry * 0.85;
    const target = pos.target ?? pos.entry * 1.3;
    let reason = '';
    if (mark <= stop) reason = `option SL ${stop}`;
    else if (mark >= target) reason = `option TGT ${target}`;
    if (!reason) continue;
    positions = positions.filter(p => p !== pos);
    const pnl = (mark - pos.entry) * pos.qty * (pos.lotSize ?? 65) * (pos.side === 'SELL' ? -1 : 1);
    events.push({t: now, kind: 'exit', symbol: pos.label || pos.symbol, text: `Paper option auto exit · ${reason} · P&L ${Math.round(pnl)}`});
  }

  if (!input.allowEntries) return {positions, events, simulationOnly: true as const};

  let opened = positions.filter(p => p.source === 'auto' && p.product === 'OPTION').length;
  const held = new Set(positions.filter(p => p.product === 'OPTION').map(p => p.label || `${p.symbol} ${p.strike} ${p.optionType}`));

  const candidates = combinedOptionSetups(input.spots, input.stocks || []).filter(s => s.breakout || s.optionChange >= 2);
  for (const setup of candidates) {
    if (opened >= INDEX_OPTION_AUTO.maxPositions) break;
    if (held.has(setup.label)) continue;
    const notional = setup.buyAbove * INDEX_OPTION_AUTO.lots * setup.lot;
    const invested = positions.reduce((a, p) => a + p.qty * p.entry * (p.product === 'OPTION' ? (p.lotSize ?? 1) : 1), 0);
    if (invested + notional > input.capital) continue;
    positions.push({
      symbol: setup.underlying,
      qty: INDEX_OPTION_AUTO.lots,
      entry: setup.buyAbove,
      side: 'BUY',
      source: 'auto',
      product: 'OPTION',
      optionType: setup.type,
      strike: setup.strike,
      lotSize: setup.lot,
      entrySpot: setup.spot,
      label: setup.label,
      stop: setup.sl,
      target: setup.tgt,
      openedAt: new Date().toISOString()
    });
    held.add(setup.label);
    opened += 1;
    events.push({t: now, kind: 'entry', symbol: setup.label, text: `Paper auto ${setup.line} · ${setup.reason}`});
  }

  return {positions, events, simulationOnly: true as const};
}
