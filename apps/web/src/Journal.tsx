import {useEffect, useState} from 'react';
import {Area, AreaChart, ResponsiveContainer, Tooltip} from 'recharts';
import {BookOpen, Trash2} from 'lucide-react';
import type {PaperAutoPosition} from './autoTrade';
import {markPosition} from './pnl';
import type {Stock} from './data';

export type JournalRow = {
  symbol: string;
  label?: string;
  side: 'BUY' | 'SELL';
  qty: number;
  entry: number;
  exit: number;
  pnl: number;
  product?: string;
  closedAt: string;
};

const money = (n: number) => new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 2}).format(n);

function loadJournal(): JournalRow[] {
  try { return JSON.parse(localStorage.getItem('tm-journal') || '[]'); } catch { return []; }
}
function saveJournal(rows: JournalRow[]) {
  localStorage.setItem('tm-journal', JSON.stringify(rows.slice(0, 80)));
}
function loadEquity() {
  try { return JSON.parse(localStorage.getItem('tm-equity') || '[]') as {t: string; pnl: number}[]; } catch { return []; }
}

export function pushEquity(pnl: number) {
  const rows = loadEquity();
  const t = new Date().toLocaleTimeString('en-IN', {timeZone: 'Asia/Kolkata', hour12: false});
  const next = [...rows, {t, pnl}].slice(-60);
  localStorage.setItem('tm-equity', JSON.stringify(next));
}

export function JournalPanel({positions, stocks, setPositions}: {
  positions: PaperAutoPosition[];
  stocks: Stock[];
  setPositions: (v: PaperAutoPosition[] | ((x: PaperAutoPosition[]) => PaperAutoPosition[])) => void;
}) {
  const [rows, setRows] = useState<JournalRow[]>(loadJournal);
  const [curve, setCurve] = useState(loadEquity);
  useEffect(() => {
    const sync = () => { setRows(loadJournal()); setCurve(loadEquity()); };
    window.addEventListener('tm-cloud', sync);
    const i = setInterval(sync, 4000);
    return () => { window.removeEventListener('tm-cloud', sync); clearInterval(i); };
  }, []);
  const closeAt = (i: number) => {
    const p = positions[i];
    if (!p) return;
    const m = markPosition(p, stocks);
    const row: JournalRow = {
      symbol: p.symbol,
      label: m.label,
      side: p.side,
      qty: p.qty,
      entry: p.entry,
      exit: m.mark,
      pnl: m.pnl,
      product: p.product,
      closedAt: new Date().toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})
    };
    const next = [row, ...rows].slice(0, 80);
    saveJournal(next);
    setRows(next);
    setPositions(cur => cur.filter((_, j) => j !== i));
  };
  const total = rows.reduce((a, r) => a + r.pnl, 0);
  return <div className="panel" style={{marginTop: 14}}>
    <div className="panel-head"><div><h2>Paper journal + equity curve</h2><p>Close a paper trade to book simulated P&L · EDUCATIONAL</p></div><span className="simulation">SIMULATION</span></div>
    <div className="paper-summary" style={{margin: 12}}>
      <div><span>Closed trades</span><b>{rows.length}</b><small>This cloud book</small></div>
      <div><span>Booked P&L</span><b className={total >= 0 ? 'positive' : 'negative'}>{money(total)}</b><small>Sum of closed paper</small></div>
    </div>
    {curve.length > 1 && <ResponsiveContainer width="100%" height={160}><AreaChart data={curve}><defs><linearGradient id="eq" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#37d39a" stopOpacity=".35"/><stop offset="1" stopColor="#37d39a" stopOpacity="0"/></linearGradient></defs><Tooltip contentStyle={{background: '#101c18', border: '1px solid #263b34'}}/><Area dataKey="pnl" stroke="#37d39a" fill="url(#eq)" strokeWidth={2}/></AreaChart></ResponsiveContainer>}
    {positions.length > 0 && <div style={{padding: '0 12px 8px'}}>
      <p className="muted">Open paper — tap Close to journal</p>
      {positions.map((p, i) => {
        const m = markPosition(p, stocks);
        return <div className="adv-row" key={i}><span><b>{m.label}</b><small>{p.side} · {money(m.pnl)}</small></span><button className="trade-btn" onClick={() => closeAt(i)}>Close paper</button></div>;
      })}
    </div>}
    {rows.length === 0 ? <div className="empty"><BookOpen/><h3>No closed paper trades</h3><p>Close an open paper position to start the journal.</p></div> : <div className="table-wrap stack-table"><table>
      <thead><tr><th>When</th><th>Contract</th><th>Entry</th><th>Exit</th><th>P&L</th><th/></tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i}><td>{r.closedAt}</td><td><b>{r.label || r.symbol}</b></td><td>{money(r.entry)}</td><td>{money(r.exit)}</td><td className={r.pnl >= 0 ? 'positive' : 'negative'}>{money(r.pnl)}</td><td><button className="icon-btn" onClick={() => { const next = rows.filter((_, j) => j !== i); saveJournal(next); setRows(next); }}><Trash2 size={14}/></button></td></tr>)}</tbody>
    </table></div>}
  </div>;
}
