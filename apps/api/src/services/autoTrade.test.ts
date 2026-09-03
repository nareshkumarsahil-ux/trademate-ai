import {describe, expect, it} from 'vitest';
import {evaluateEntry, evaluateExit, runPaperAuto, sizePaperQty, type AutoSnapshot} from './autoTrade.js';

const snap = (extra: Partial<AutoSnapshot> = {}): AutoSnapshot => ({
  symbol: 'INFY',
  price: 1800,
  changePercent: 3.2,
  momentum: 83,
  relVol: 1.9,
  breakout: true,
  ...extra
});

describe('paper auto rules', () => {
  it('takes a conservative momentum breakout', () => {
    expect(evaluateEntry(snap()).ok).toBe(true);
  });

  it('does not chase a 10% extension', () => {
    expect(evaluateEntry(snap({changePercent: 10.4, symbol: 'SBIN'})).ok).toBe(false);
  });

  it('skips weak momentum', () => {
    expect(evaluateEntry(snap({momentum: 61, breakout: false, relVol: 1})).ok).toBe(false);
  });

  it('sizes from 1% risk, 2% stop and 20% name cap', () => {
    expect(sizePaperQty(100, 1_000_000)).toBe(2000);
  });

  it('exits at stop and target', () => {
    const pos = {symbol: 'INFY', qty: 10, entry: 100, side: 'BUY' as const, source: 'auto' as const};
    expect(evaluateExit(pos, snap({price: 97.9, changePercent: -2})).exit).toBe(true);
    expect(evaluateExit(pos, snap({price: 104.1, changePercent: 4})).exit).toBe(true);
  });

  it('opens at most 3 paper longs and never marks a live broker order', () => {
    const quotes = [
      snap({symbol: 'A', momentum: 90}),
      snap({symbol: 'B', momentum: 88}),
      snap({symbol: 'C', momentum: 86}),
      snap({symbol: 'D', momentum: 84})
    ];
    const result = runPaperAuto({quotes, positions: [], capital: 1_000_000, allowEntries: true});
    expect(result.simulationOnly).toBe(true);
    expect(result.positions.filter(p => p.source === 'auto')).toHaveLength(3);
    expect(result.events.every(e => e.status === 'SIMULATED')).toBe(true);
  });
});
