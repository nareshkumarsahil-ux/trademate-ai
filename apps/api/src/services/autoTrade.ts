/** Paper-only auto trader. Never sends broker orders. */
export const DEFAULT_AUTO_RULES = {
  name: 'Momentum Breakout Conservative',
  minChangePercent: 2,
  maxChangePercent: 7,
  minMomentum: 75,
  minRelVol: 1.5,
  stopPercent: 2,
  targetPercent: 4,
  fadeMomentum: 45,
  maxPositions: 3,
  riskPercent: 1,
  maxNamePercent: 20,
  longOnly: true,
  simulationOnly: true as const
};

export type AutoRules = typeof DEFAULT_AUTO_RULES;

export type AutoSnapshot = {
  symbol: string;
  price: number;
  changePercent: number;
  momentum: number;
  relVol: number;
  breakout: boolean;
};

export type PaperAutoPosition = {
  symbol: string;
  qty: number;
  entry: number;
  side: 'BUY' | 'SELL';
  source?: 'manual' | 'auto';
  stop?: number;
  target?: number;
};

export type AutoEvent = {
  kind: 'entry' | 'exit' | 'skip';
  symbol: string;
  text: string;
  paperTrade: true;
  status: 'SIMULATED';
};

export function evaluateEntry(s: AutoSnapshot, rules: AutoRules = DEFAULT_AUTO_RULES) {
  const reasons: string[] = [];
  if (!(s.price > 0)) reasons.push('invalid price');
  if (s.changePercent < rules.minChangePercent) reasons.push(`change ${s.changePercent.toFixed(2)}% below ${rules.minChangePercent}%`);
  if (s.changePercent > rules.maxChangePercent) reasons.push(`extended ${s.changePercent.toFixed(2)}% above ${rules.maxChangePercent}% — do not chase`);
  if (s.momentum < rules.minMomentum) reasons.push(`momentum ${s.momentum} below ${rules.minMomentum}`);
  const volumeKnown = s.relVol > 1.01;
  if (!s.breakout && !volumeKnown) reasons.push('no breakout confirmation');
  if (!s.breakout && volumeKnown && s.relVol < rules.minRelVol) reasons.push('no breakout and weak volume');
  return {ok: reasons.length === 0, reasons};
}

export function sizePaperQty(price: number, capital: number, rules: AutoRules = DEFAULT_AUTO_RULES) {
  if (!(price > 0) || capital <= 0) return 0;
  const riskBudget = capital * (rules.riskPercent / 100);
  const perShareRisk = price * (rules.stopPercent / 100);
  const byRisk = Math.floor(riskBudget / perShareRisk);
  const byName = Math.floor((capital * (rules.maxNamePercent / 100)) / price);
  return Math.max(0, Math.min(byRisk, byName));
}

export function evaluateExit(position: PaperAutoPosition, quote: AutoSnapshot, rules: AutoRules = DEFAULT_AUTO_RULES) {
  if (position.side !== 'BUY') {
    return {exit: false as const, reason: ''};
  }
  const stop = position.stop ?? position.entry * (1 - rules.stopPercent / 100);
  const target = position.target ?? position.entry * (1 + rules.targetPercent / 100);
  if (quote.price <= stop) return {exit: true as const, reason: `stop ${rules.stopPercent}%`};
  if (quote.price >= target) return {exit: true as const, reason: `target ${rules.targetPercent}%`};
  if (quote.momentum < rules.fadeMomentum) return {exit: true as const, reason: `momentum faded to ${quote.momentum}`};
  return {exit: false as const, reason: ''};
}

export function runPaperAuto(input: {
  quotes: AutoSnapshot[];
  positions: PaperAutoPosition[];
  capital: number;
  allowEntries: boolean;
  rules?: AutoRules;
}) {
  const rules = input.rules ?? DEFAULT_AUTO_RULES;
  const events: AutoEvent[] = [];
  let positions = [...input.positions];
  const bySymbol = new Map(input.quotes.map(q => [q.symbol, q]));

  for (const pos of [...positions]) {
    if (pos.source !== 'auto') continue;
    const quote = bySymbol.get(pos.symbol);
    if (!quote) continue;
    const decision = evaluateExit(pos, quote, rules);
    if (decision.exit) {
      positions = positions.filter(p => !(p.symbol === pos.symbol && p.source === 'auto' && p.entry === pos.entry));
      const pnl = (quote.price - pos.entry) * pos.qty;
      events.push({
        kind: 'exit',
        symbol: pos.symbol,
        text: `Paper auto exit · ${decision.reason} · ${pnl >= 0 ? '+' : ''}${pnl.toFixed(0)}`,
        paperTrade: true,
        status: 'SIMULATED'
      });
    }
  }

  if (!input.allowEntries) return {positions, events, simulationOnly: true as const};

  const openAuto = positions.filter(p => p.source === 'auto');
  const held = new Set(positions.map(p => p.symbol));
  const ranked = [...input.quotes].sort((a, b) => b.momentum - a.momentum || b.changePercent - a.changePercent);

  for (const quote of ranked) {
    if (openAuto.length + events.filter(e => e.kind === 'entry').length >= rules.maxPositions) break;
    if (held.has(quote.symbol)) continue;
    const gate = evaluateEntry(quote, rules);
    if (!gate.ok) continue;
    const qty = sizePaperQty(quote.price, input.capital, rules);
    if (qty < 1) {
      events.push({kind: 'skip', symbol: quote.symbol, text: 'Size too small for risk budget', paperTrade: true, status: 'SIMULATED'});
      continue;
    }
    const invested = positions.reduce((a, p) => a + p.qty * p.entry, 0);
    if (invested + qty * quote.price > input.capital) continue;
    positions.push({
      symbol: quote.symbol,
      qty,
      entry: quote.price,
      side: 'BUY',
      source: 'auto',
      stop: +(quote.price * (1 - rules.stopPercent / 100)).toFixed(2),
      target: +(quote.price * (1 + rules.targetPercent / 100)).toFixed(2)
    });
    held.add(quote.symbol);
    events.push({
      kind: 'entry',
      symbol: quote.symbol,
      text: `Paper auto BUY ${qty} @ ${quote.price} · mom ${quote.momentum} · ${quote.changePercent.toFixed(2)}%`,
      paperTrade: true,
      status: 'SIMULATED'
    });
  }

  return {positions, events, simulationOnly: true as const};
}
