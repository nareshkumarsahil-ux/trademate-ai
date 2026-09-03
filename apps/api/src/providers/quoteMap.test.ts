import {describe, expect, it} from 'vitest';
import {formatVolume, mapDhanQuote} from './quoteMap.js';

describe('mapDhanQuote', () => {
  it('maps a live Dhan payload and never invents a missing last price', () => {
    const mapped = mapDhanQuote(
      '2885',
      {last_price: 1400.5, net_change: 14, volume: 2500000, ohlc: {open: 1388, high: 1405, low: 1380, close: 1386.5}},
      undefined,
      '2026-08-29T10:00:00.000Z'
    );
    expect(mapped?.symbol).toBe('RELIANCE');
    expect(mapped?.price).toBe(1400.5);
    expect(mapped?.source).toBe('dhan');
    expect(mapped?.dataStatus).toBe('LIVE');
    expect(mapDhanQuote('2885', {last_price: 0}, undefined, '2026-08-29T10:00:00.000Z')).toBeNull();
  });

  it('formats volume without fabricating values', () => {
    expect(formatVolume(0)).toBe('—');
    expect(formatVolume(2500000)).toBe('25.0L');
  });
});
