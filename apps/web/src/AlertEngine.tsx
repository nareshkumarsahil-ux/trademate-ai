import {useEffect, useState} from 'react';
import {Bell, Plus, Trash2, Zap} from 'lucide-react';
import type {Stock} from './data';

export type PriceAlert = {id: string; symbol: string; op: 'above' | 'below'; price: number};

function loadAlerts(): PriceAlert[] {
  try { return JSON.parse(localStorage.getItem('tm-alerts') || '[]'); } catch { return []; }
}
function saveAlerts(rows: PriceAlert[]) {
  localStorage.setItem('tm-alerts', JSON.stringify(rows.slice(0, 40)));
}

export function AlertEngine({stocks, feedMode}: {stocks: Stock[]; feedMode: string}) {
  const [rows, setRows] = useState<PriceAlert[]>(loadAlerts);
  const [symbol, setSymbol] = useState(stocks[0]?.symbol || 'RELIANCE');
  const [op, setOp] = useState<'above' | 'below'>('above');
  const [price, setPrice] = useState(0);
  useEffect(() => {
    const sync = () => setRows(loadAlerts());
    window.addEventListener('tm-cloud', sync);
    return () => window.removeEventListener('tm-cloud', sync);
  }, []);
  useEffect(() => {
    if (stocks[0] && !stocks.find(s => s.symbol === symbol)) setSymbol(stocks[0].symbol);
  }, [stocks, symbol]);
  const liveHits = stocks.filter(s => s.change >= 5 || s.breakout || s.relVol >= 2 || s.momentum >= 85).slice(0, 10);
  const fired = rows.map(a => {
    const s = stocks.find(x => x.symbol === a.symbol);
    if (!s) return {...a, hit: false, last: 0};
    const hit = a.op === 'above' ? s.price >= a.price : s.price <= a.price;
    return {...a, hit, last: s.price};
  });
  const add = () => {
    if (!symbol || !price) return;
    const next = [{id: crypto.randomUUID(), symbol, op, price}, ...rows].slice(0, 40);
    saveAlerts(next);
    setRows(next);
  };
  return <>
    <div className="panel" style={{marginBottom: 14}}>
      <div className="panel-head"><div><h2>Scanner alerts</h2><p>{feedMode === 'LIVE' ? 'Rule matches on Dhan snapshot' : 'Demo stream rule matches'}</p></div></div>
      {liveHits.length === 0 ? <div className="empty"><Bell/><h3>No rule matches</h3><p>Waiting for 5% move, 2× volume, breakout or 85 momentum.</p></div> : <div className="alerts-list" style={{padding: 10}}>{liveHits.map(s => <div className="alert-item" key={s.symbol}><div><Zap/></div><span><b>{s.symbol} {s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%</b><p>Mom {s.momentum} · Vol {s.relVol.toFixed(1)}× {s.breakout ? '· Breakout' : ''}</p></span><small>Now</small></div>)}</div>}
    </div>
    <div className="panel">
      <div className="panel-head"><div><h2>Price alerts</h2><p>Local + cloud book · EDUCATIONAL / SIMULATED — NOT FINANCIAL ADVICE</p></div></div>
      <div className="form-row" style={{padding: 12}}>
        <label>Symbol<select value={symbol} onChange={e => setSymbol(e.target.value)}>{stocks.map(s => <option key={s.symbol} value={s.symbol}>{s.symbol}</option>)}</select></label>
        <label>When<select value={op} onChange={e => setOp(e.target.value as 'above' | 'below')}><option value="above">Price above</option><option value="below">Price below</option></select></label>
        <label>Level<input type="number" value={price || ''} onChange={e => setPrice(+e.target.value)} placeholder="₹"/></label>
      </div>
      <button className="secondary broker-button" onClick={add}><Plus size={14}/> Add alert</button>
      {fired.length === 0 ? <div className="empty"><Bell/><h3>No custom alerts</h3></div> : fired.map(a => <div className={`alert-item ${a.hit ? 'hit' : ''}`} key={a.id}>
        <div><Bell/></div>
        <span><b>{a.symbol} {a.op} ₹{a.price}</b><p>Last {a.last ? a.last.toFixed(2) : '—'} {a.hit ? '· TRIGGERED' : '· watching'}</p></span>
        <button className="icon-btn" onClick={() => { const next = rows.filter(x => x.id !== a.id); saveAlerts(next); setRows(next); }}><Trash2 size={14}/></button>
      </div>)}
    </div>
  </>;
}
