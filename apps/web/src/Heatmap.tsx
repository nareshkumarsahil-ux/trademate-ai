import {Flame, Gauge, TrendingUp, Zap} from 'lucide-react';
import type {Stock} from './data';
import type {OptionSetup} from './indexOptions';
import {gapScan, optionBreadth, sectorHeat, volumeSpikes, vwap} from './advanced';

const money = (n: number) => new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 2}).format(n);

export function AdvancedBoard({stocks, setups, open, paper}: {
  stocks: Stock[];
  setups: OptionSetup[];
  open: (s: Stock) => void;
  paper: (s: Stock) => void;
}) {
  const heat = sectorHeat(stocks);
  const spikes = volumeSpikes(stocks).slice(0, 6);
  const gaps = gapScan(stocks).slice(0, 6);
  const pcr = optionBreadth(setups);
  const tone = (n: number) => n > 1 ? 'hot' : n < -1 ? 'cold' : 'flat';
  return <div className="adv-wrap">
    <div className="adv-grid">
      <div className="panel">
        <div className="panel-head"><div><h2>Sector heatmap</h2><p>Average session change · EDUCATIONAL</p></div></div>
        <div className="heat-grid">
          {heat.map(s => <button key={s.name} className={`heat-cell ${tone(s.avg)}`}>
            <b>{s.name}</b>
            <strong className={s.avg >= 0 ? 'positive' : 'negative'}>{s.avg >= 0 ? '+' : ''}{s.avg}%</strong>
            <small>{s.up}/{s.n} up</small>
          </button>)}
          {heat.length === 0 && <p className="muted" style={{padding: 12}}>No sector rows</p>}
        </div>
      </div>
      <div className="panel">
        <div className="panel-head"><div><h2>Option breadth</h2><p>CE vs PE breakouts · DEMO premium</p></div><span className="demo-tag">EDU</span></div>
        <div className="pcr-row">
          <div><span>CE breakout</span><b className="positive">{pcr.ceBr}</b></div>
          <div><span>PE breakout</span><b className="negative">{pcr.peBr}</b></div>
          <div><span>PE/CE</span><b>{pcr.pcr}</b></div>
        </div>
        <p className="disclaimer">Not exchange PCR. Count of scanner CE/PE breakout flags. EDUCATIONAL / SIMULATED — NOT FINANCIAL ADVICE</p>
      </div>
    </div>
    <div className="adv-grid">
      <div className="panel">
        <div className="panel-head"><div><h2>Volume spikes</h2><p>Rel. volume ≥ 2×</p></div><Flame size={16}/></div>
        {spikes.length === 0 ? <p className="muted" style={{padding: 14}}>No 2× volume names</p> : spikes.map(s => <button className="adv-row" key={s.symbol} onClick={() => open(s)}>
          <span><b>{s.symbol}</b><small>VWAP {money(vwap(s))}</small></span>
          <span><b>{s.relVol.toFixed(1)}×</b><em className={s.change >= 0 ? 'positive' : 'negative'}>{s.change.toFixed(2)}%</em></span>
        </button>)}
      </div>
      <div className="panel">
        <div className="panel-head"><div><h2>Gap scan</h2><p>Open vs previous close estimate</p></div><TrendingUp size={16}/></div>
        {gaps.length === 0 ? <p className="muted" style={{padding: 14}}>No 1%+ gaps</p> : gaps.map(s => <button className="adv-row" key={s.symbol} onClick={() => paper(s)}>
          <span><b>{s.symbol}</b><small>{s.gap >= 0 ? 'Gap up' : 'Gap down'}</small></span>
          <span><b className={s.gap >= 0 ? 'positive' : 'negative'}>{s.gap >= 0 ? '+' : ''}{s.gap}%</b><em>Paper</em></span>
        </button>)}
      </div>
    </div>
    <p className="disclaimer" style={{margin: '8px 0 16px'}}><Gauge size={12}/> <Zap size={12}/> Advanced scans use OHLC already on the quote. VWAP is (H+L+C)/3. EDUCATIONAL / SIMULATED — NOT FINANCIAL ADVICE</p>
  </div>;
}
