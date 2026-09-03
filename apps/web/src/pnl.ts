import type {Stock} from './data';
import type {PaperAutoPosition} from './autoTrade';

export type Position = PaperAutoPosition;

export function roundStrike(spot: number) {
  if (spot >= 5000) return Math.round(spot / 50) * 50;
  if (spot >= 1000) return Math.round(spot / 10) * 10;
  return Math.round(spot / 5) * 5;
}

/** Educational demo premium — never a live option-chain quote. */
export function demoOptionPremium(spot: number, strike: number, type: 'CE' | 'PE') {
  const intrinsic = type === 'CE' ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
  const time = Math.max(spot * 0.008, 2);
  return +Math.max(0.05, intrinsic + time).toFixed(2);
}

export function markPosition(p: Position, stocks: Stock[]) {
  const spot = stocks.find(s => s.symbol === p.symbol)?.price ?? p.entrySpot ?? p.entry;
  const side = p.side === 'SELL' ? -1 : 1;
  if (p.product === 'OPTION') {
    const strike = p.strike ?? roundStrike(spot);
    const type = p.optionType ?? 'CE';
    const premium = demoOptionPremium(spot, strike, type);
    const multiplier = p.lotSize ?? 50;
    const pnl = (premium - p.entry) * p.qty * multiplier * side;
    return {mark: premium, pnl, invested: p.entry * p.qty * multiplier, spot, label: p.label || `${p.symbol} ${strike} ${type}`};
  }
  const pnl = (spot - p.entry) * p.qty * side;
  return {mark: spot, pnl, invested: p.entry * p.qty, spot, label: p.symbol};
}

export function bookSummary(positions: Position[], stocks: Stock[]) {
  return positions.reduce((a, p) => {
    const m = markPosition(p, stocks);
    a.pnl += m.pnl;
    a.invested += m.invested;
    return a;
  }, {pnl: 0, invested: 0});
}

export type Idea = {symbol: string; action: 'PAPER BUY' | 'PAPER SELL' | 'WATCH'; reason: string};

export function recommend(s: Stock): Idea {
  if (s.change >= 2 && s.change <= 7 && s.momentum >= 75 && s.breakout) {
    return {symbol: s.symbol, action: 'PAPER BUY', reason: `Momentum ${s.momentum} with ${s.change.toFixed(2)}% breakout in the 2–7% band`};
  }
  if (s.change <= -2 && s.momentum <= 45) {
    return {symbol: s.symbol, action: 'PAPER SELL', reason: `Weak momentum ${s.momentum} with ${s.change.toFixed(2)}% session`};
  }
  return {symbol: s.symbol, action: 'WATCH', reason: 'No conservative cash setup on this snapshot'};
}

export function ideasFor(stocks: Stock[]) {
  const recs = stocks.map(recommend);
  return {
    buys: recs.filter(r => r.action === 'PAPER BUY'),
    sells: recs.filter(r => r.action === 'PAPER SELL'),
    watch: recs.filter(r => r.action === 'WATCH')
  };
}
