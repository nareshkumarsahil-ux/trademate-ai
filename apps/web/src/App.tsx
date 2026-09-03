import {useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {Activity, ArrowDownRight, ArrowLeft, ArrowUpRight, Bell, Bot, BriefcaseBusiness, ChevronDown, ChevronRight, CircleAlert, CircleCheck, Clock3, Copy, ExternalLink, Eye, EyeOff, Flame, Gauge, LayoutDashboard, LineChart, Menu, Pause, PlayCircle, Plus, Power, Radio, RefreshCw, Search, Send, Settings, ShieldCheck, Smartphone, Star, TrendingUp, Unplug, WalletCards, X, Zap} from 'lucide-react';
import {Area, AreaChart, ResponsiveContainer, Tooltip} from 'recharts';
import {DEMO_STOCKS, DHAN_WEB, spark, type Stock} from './data';
import {api, type BrokerPosition, type BrokerStatus, type Funds, type Holding, type IndexRow} from './api';
import {DEFAULT_AUTO_RULES, evaluateEntry, runPaperAuto, toSnapshot, type AutoEvent, type PaperAutoPosition} from './autoTrade';
import {bookSummary, demoOptionPremium, ideasFor, markPosition, recommend, roundStrike} from './pnl';
import {asIndexStock, combinedBreakouts, combinedMovers, combinedOptionSetups, INDEX_OPTION_AUTO, indexBreakouts, indexMovers, indexSetups, indexStrike, resolveIndexSpots, runIndexOptionAuto, specFor, stockOptionSetups, type OptionSetup} from './indexOptions';
import {HowToModal, SCAN_HUB, SCAN_PAGES, usePwaInstall} from './HowTo';
import {makeBookId, readBookFromUrl, writeBookToUrl} from './paperCloud';

type Page = 'Dashboard' | 'NIFTY 500' | '2%+ Movers' | '5%+ Movers' | '10%+ Movers' | 'Top Gainers' | 'High Momentum' | 'Breakouts' | 'Watchlist' | 'Paper Trade' | 'Auto Trade' | 'Positions' | 'Alerts' | 'Settings';
type Position = PaperAutoPosition;
type FeedMode = 'DEMO' | 'LIVE' | 'UNAVAILABLE';
const nav: [Page, typeof LayoutDashboard][] = [['Dashboard', LayoutDashboard], ['NIFTY 500', LineChart], ['2%+ Movers', ArrowUpRight], ['5%+ Movers', TrendingUp], ['10%+ Movers', Flame], ['Top Gainers', TrendingUp], ['High Momentum', Gauge], ['Breakouts', Zap], ['Watchlist', Star], ['Paper Trade', WalletCards], ['Auto Trade', PlayCircle], ['Positions', BriefcaseBusiness], ['Alerts', Bell], ['Settings', Settings]];
const money = (n: number) => new Intl.NumberFormat('en-IN', {style: 'currency', currency: 'INR', maximumFractionDigits: 2}).format(n);
const istNow = () => new Date().toLocaleString('en-IN', {timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'short'});

export default function App() {
  const [page, setPage] = useState<Page>('Dashboard');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [howTo, setHowTo] = useState(() => localStorage.getItem('tm-onboarded') !== '1');
  const [mobileMenu, setMobileMenu] = useState(false);
  const pwa = usePwaInstall();
  const [watch, setWatch] = useState<string[]>(() => JSON.parse(localStorage.getItem('tm-watch') || '["RELIANCE","INFY","SBIN"]'));
  const [positions, setPositions] = useState<Position[]>(() => JSON.parse(localStorage.getItem('tm-positions') || '[]'));
  const [selected, setSelected] = useState<Stock | null>(null);
  const [trade, setTrade] = useState<Stock | null>(null);
  const [tradeSide, setTradeSide] = useState<'BUY' | 'SELL'>('BUY');
  const [tradePreset, setTradePreset] = useState<{product: 'CASH' | 'OPTION'; optionType?: 'CE' | 'PE'; strike?: number} | null>(null);
  const [toast, setToast] = useState('');
  const [aiOpen, setAiOpen] = useState(false);
  const [brokerOpen, setBrokerOpen] = useState(false);
  const [stocks, setStocks] = useState(DEMO_STOCKS);
  const [lastTick, setLastTick] = useState(new Date());
  const [feedMode, setFeedMode] = useState<FeedMode>('DEMO');
  const [broker, setBroker] = useState<BrokerStatus>({connected: false, broker: null, readOnly: true});
  const [indices, setIndices] = useState<IndexRow[]>([]);
  const [marketStatus, setMarketStatus] = useState<'OPEN' | 'CLOSED' | 'PRE_OPEN'>('CLOSED');
  const [sessionKey, setSessionKey] = useState(0);
  const [autoOn, setAutoOn] = useState(() => localStorage.getItem('tm-auto-on') === '1');
  const [indexAutoOn, setIndexAutoOn] = useState(() => localStorage.getItem('tm-index-auto-on') === '1');
  const [autoLog, setAutoLog] = useState<AutoEvent[]>(() => JSON.parse(localStorage.getItem('tm-auto-log') || '[]'));
  const [bookId, setBookId] = useState(() => readBookFromUrl() || localStorage.getItem('tm-book-id') || '');
  const [bookAt, setBookAt] = useState(0);
  const [cloudOk, setCloudOk] = useState(false);
  const skipCloud = useRef(false);
  const cloudReady = useRef(false);
  const ping = (text: string) => { setToast(text); setTimeout(() => setToast(''), 2400); };
  const adoptBook = (id: string) => {
    const next = id.trim().toUpperCase();
    if (!/^TM-[A-Z0-9]{4,12}$/.test(next)) return;
    setBookId(next);
    localStorage.setItem('tm-book-id', next);
    writeBookToUrl(next);
  };
  const indexSpots = useMemo(() => resolveIndexSpots(indices, feedMode), [indices, feedMode]);
  const universe = useMemo(() => [...stocks, ...indexSpots.map(asIndexStock)], [stocks, indexSpots]);
  const book = bookSummary(positions, universe);

  useEffect(() => localStorage.setItem('tm-watch', JSON.stringify(watch)), [watch]);
  useEffect(() => localStorage.setItem('tm-positions', JSON.stringify(positions)), [positions]);
  useEffect(() => localStorage.setItem('tm-auto-on', autoOn ? '1' : '0'), [autoOn]);
  useEffect(() => localStorage.setItem('tm-index-auto-on', indexAutoOn ? '1' : '0'), [indexAutoOn]);
  useEffect(() => localStorage.setItem('tm-auto-log', JSON.stringify(autoLog.slice(0, 40))), [autoLog]);
  useEffect(() => {
    let stop = false;
    (async () => {
      const cfg = await api<{defaultBookId: string | null}>('/api/paper/config').catch(() => null);
      if (stop) return;
      if (!cfg) { setCloudOk(false); cloudReady.current = true; return; }
      setCloudOk(true);
      const id = (cfg.defaultBookId || readBookFromUrl() || bookId || makeBookId()).toUpperCase();
      adoptBook(id);
      const remote = await api<{positions: Position[]; watch?: string[]; updatedAt: number}>(`/api/paper/book/${id}`).catch(() => null);
      if (stop) return;
      const local = JSON.parse(localStorage.getItem('tm-positions') || '[]') as Position[];
      if (remote && remote.positions.length > 0) {
        skipCloud.current = true;
        setPositions(remote.positions as Position[]);
        if (remote.watch?.length) setWatch(remote.watch);
        setBookAt(remote.updatedAt);
      } else if (local.length > 0) {
        const now = Date.now();
        await api(`/api/paper/book/${id}`, {method: 'PUT', body: JSON.stringify({positions: local, watch, updatedAt: now})}).catch(() => {});
        setBookAt(now);
      }
      cloudReady.current = true;
    })();
    return () => { stop = true; };
  }, []);
  useEffect(() => {
    if (!bookId || !cloudReady.current) return;
    if (skipCloud.current) { skipCloud.current = false; return; }
    if (positions.length === 0 && bookAt === 0) return;
    const now = Date.now();
    const t = setTimeout(() => {
      api(`/api/paper/book/${bookId}`, {method: 'PUT', body: JSON.stringify({positions, watch, updatedAt: now})}).catch(() => setCloudOk(false));
      setBookAt(now);
    }, 400);
    return () => clearTimeout(t);
  }, [positions, bookId]);
  useEffect(() => {
    if (!bookId) return;
    const tick = async () => {
      const remote = await api<{positions: Position[]; updatedAt: number}>(`/api/paper/book/${bookId}`).catch(() => null);
      if (!remote) { setCloudOk(false); return; }
      setCloudOk(true);
      if (remote.positions.length === 0 && positions.length > 0) {
        const now = Date.now();
        await api(`/api/paper/book/${bookId}`, {method: 'PUT', body: JSON.stringify({positions, updatedAt: now})}).catch(() => {});
        setBookAt(now);
        return;
      }
      if (remote.updatedAt <= bookAt) return;
      skipCloud.current = true;
      setPositions(remote.positions as Position[]);
      setBookAt(remote.updatedAt);
    };
    const i = setInterval(tick, 3000);
    return () => clearInterval(i);
  }, [bookId, bookAt, positions.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
        document.querySelector<HTMLInputElement>('.search input')?.focus();
      }
      if (e.key === 'Escape') { setSearchOpen(false); setScanOpen(false); setMobileMenu(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    let stop = false;
    let demoTimer: ReturnType<typeof setInterval> | undefined;
    let liveTimer: ReturnType<typeof setInterval> | undefined;

    async function boot() {
      try {
        const status = await api<BrokerStatus>('/api/broker/status');
        if (stop) return;
        setBroker(status);
        if (status.connected) {
          setFeedMode('LIVE');
          await pullLive();
          liveTimer = setInterval(pullLive, 5000);
        } else {
          setFeedMode('DEMO');
          startDemo();
        }
      } catch {
        if (stop) return;
        setFeedMode('DEMO');
        setBroker({connected: false, broker: null, readOnly: true});
        startDemo();
      }
    }

    function startDemo() {
      let tick = 0;
      setStocks(DEMO_STOCKS);
      setIndices([]);
      demoTimer = setInterval(() => {
        tick += 1;
        setStocks(current => current.map((s, i) => {
          const step = Math.sin((tick + i) * 1.7) * 0.00035;
          const price = +(s.price * (1 + step)).toFixed(2);
          return {...s, price, high: Math.max(s.high, price), low: Math.min(s.low, price), dataStatus: 'DEMO'};
        }));
        setLastTick(new Date());
      }, 3000);
    }

    async function pullLive() {
      try {
        const [book, idx, hours] = await Promise.all([
          api<{items: Stock[]; dataStatus: string; timestamp?: string}>('/api/stocks'),
          api<{items: IndexRow[]}>('/api/indices').catch(() => ({items: [] as IndexRow[]})),
          api<{status: 'OPEN' | 'CLOSED' | 'PRE_OPEN'}>('/api/market/status').catch(() => ({status: 'CLOSED' as const}))
        ]);
        if (stop) return;
        setMarketStatus(hours.status);
        setIndices(idx.items || []);
        if (book.dataStatus === 'LIVE' && book.items?.length) {
          setStocks(book.items);
          setFeedMode('LIVE');
          setLastTick(book.timestamp ? new Date(book.timestamp) : new Date());
        } else {
          setStocks([]);
          setFeedMode('UNAVAILABLE');
        }
      } catch {
        if (stop) return;
        setStocks([]);
        setFeedMode('UNAVAILABLE');
      }
    }

    boot();
    return () => {
      stop = true;
      if (demoTimer) clearInterval(demoTimer);
      if (liveTimer) clearInterval(liveTimer);
    };
  }, [sessionKey]);

  useEffect(() => {
    if (!autoOn) return;
    if (feedMode === 'UNAVAILABLE' || stocks.length === 0) return;
    const allowEntries = feedMode === 'DEMO' || marketStatus === 'OPEN';
    const result = runPaperAuto({
      quotes: stocks.map(toSnapshot),
      positions,
      capital: 1_000_000,
      allowEntries
    });
    if (result.events.length === 0) return;
    setPositions(result.positions);
    setAutoLog(log => [...result.events, ...log].slice(0, 40));
    const last = result.events[0];
    ping(last.text);
  }, [autoOn, stocks, feedMode, marketStatus]);

  useEffect(() => {
    if (!indexAutoOn) return;
    if (feedMode === 'UNAVAILABLE') return;
    const allowEntries = feedMode === 'DEMO' || marketStatus === 'OPEN';
    const result = runIndexOptionAuto({spots: indexSpots, stocks, positions, capital: 1_000_000, allowEntries});
    if (result.events.length === 0) return;
    setPositions(result.positions);
    setAutoLog(log => [...result.events, ...log].slice(0, 40));
    ping(result.events[0].text);
  }, [indexAutoOn, indexSpots, stocks, feedMode, marketStatus]);

  const go = (p: Page) => { setPage(p); setMobileMenu(false); setScanOpen(false); setSelected(null); setSearchOpen(false); };
  const closeHowTo = () => { localStorage.setItem('tm-onboarded', '1'); setHowTo(false); };
  const toggleWatch = (s: string) => {
    setWatch(v => v.includes(s) ? v.filter(x => x !== s) : [...v, s]);
    ping(watch.includes(s) ? `${s} removed from watchlist` : `${s} added to watchlist`);
  };

  return <div className="app-shell">
    <aside className={`sidebar ${mobileMenu ? 'open' : ''}`}>
      <div className="brand"><div className="brandmark"><TrendingUp size={21}/></div><div><b>TradeMate <i>AI</i></b><span>NSE 500 Scanner</span></div><button className="mobile-close" onClick={() => setMobileMenu(false)}><X/></button></div>
      <nav>{nav.map(([label, Icon]) => <button key={label} className={page === label ? 'active' : ''} onClick={() => go(label)}><Icon size={18}/><span>{label}</span></button>)}</nav>
      <button className="how-link" onClick={() => { setHowTo(true); setMobileMenu(false); }}>Computer + mobile guide</button>
      <div className="safety"><ShieldCheck size={18}/><div><b>Simulation only</b><span>No real trades are placed</span></div></div>
    </aside>
    {mobileMenu && <div className="scrim" onClick={() => setMobileMenu(false)}/>}
    <main>
      <header>
        <button className="menu" onClick={() => setMobileMenu(true)}><Menu/></button>
        <div className="mobile-logo"><TrendingUp/><b>TradeMate AI</b></div>
        <div className={`search ${searchOpen ? 'open' : ''}`}><Search size={17}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search symbol or company…" inputMode="search"/><kbd>Ctrl K</kbd></div>
        <button className="icon-btn search-toggle" aria-label="Search" onClick={() => setSearchOpen(v => !v)}><Search size={18}/></button>
        <div className="feed-time"><RefreshCw size={12}/><span>{feedMode === 'LIVE' ? 'Dhan tick' : feedMode === 'UNAVAILABLE' ? 'No feed' : 'Demo tick'}</span><b>{lastTick.toLocaleTimeString('en-IN', {timeZone: 'Asia/Kolkata', hour12: false})} IST</b></div>
        <button className={`pnl-chip ${book.pnl >= 0 ? 'up' : 'down'}`} onClick={() => setPage('Positions')}>
          <span>P&L</span><b>{money(book.pnl)}</b>
        </button>
        {bookId && <button className={`book-chip ${cloudOk ? '' : 'down'}`} title="Cloud paper book" onClick={() => { navigator.clipboard.writeText(window.location.href); ping(cloudOk ? 'Book URL copied' : 'Cloud API nahi mili — Vercel Root Directory check karo'); }}>{cloudOk ? bookId : 'SYNC OFF'}</button>}
        <div className={`status-pill ${autoOn ? 'live' : feedMode === 'LIVE' ? 'live' : feedMode === 'UNAVAILABLE' ? 'down' : ''}`}><span/>{autoOn ? 'Paper auto' : feedMode === 'LIVE' ? 'Dhan live' : feedMode === 'UNAVAILABLE' ? 'Live unavailable' : 'Simulation stream'}</div>
        <button className="icon-btn how-btn" title="How to use" onClick={() => setHowTo(true)}>?</button>
        <button className="icon-btn" onClick={() => setPage('Alerts')}><Bell size={19}/></button>
        <div className="avatar">AK</div>
      </header>
      {feedMode === 'LIVE' ? (
        <div className="warning live"><Radio size={16}/><b>LIVE · DHANHQ</b><span>Read-only market data. Paper trading stays simulated — no broker orders are sent.</span><strong>EDUCATIONAL / SIMULATED — NOT FINANCIAL ADVICE</strong></div>
      ) : feedMode === 'UNAVAILABLE' ? (
        <div className="warning down"><CircleAlert size={16}/><b>LIVE DATA UNAVAILABLE</b><span>Dhan quotes did not return. Prices are hidden instead of faked.</span><strong>EDUCATIONAL / SIMULATED — NOT FINANCIAL ADVICE</strong></div>
      ) : (
        <div className="warning"><CircleAlert size={16}/><b>DEMO DATA</b><span>Prices move through a deterministic simulation stream — not a live NSE feed. Connect Dhan in Settings for real quotes.</span><strong>EDUCATIONAL / SIMULATED — NOT FINANCIAL ADVICE</strong></div>
      )}
      <Ticker stocks={stocks} live={feedMode === 'LIVE'}/>
      <PositionBar positions={positions} stocks={universe} openPositions={() => setPage('Positions')} buy={() => { const s = stocks[0]; if (!s) return; setTradeSide('BUY'); setTrade(s); }} sell={() => { const s = stocks[0]; if (!s) return; setTradeSide('SELL'); setTrade(s); }}/>
      <section className="content">
        {selected ? (
          <StockDetail stock={stocks.find(s => s.symbol === selected.symbol) || selected} watched={watch.includes(selected.symbol)} back={() => setSelected(null)} toggle={() => toggleWatch(selected.symbol)} paper={() => setTrade(stocks.find(s => s.symbol === selected.symbol) || selected)} live={feedMode === 'LIVE'}/>
        ) : (
          <PageContent page={page} search={search} watch={watch} positions={positions} stocks={stocks} open={setSelected} toggle={toggleWatch} paper={setTrade} openBroker={() => setBrokerOpen(true)} feedMode={feedMode} broker={broker} indices={indices} marketStatus={marketStatus} onDisconnected={() => setSessionKey(k => k + 1)} ping={ping} autoOn={autoOn} setAutoOn={setAutoOn} indexAutoOn={indexAutoOn} setIndexAutoOn={setIndexAutoOn} autoLog={autoLog} setAutoLog={setAutoLog} setPositions={setPositions} indexSpots={indexSpots} openHowTo={() => setHowTo(true)} pwa={pwa} openIndex={(s: OptionSetup) => { const spec = indexSpots.find(x => x.key === s.underlying); setTradeSide('BUY'); setTradePreset({product: 'OPTION', optionType: s.type, strike: s.strike}); if (spec) { setTrade(asIndexStock(spec)); return; } const st = stocks.find(x => x.symbol === s.underlying); if (st) setTrade(st); }}/>
        )}
      </section>
      <MobileNav page={page} go={go} openMenu={() => setMobileMenu(true)} openScan={() => setScanOpen(true)}/>
      {scanOpen && <ScanSheet page={page} go={go} close={() => setScanOpen(false)}/>}
    </main>
    {trade && <TradeModal stock={trade} live={feedMode === 'LIVE'} initialSide={tradeSide} preset={tradePreset} close={() => { setTrade(null); setTradePreset(null); }} submit={p => { setPositions(v => [...v, p]); setTrade(null); setTradePreset(null); ping(`Paper ${p.side} ${p.product === 'OPTION' ? p.label || p.symbol : p.symbol}`); }}/>}
    {brokerOpen && <BrokerModal close={() => setBrokerOpen(false)} onConnected={status => { setBroker(status); setBrokerOpen(false); setSessionKey(k => k + 1); ping('Dhan connected · read-only'); }}/>}
    <button className="ai-fab" onClick={() => setAiOpen(true)}><Bot/><span>Ask TradeMate AI</span></button>
    {aiOpen && <AIAssistant stocks={stocks} close={() => setAiOpen(false)} paper={(s, side) => { setAiOpen(false); setTradeSide(side); setTrade(s); }}/>}
    {toast && <div className="toast"><CircleCheck size={18}/>{toast}</div>}
    {howTo && <HowToModal onClose={closeHowTo} canInstall={pwa.canInstall} installed={pwa.installed} onInstall={async () => { await pwa.install(); ping('Install prompt opened'); }}/>}
  </div>;
}

function PageContent({page, search, watch, positions, stocks, open, toggle, paper, openBroker, feedMode, broker, indices, marketStatus, onDisconnected, ping, autoOn, setAutoOn, indexAutoOn, setIndexAutoOn, autoLog, setAutoLog, setPositions, indexSpots, openIndex, openHowTo, pwa}: {
  page: Page; search: string; watch: string[]; positions: Position[]; stocks: Stock[];
  open: (s: Stock) => void; toggle: (s: string) => void; paper: (s: Stock) => void; openBroker: () => void;
  feedMode: FeedMode; broker: BrokerStatus; indices: IndexRow[]; marketStatus: string;
  onDisconnected: () => void; ping: (t: string) => void;
  autoOn: boolean; setAutoOn: (v: boolean) => void; indexAutoOn: boolean; setIndexAutoOn: (v: boolean) => void;
  autoLog: AutoEvent[]; setAutoLog: (v: AutoEvent[] | ((x: AutoEvent[]) => AutoEvent[])) => void;
  setPositions: (v: Position[] | ((x: Position[]) => Position[])) => void;
  indexSpots: ReturnType<typeof resolveIndexSpots>; openIndex: (s: OptionSetup) => void;
  openHowTo: () => void; pwa: ReturnType<typeof usePwaInstall>;
}) {
  const universe = [...stocks, ...indexSpots.map(asIndexStock)];
  if (page === 'Dashboard') return <Dashboard stocks={stocks} open={open} paper={paper} feedMode={feedMode} indices={indices} marketStatus={marketStatus} autoOn={autoOn} indexSpots={indexSpots} openIndex={openIndex} indexAutoOn={indexAutoOn} setIndexAutoOn={setIndexAutoOn}/>;
  if (page === 'Paper Trade') return <PaperTrade stocks={stocks} positions={positions} paper={paper} feedMode={feedMode} indexSpots={indexSpots} openIndex={openIndex} universe={universe} indexAutoOn={indexAutoOn} setIndexAutoOn={setIndexAutoOn}/>;
  if (page === 'Auto Trade') return <AutoTradePage stocks={stocks} positions={positions} feedMode={feedMode} marketStatus={marketStatus} autoOn={autoOn} setAutoOn={setAutoOn} indexAutoOn={indexAutoOn} setIndexAutoOn={setIndexAutoOn} autoLog={autoLog} setAutoLog={setAutoLog} setPositions={setPositions} ping={ping} indexSpots={indexSpots} openIndex={openIndex}/>;
  if (page === 'Positions') return <Positions positions={positions} stocks={universe} connected={broker.connected} feedMode={feedMode} setPositions={setPositions} ping={ping} bookId={bookId} adoptBook={adoptBook}/>;
  if (page === 'Settings') return <SettingsPage openBroker={openBroker} broker={broker} feedMode={feedMode} onDisconnected={onDisconnected} ping={ping} openHowTo={openHowTo} pwa={pwa} bookId={bookId} adoptBook={adoptBook}/>;
  if (page === 'Alerts') return <Alerts stocks={stocks} feedMode={feedMode}/>;
  if (page === 'Breakouts') return <BreakoutsPage stocks={stocks} watch={watch} open={open} toggle={toggle} paper={paper} feedMode={feedMode} indexSpots={indexSpots} openIndex={openIndex} search={search}/>;
  if (page === '2%+ Movers') return <MoversPage mode="movers" threshold={2} stocks={stocks} watch={watch} open={open} toggle={toggle} paper={paper} feedMode={feedMode} indexSpots={indexSpots} openIndex={openIndex} search={search}/>;
  if (page === '5%+ Movers') return <MoversPage mode="movers" threshold={5} stocks={stocks} watch={watch} open={open} toggle={toggle} paper={paper} feedMode={feedMode} indexSpots={indexSpots} openIndex={openIndex} search={search}/>;
  if (page === '10%+ Movers') return <MoversPage mode="movers" threshold={10} stocks={stocks} watch={watch} open={open} toggle={toggle} paper={paper} feedMode={feedMode} indexSpots={indexSpots} openIndex={openIndex} search={search}/>;
  if (page === 'Top Gainers') return <MoversPage mode="gainers" stocks={stocks} watch={watch} open={open} toggle={toggle} paper={paper} feedMode={feedMode} indexSpots={indexSpots} openIndex={openIndex} search={search}/>;
  if (page === 'High Momentum') return <MoversPage mode="momentum" stocks={stocks} watch={watch} open={open} toggle={toggle} paper={paper} feedMode={feedMode} indexSpots={indexSpots} openIndex={openIndex} search={search}/>;
  let rows = stocks;
  if (page === 'Watchlist') rows = rows.filter(s => watch.includes(s.symbol));
  if (search) rows = rows.filter(s => (s.symbol + ' ' + s.name).toLowerCase().includes(search.toLowerCase()));
  return <div><PageTitle title={page} subtitle={subtitle(page, feedMode)}/><StockTable rows={rows} watch={watch} open={open} toggle={toggle} paper={paper} emptyLive={feedMode === 'UNAVAILABLE'}/></div>;
}

function subtitle(p: Page, mode: FeedMode) {
  const live = mode === 'LIVE';
  const m: Partial<Record<Page, string>> = {
    'NIFTY 500': live ? 'Dhan NSE equity universe · live quotes · not a licensed index membership file' : 'Configurable stock universe · 10 demo constituents shown',
    '2%+ Movers': 'Cash ≥ 2% plus index and stock-option Opt % ≥ 2%',
    '5%+ Movers': 'Cash ≥ 5% plus index and stock-option Opt % ≥ 5%',
    '10%+ Movers': 'Cash ≥ 10% plus index and stock-option Opt % ≥ 10%',
    'Top Gainers': 'Cash, index options and stock options ranked by move',
    'High Momentum': 'Cash momentum plus stock/index option setups',
    'Breakouts': 'Cash, index-option and stock-option breakout scan',
    'Watchlist': 'Your locally saved symbols'
  };
  return m[p] || '';
}

function PageTitle({title, subtitle, action}: {title: string; subtitle: string; action?: string}) {
  return <div className="page-title"><div><h1>{title}</h1><p>{subtitle}</p></div>{action && <button className="primary"><Plus size={16}/>{action}</button>}</div>;
}

function Dashboard({stocks, open, paper, feedMode, indices, marketStatus, autoOn, indexSpots, openIndex, indexAutoOn, setIndexAutoOn}: {stocks: Stock[]; open: (s: Stock) => void; paper: (s: Stock) => void; feedMode: FeedMode; indices: IndexRow[]; marketStatus: string; autoOn: boolean; indexSpots: ReturnType<typeof resolveIndexSpots>; openIndex: (s: OptionSetup) => void; indexAutoOn: boolean; setIndexAutoOn: (v: boolean) => void}) {
  const movers = stocks.filter(s => s.change >= 2);
  const advancing = stocks.filter(s => s.change > 0).length;
  const declining = stocks.filter(s => s.change < 0).length;
  const unchanged = stocks.length - advancing - declining;
  return <>
    <div className="hero-row">
      <div><div className="eyebrow">Market overview · {istNow()}</div><h1>Good morning</h1><p>{autoOn ? 'Paper auto is armed with Momentum Breakout Conservative — no broker orders.' : feedMode === 'LIVE' ? 'Live Dhan quotes power this scanner.' : 'Here’s what your scanner is tracking.'}</p></div>
      <div className="market-closed"><Clock3/><div><span>Market status</span><b>{marketStatus}</b></div><small>{feedMode === 'LIVE' ? 'Session clock · Asia/Kolkata' : 'Demo mode · connect Dhan for live quotes'}</small></div>
    </div>
    <div className="index-grid">
      {['NIFTY 50', 'NIFTY BANK', 'SENSEX'].map(name => <Index key={name} name={name} row={indices.find(i => i.name === name)} live={feedMode === 'LIVE'}/>)}
      <div className="breadth card">
        <div className="card-head"><span>Market breadth</span><em>{feedMode === 'LIVE' ? 'Live set' : 'Demo'}</em></div>
        {feedMode === 'UNAVAILABLE' ? <div className="unavailable"><Radio size={14}/> LIVE DATA UNAVAILABLE</div> : <>
          <div className="breadth-count"><b className="positive">{advancing} <small>Advancing</small></b><b className="negative">{declining} <small>Declining</small></b><b>{unchanged} <small>Unchanged</small></b></div>
          <div className="breadth-bar"><i style={{width: `${stocks.length ? (advancing / stocks.length) * 100 : 0}%`}}/><i style={{width: `${stocks.length ? (declining / stocks.length) * 100 : 0}%`}}/><i/></div>
        </>}
      </div>
    </div>
    <IndexOptionBoard spots={indexSpots} stocks={stocks} openIndex={openIndex} indexAutoOn={indexAutoOn} setIndexAutoOn={setIndexAutoOn}/>
    <div className="metric-grid">
      <Metric icon={ArrowUpRight} value={movers.length + combinedMovers(indexSpots, stocks, 2).length} label="2%+ movers" accent="green"/>
      <Metric icon={TrendingUp} value={stocks.filter(s => s.change >= 5).length + combinedMovers(indexSpots, stocks, 5).length} label="5%+ movers" accent="blue"/>
      <Metric icon={Flame} value={stocks.filter(s => s.change >= 10).length + combinedMovers(indexSpots, stocks, 10).length} label="10%+ movers" accent="orange"/>
      <Metric icon={Gauge} value={stocks.filter(s => s.momentum >= 75).length} label="High momentum" accent="purple"/>
      <Metric icon={Zap} value={stocks.filter(s => s.breakout).length} label="Breakout candidates" accent="yellow"/>
    </div>
    <div className="dash-grid">
      <div className="panel">
        <div className="panel-head"><div><h2>Top gainers</h2><p>{feedMode === 'LIVE' ? 'Highest session change · DhanHQ' : 'Highest session change · simulated stream'}</p></div></div>
        <StockTable compact rows={[...stocks].sort((a, b) => b.change - a.change).slice(0, 5)} watch={[]} open={open} toggle={() => {}} paper={paper} emptyLive={feedMode === 'UNAVAILABLE'}/>
      </div>
      <ScannerPanel stocks={stocks} feedMode={feedMode}/>
    </div>
  </>;
}

function Index({name, row, live}: {name: string; row?: IndexRow; live: boolean}) {
  const ok = live && row && row.dataStatus === 'LIVE' && typeof row.price === 'number';
  return <div className="card index">
    <div className="card-head"><span>{name}</span><em>{ok ? 'Live' : 'Unavailable'}</em></div>
    {ok ? <><h3 className="index-live">{row.price!.toLocaleString('en-IN', {maximumFractionDigits: 2})}</h3><Change n={row.changePercent || 0}/></> : <><h3>— —</h3><div className="unavailable"><Radio size={14}/> LIVE DATA UNAVAILABLE</div></>}
    <small>{ok ? 'DhanHQ' : live ? 'Index not in Dhan response' : 'Provider not configured'}</small>
  </div>;
}

function Metric({icon: Icon, value, label, accent}: {icon: typeof ArrowUpRight; value: number; label: string; accent: string}) {
  return <div className={`metric ${accent}`}><div><Icon/><span>{label}</span></div><b>{value}</b><ChevronRight/></div>;
}

function ScannerPanel({stocks, feedMode}: {stocks: Stock[]; feedMode: FeedMode}) {
  return <div className="panel scanner">
    <div className="panel-head"><div><h2>Scanner pulse</h2><p>Rule engine summary</p></div><span className="demo-tag">{feedMode === 'LIVE' ? 'LIVE RULES' : 'DEMO'}</span></div>
    <div className="pulse"><div className="pulse-ring"><Activity/><i/></div><h3>{stocks.filter(s => s.breakout || s.momentum >= 75).length} candidates active</h3><p>Based on your configured rule set</p></div>
    <div className="rule"><span>Momentum ≥ 75</span><b>{stocks.filter(s => s.momentum >= 75).length} matches</b></div>
    <div className="rule"><span>Relative volume ≥ 1.5×</span><b>{stocks.filter(s => s.relVol >= 1.5).length} matches</b></div>
    <div className="rule"><span>Breakout confirmed</span><b>{stocks.filter(s => s.breakout).length} matches</b></div>
    <div className="disclaimer">Matches are signals, not recommendations. EDUCATIONAL / SIMULATED — NOT FINANCIAL ADVICE</div>
  </div>;
}

function StockTable({rows, watch, open, toggle, paper, compact = false, emptyLive = false}: {rows: Stock[]; watch: string[]; open: (s: Stock) => void; toggle: (s: string) => void; paper: (s: Stock) => void; compact?: boolean; emptyLive?: boolean}) {
  if (emptyLive && rows.length === 0) return <div className="empty"><Radio/><h3>LIVE DATA UNAVAILABLE</h3><p>No Dhan quotes to display. Nothing is invented.</p></div>;
  return <div className="table-wrap">{rows.length === 0 ? <div className="empty"><Search/><h3>No matching stocks</h3><p>Try changing the filter or adding stocks to your watchlist.</p></div> : <table><thead><tr><th>Symbol</th><th>Price</th><th>Change</th><th className="hide-mobile">Rel. volume</th><th className="hide-mobile">Momentum</th>{!compact && <th className="hide-mobile">Signal</th>}<th/></tr></thead><tbody>{rows.map(s => <tr key={s.symbol} onClick={() => open(s)}><td><div className="symbol"><button aria-label="watch" onClick={e => { e.stopPropagation(); toggle(s.symbol); }}><Star size={15} fill={watch.includes(s.symbol) ? 'currentColor' : 'none'}/></button><div><b>{s.symbol}</b><span>{s.name}</span></div></div></td><td><b>{money(s.price)}</b><span className="mobile-sub">Vol {s.volume}</span></td><td><Change n={s.change}/></td><td className="hide-mobile"><b>{s.relVol.toFixed(1)}×</b></td><td className="hide-mobile"><Score n={s.momentum}/></td>{!compact && <td className="hide-mobile">{s.breakout ? <span className="signal"><Zap size={12}/> Breakout</span> : <span className="muted">Watching</span>}</td>}<td><button className="trade-btn" onClick={e => { e.stopPropagation(); paper(s); }}>Paper trade</button></td></tr>)}</tbody></table>}</div>;
}

function Change({n}: {n: number}) {
  return <span className={n >= 0 ? 'change positive' : 'change negative'}>{n >= 0 ? <ArrowUpRight/> : <ArrowDownRight/>}{Math.abs(n).toFixed(2)}%</span>;
}
function Score({n}: {n: number}) {
  return <div className="score"><b>{n}</b><span><i style={{width: n + '%'}}/></span></div>;
}

function StockDetail({stock: s, watched, back, toggle, paper, live}: {stock: Stock; watched: boolean; back: () => void; toggle: () => void; paper: () => void; live: boolean}) {
  const chart = spark.map((v, i) => ({i, v: v + s.change * i / 4}));
  return <div>
    <button className="back" onClick={back}><ArrowLeft/> Back to scanner</button>
    <div className="stock-hero">
      <div><div className="stock-id"><div>{s.symbol.slice(0, 2)}</div><span><h1>{s.symbol}</h1><p>{s.name} · NSE · {s.sector}</p></span></div></div>
      <div className="stock-price"><h2>{money(s.price)}</h2><Change n={s.change}/><span className="demo-tag">{live ? 'LIVE DHAN' : 'DEMO DATA'}</span></div>
      <div className="stock-actions"><button onClick={toggle}><Star fill={watched ? 'currentColor' : 'none'}/>{watched ? 'Watching' : 'Watchlist'}</button><button className="primary" onClick={paper}><WalletCards/> Paper trade</button></div>
    </div>
    <div className="detail-grid">
      <div className="panel chart-panel">
        <div className="panel-head"><h2>Price overview</h2><div className="ranges"><button className="active">1D</button><button>1W</button><button>1M</button><button>3M</button><button>1Y</button></div></div>
        <div className="ohlc"><span>Open <b>{money(s.open ?? s.low)}</b></span><span>High <b>{money(s.high)}</b></span><span>Low <b>{money(s.low)}</b></span><span>Volume <b>{s.volume}</b></span></div>
        <ResponsiveContainer width="100%" height={270}><AreaChart data={chart}><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#37d39a" stopOpacity=".35"/><stop offset="1" stopColor="#37d39a" stopOpacity="0"/></linearGradient></defs><Tooltip contentStyle={{background: '#101c18', border: '1px solid #263b34'}}/><Area dataKey="v" stroke="#37d39a" fill="url(#g)" strokeWidth={2}/></AreaChart></ResponsiveContainer>
        <p className="fixture-note">Illustrative development series — not historical market candles.</p>
      </div>
      <div>
        <div className="panel momentum-card"><div className="panel-head"><h2>Momentum score</h2><span className="score-big">{s.momentum}<small>/100</small></span></div><Score n={s.momentum}/><ul><li><CircleCheck/>Session change {s.change.toFixed(2)}%</li><li><CircleCheck/>Relative volume {s.relVol}×{live ? ' (unknown avg = 1.0×)' : ''}</li><li><CircleCheck/>High {money(s.high)} / Low {money(s.low)}</li></ul></div>
        <div className="panel breakout-card"><Zap/><div><b>{s.breakout ? 'Possible breakout candidate' : 'No breakout confirmed'}</b><span>{s.breakout ? 'Price and volume rules matched' : 'Monitoring configured resistance'}</span></div></div>
      </div>
    </div>
  </div>;
}

function PaperTrade({stocks, positions, paper, feedMode, indexSpots, openIndex, universe, indexAutoOn, setIndexAutoOn}: {stocks: Stock[]; positions: Position[]; paper: (s: Stock) => void; feedMode: FeedMode; indexSpots: ReturnType<typeof resolveIndexSpots>; openIndex: (s: OptionSetup) => void; universe: Stock[]; indexAutoOn: boolean; setIndexAutoOn: (v: boolean) => void}) {
  const {invested, pnl} = bookSummary(positions, universe);
  return <>
    <PageTitle title="Paper Trade" subtitle="Practice with ₹10,00,000 virtual capital — cash, stock options and index options · simulation only"/>
    <IndexOptionBoard spots={indexSpots} stocks={stocks} openIndex={openIndex} indexAutoOn={indexAutoOn} setIndexAutoOn={setIndexAutoOn}/>
    <div className="paper-summary">
      <div><span>Virtual balance</span><b>{money(1000000 - invested)}</b><small>Available simulated capital</small></div>
      <div><span>Invested</span><b>{money(invested)}</b><small>Across {positions.length} open positions</small></div>
      <div><span>Unrealized P&L</span><b className={pnl >= 0 ? 'positive' : 'negative'}>{money(pnl)}</b><small>{feedMode === 'LIVE' ? 'Marked to Dhan last price' : 'From deterministic demo ticks'}</small></div>
      <div><span>Risk mode</span><b>Paper</b><small>No broker execution</small></div>
    </div>
    <div className="panel">
      <div className="panel-head"><div><h2>Choose a symbol</h2><p>{feedMode === 'LIVE' ? 'Quotes refresh from DhanHQ every few seconds.' : 'Quotes refresh every three seconds in simulation mode.'}</p></div><span className="simulation">SIMULATION ONLY</span></div>
      <div className="trade-picker">{stocks.slice(0, 8).map(s => <button onClick={() => paper(s)} key={s.symbol}><span><b>{s.symbol}</b><small>{s.name}</small></span><span><b>{money(s.price)}</b><Change n={s.change}/></span><ChevronRight/></button>)}</div>
    </div>
  </>;
}

function Positions({positions, stocks, connected, feedMode, setPositions, ping, bookId, adoptBook}: {positions: Position[]; stocks: Stock[]; connected: boolean; feedMode: FeedMode; setPositions: (v: Position[] | ((x: Position[]) => Position[])) => void; ping: (t: string) => void; bookId: string; adoptBook: (id: string) => void}) {
  const [dhanPos, setDhanPos] = useState<BrokerPosition[]>([]);
  useEffect(() => {
    if (!connected) return;
    api<{items: BrokerPosition[]}>('/api/broker/positions').then(d => setDhanPos(d.items || [])).catch(() => setDhanPos([]));
  }, [connected]);
  return <>
    <PageTitle title="Positions" subtitle="Cloud paper book — phone aur computer pe same. Dhan positions read-only."/>
    <div className="panel">
      <div className="panel-head"><h2>Paper positions</h2><span className="simulation">SIMULATION</span></div>
      <div className="sync-bar">
        <button className="secondary broker-button" onClick={async () => { await navigator.clipboard.writeText(JSON.stringify(positions)); ping('Paper book copied — computer pe Paste book dabao'); }}>Copy book</button>
        <button className="secondary broker-button" onClick={async () => {
          const raw = window.prompt('Mobile se copied paper book yahan paste karo');
          if (!raw) return;
          try {
            const next = JSON.parse(raw);
            if (!Array.isArray(next)) throw new Error('not array');
            setPositions(next);
            ping(`Imported ${next.length} paper positions`);
          } catch { ping('Paste fail — poori copied text use karo'); }
        }}>Paste book</button>
        <button className="secondary broker-button" onClick={() => { navigator.clipboard.writeText(window.location.href); ping('Book URL copied'); }}>{bookId || 'Book'}</button>
        <small className="muted">Cloud book {bookId || '…'} · dusre device pe yahi URL kholo, positions same rahengi.</small>
      </div>
      {positions.length === 0 ? <div className="empty"><BriefcaseBusiness/><h3>No open paper positions</h3><p>Paper trades cloud book {bookId || ''} pe save hote hain. Phone pe trade karo, computer pe 4 second mein dikhega.</p></div> : <div className="table-wrap stack-table"><table><thead><tr><th>Contract</th><th>Side</th><th>Qty</th><th>Entry</th><th>Mark</th><th>Unrealized P&L</th><th>Levels</th></tr></thead><tbody>{positions.map((p, i) => {
        const m = markPosition(p, stocks);
        return <tr key={i}><td><b>{m.label}</b></td><td><span className="signal">{p.product === 'OPTION' ? 'OPT' : p.source === 'auto' ? 'AUTO' : 'CASH'} {p.side}</span></td><td>{p.qty}{p.product === 'OPTION' ? ' lot' : ''}</td><td>{money(p.entry)}</td><td>{money(m.mark)}</td><td><b className={m.pnl >= 0 ? 'positive' : 'negative'}>{money(m.pnl)}</b></td><td><span className="muted">{p.stop && p.target ? `SL ${p.stop} · TGT ${p.target}` : 'Open'}</span></td></tr>;
      })}</tbody></table></div>}
    </div>
    <div className="panel" style={{marginTop: 14}}>
      <div className="panel-head"><h2>Dhan positions</h2><span className="simulation">READ ONLY</span></div>
      {!connected ? <div className="empty"><ShieldCheck/><h3>Broker not connected</h3><p>Connect Dhan in Settings to view live positions. TradeMate cannot square them off.</p></div> : dhanPos.length === 0 ? <div className="empty"><BriefcaseBusiness/><h3>No Dhan positions returned</h3><p>Either the book is flat or Dhan did not send positions.</p></div> : <table><thead><tr><th>Symbol</th><th>Type</th><th>Net qty</th><th>Buy avg</th><th>Unrealized</th></tr></thead><tbody>{dhanPos.map((p, i) => <tr key={i}><td><b>{p.tradingSymbol}</b></td><td>{p.positionType}</td><td>{p.netQty}</td><td>{p.buyAvg != null ? money(p.buyAvg) : '—'}</td><td>{p.unrealizedProfit != null ? money(p.unrealizedProfit) : '—'}</td></tr>)}</tbody></table>}
    </div>
  </>;
}

function Alerts({stocks, feedMode}: {stocks: Stock[]; feedMode: FeedMode}) {
  const live = feedMode === 'LIVE' ? stocks.filter(s => s.change >= 5 || s.breakout || s.momentum >= 85).slice(0, 8) : [];
  return <>
    <PageTitle title="Alerts" subtitle={feedMode === 'LIVE' ? 'Rule matches on the current Dhan snapshot' : 'Rule-based in-app notifications'}/>
    <div className="alerts-list">
      {feedMode === 'LIVE' && live.length === 0 && <div className="empty"><Bell/><h3>No live rule matches</h3><p>Nothing in the current Dhan snapshot crossed 5%, breakout or 85 momentum.</p></div>}
      {feedMode === 'LIVE' && live.map(s => <Alert key={s.symbol} icon={s.breakout ? Zap : TrendingUp} title={`${s.symbol} ${s.change >= 0 ? '+' : ''}${s.change.toFixed(2)}%`} text={s.breakout ? 'Breakout rule matched on live quote' : `Momentum ${s.momentum}/100 on Dhan last price`} time="Live"/>)}
      {feedMode !== 'LIVE' && <>
        <Alert icon={TrendingUp} title="SBIN crossed +10%" text="Percentage threshold rule matched in demo data" time="11 min ago"/>
        <Alert icon={Zap} title="Breakout candidate: TATAMOTORS" text="Price and relative-volume confirmation matched" time="24 min ago"/>
        <Alert icon={Activity} title="INFY momentum crossed 80" text="Momentum score is now 83/100" time="42 min ago"/>
      </>}
    </div>
  </>;
}

function Alert({icon: Icon, title, text, time}: {icon: typeof TrendingUp; title: string; text: string; time: string}) {
  return <div className="alert-item"><div><Icon/></div><span><b>{title}</b><p>{text}</p></span><small>{time}</small></div>;
}

function SettingsPage({openBroker, broker, feedMode, onDisconnected, ping, openHowTo, pwa, bookId, adoptBook}: {openBroker: () => void; broker: BrokerStatus; feedMode: FeedMode; onDisconnected: () => void; ping: (t: string) => void; openHowTo: () => void; pwa: ReturnType<typeof usePwaInstall>; bookId: string; adoptBook: (id: string) => void}) {
  const defaults = {balance: '1000000', stop: '2', target: '4', momentum: '75', volume: '1.5', lookback: '20', stale: '30'};
  const [s, setS] = useState<Record<string, string>>(() => ({...defaults, ...JSON.parse(localStorage.getItem('tm-settings') || '{}')}));
  const [funds, setFunds] = useState<Funds | null>(null);
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const update = (key: string, value: string) => {
    const next = {...s, [key]: value};
    setS(next);
    localStorage.setItem('tm-settings', JSON.stringify(next));
  };
  useEffect(() => {
    if (!broker.connected) return;
    api<{item: Funds}>('/api/broker/funds').then(d => setFunds(d.item)).catch(() => setFunds(null));
    api<{items: Holding[]}>('/api/broker/holdings').then(d => setHoldings(d.items || [])).catch(() => setHoldings([]));
  }, [broker.connected]);
  const disconnect = async () => {
    await api('/api/broker/disconnect', {method: 'POST', body: '{}'});
    ping('Dhan disconnected · back to demo');
    onDisconnected();
  };
  const available = funds?.availabelBalance ?? funds?.availableBalance;
  return <>
    <PageTitle title="Settings" subtitle="Scanner, simulation and Dhan read-only connection"/>
    <div className="settings-grid">
      <SettingsSection title="Paper trading" icon={WalletCards}>
        <SelectField label="Starting virtual balance" value={s.balance} options={[['500000', '₹5,00,000'], ['1000000', '₹10,00,000'], ['2500000', '₹25,00,000']]} onChange={v => update('balance', v)}/>
        <SelectField label="Default stop loss" value={s.stop} options={[['1', '1.0%'], ['1.5', '1.5%'], ['2', '2.0%'], ['3', '3.0%']]} onChange={v => update('stop', v)}/>
        <SelectField label="Default target" value={s.target} options={[['2', '2.0%'], ['4', '4.0%'], ['6', '6.0%'], ['8', '8.0%']]} onChange={v => update('target', v)}/>
      </SettingsSection>
      <SettingsSection title="Scanner rules" icon={Gauge}>
        <SelectField label="Minimum momentum" value={s.momentum} options={[['60', '60 / 100'], ['70', '70 / 100'], ['75', '75 / 100'], ['85', '85 / 100']]} onChange={v => update('momentum', v)}/>
        <SelectField label="Relative volume" value={s.volume} options={[['1.2', '1.2×'], ['1.5', '1.5×'], ['2', '2.0×'], ['3', '3.0×']]} onChange={v => update('volume', v)}/>
        <SelectField label="Breakout lookback" value={s.lookback} options={[['10', '10 sessions'], ['20', '20 sessions'], ['50', '50 sessions']]} onChange={v => update('lookback', v)}/>
      </SettingsSection>
      <SettingsSection title="Data provider" icon={Radio}>
        <div className="field"><span>Provider</span><strong>{broker.connected ? 'DhanHQ' : 'Demo simulation'}</strong></div>
        <div className="field"><span>Feed status</span><strong className={feedMode === 'LIVE' ? 'positive' : ''}>{feedMode}</strong></div>
        <div className="field"><span>Client ID</span><strong>{broker.clientIdMasked || '—'}</strong></div>
        <SelectField label="Stale threshold" value={s.stale} options={[['15', '15 seconds'], ['30', '30 seconds'], ['60', '60 seconds']]} onChange={v => update('stale', v)}/>
      </SettingsSection>
      <SettingsSection title="Broker connection" icon={ShieldCheck}>
        <div className="read-only">READ ONLY · NO ORDER PLACEMENT</div>
        <p className="settings-note">{broker.connected ? 'Dhan is connected for profile, funds, holdings, positions, orders and market quotes. TradeMate never sends buy or sell orders.' : 'Paste your Dhan Client ID and 24-hour Access Token. They are sent only to this app’s server and are never stored in the browser.'}</p>
        {broker.connected ? <>
          <div className="field"><span>Available (Dhan)</span><strong>{available != null ? money(available) : '—'}</strong></div>
          <div className="field"><span>Holdings</span><strong>{holdings.length} scrips</strong></div>
          <button className="secondary broker-button" onClick={disconnect}><Unplug size={14}/> Disconnect Dhan</button>
        </> : <button className="secondary broker-button" onClick={openBroker}>Connect DhanHQ (read-only) <ChevronRight/></button>}
        <a className="secondary broker-button dhan-link" href={DHAN_WEB} target="_blank" rel="noreferrer">Open Dhan manually <ExternalLink size={14}/></a>
      </SettingsSection>
    </div>
    {broker.connected && holdings.length > 0 && <div className="panel" style={{marginTop: 14}}>
      <div className="panel-head"><h2>Dhan holdings</h2><span className="simulation">READ ONLY</span></div>
      <table><thead><tr><th>Symbol</th><th>Qty</th><th>Avg cost</th></tr></thead><tbody>{holdings.slice(0, 12).map((h, i) => <tr key={i}><td><b>{h.tradingSymbol}</b></td><td>{h.availableQty ?? h.totalQty}</td><td>{h.avgCostPrice != null ? money(h.avgCostPrice) : '—'}</td></tr>)}</tbody></table>
    </div>}
    <div className="panel howto-settings">
      <div className="setting-title"><Smartphone/><h2>Computer + mobile + Vercel</h2></div>
      <div className="field"><span>Online URL</span><strong>{window.location.origin}</strong></div>
      <div className="field"><span>Cloud book</span><strong>{bookId || '—'}</strong></div>
      <p className="settings-note">Paper positions cloud book pe save hoti hain. Phone aur computer pe same URL (?book=) kholo — P&amp;L same rahega. Dusre device pe alag book ho to yahan code paste karo.</p>
      <button className="secondary broker-button" onClick={() => { const v = window.prompt('Book code (TM-XXXXXX)', bookId); if (v) adoptBook(v); }}>Join / change book</button>
      {pwa.installed ? <div className="field"><span>App mode</span><strong className="positive">Installed</strong></div> : pwa.canInstall ? <button className="secondary broker-button" onClick={() => pwa.install()}>Is device pe install karo</button> : <p className="settings-note">Install: Android Chrome → Add to Home screen. iPhone Safari → Share → Add to Home Screen. Computer Chrome → address bar install icon.</p>}
      <button className="secondary broker-button" onClick={() => { navigator.clipboard.writeText(window.location.href).then(() => ping('URL copied — phone pe paste karo')); }}>Copy URL</button>
      <button className="secondary broker-button" onClick={openHowTo}>How to use guide kholo</button>
    </div>
    <div className="saved-note"><CircleCheck/> Changes are saved automatically on this device. Tokens are not.</div>
  </>;
}

function SettingsSection({title, icon: Icon, children}: {title: string; icon: typeof WalletCards; children: ReactNode}) {
  return <div className="panel setting"><div className="setting-title"><Icon/><h2>{title}</h2></div>{children}</div>;
}
function SelectField({label, value, options, onChange}: {label: string; value: string; options: [string, string][]; onChange: (v: string) => void}) {
  return <label className="field"><span>{label}</span><span className="select-wrap"><select value={value} onChange={e => onChange(e.target.value)}>{options.map(([v, l]) => <option value={v} key={v}>{l}</option>)}</select><ChevronDown/></span></label>;
}

type OptSortKey = 'contract' | 'type' | 'spot' | 'change' | 'optMove' | 'strike' | 'premium' | 'buyAbove' | 'sl' | 'tgt' | 'status';
function optSortValue(s: OptionSetup, key: OptSortKey): string | number {
  if (key === 'contract') return s.label;
  if (key === 'type') return s.type;
  if (key === 'spot') return s.spot;
  if (key === 'change') return s.change;
  if (key === 'optMove') return s.optionChange;
  if (key === 'strike') return s.strike;
  if (key === 'premium') return s.premium;
  if (key === 'buyAbove') return s.buyAbove;
  if (key === 'sl') return s.sl;
  if (key === 'tgt') return s.tgt;
  return s.breakout ? 1 : 0;
}
function SortTh({label, col, sort, dir, onSort}: {label: string; col: OptSortKey; sort: OptSortKey; dir: 'up' | 'down'; onSort: (c: OptSortKey) => void}) {
  const active = sort === col;
  return <th><button className={`sort-th ${active ? 'active' : ''}`} onClick={() => onSort(col)}><span>{label}</span><i>{active ? (dir === 'up' ? '▲' : '▼') : '↕'}</i></button></th>;
}

function BreakoutsPage({stocks, watch, open, toggle, paper, feedMode, indexSpots, openIndex, search}: {
  stocks: Stock[]; watch: string[]; open: (s: Stock) => void; toggle: (s: string) => void; paper: (s: Stock) => void;
  feedMode: FeedMode; indexSpots: ReturnType<typeof resolveIndexSpots>; openIndex: (s: OptionSetup) => void; search: string;
}) {
  const [sort, setSort] = useState<OptSortKey>('status');
  const [dir, setDir] = useState<'up' | 'down'>('down');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CE' | 'PE'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'BREAKOUT' | 'WATCHING'>('ALL');
  const [indexFilter, setIndexFilter] = useState<'ALL' | 'INDEX' | 'STOCK' | 'NIFTY' | 'BANKNIFTY' | 'SENSEX'>('ALL');
  const onSort = (col: OptSortKey) => {
    if (sort === col) setDir(d => d === 'up' ? 'down' : 'up');
    else { setSort(col); setDir(col === 'contract' || col === 'type' ? 'up' : 'down'); }
  };
  const setups = combinedOptionSetups(indexSpots, stocks)
    .filter(s => !search || (s.label + ' ' + s.line).toLowerCase().includes(search.toLowerCase()))
    .filter(s => typeFilter === 'ALL' || s.type === typeFilter)
    .filter(s => statusFilter === 'ALL' || (statusFilter === 'BREAKOUT' ? s.breakout : !s.breakout))
    .filter(s => indexFilter === 'ALL' || (indexFilter === 'INDEX' && s.kind === 'INDEX') || (indexFilter === 'STOCK' && s.kind === 'STOCK') || s.underlying === indexFilter)
    .slice()
    .sort((a, b) => {
      const av = optSortValue(a, sort);
      const bv = optSortValue(b, sort);
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return dir === 'up' ? cmp : -cmp;
    });
  const allSetups = combinedOptionSetups(indexSpots, stocks);
  const breaks = allSetups.filter(s => s.breakout);
  const equity = stocks.filter(s => s.breakout).filter(s => !search || (s.symbol + ' ' + s.name).toLowerCase().includes(search.toLowerCase()));
  return <>
    <PageTitle title="Breakouts" subtitle="Equity names plus index-option BUY ABOVE scan · EDUCATIONAL / SIMULATED — NOT FINANCIAL ADVICE"/>
    <div className="paper-summary">
      <div><span>Index option contracts</span><b>{allSetups.length}</b><small>NIFTY · BANKNIFTY · SENSEX</small></div>
      <div><span>Option breakouts</span><b>{breaks.length}</b><small>CE if ≥+0.35% · PE if ≤−0.35%</small></div>
      <div><span>Equity breakouts</span><b>{equity.length}</b><small>Price/volume rule</small></div>
      <div><span>Premium source</span><b>DEMO</b><small>No live option chain</small></div>
    </div>
    <div className="panel" style={{marginBottom: 16}}>
      <div className="panel-head"><div><h2>Option scan · index + stock</h2><p>Tap a column for up/down sort · INDEX / STOCK tabs</p></div><span className="demo-tag">{feedMode === 'LIVE' ? 'SPOT MIX' : 'DEMO'}</span></div>
      <div className="filter-tabs">
        {(['ALL', 'INDEX', 'STOCK', 'NIFTY', 'BANKNIFTY', 'SENSEX'] as const).map(id => <button key={id} className={indexFilter === id ? 'on' : ''} onClick={() => setIndexFilter(id)}>{id}</button>)}
        <span className="filter-gap"/>
        {(['ALL', 'CE', 'PE'] as const).map(id => <button key={id} className={typeFilter === id ? 'on' : ''} onClick={() => setTypeFilter(id)}>{id === 'ALL' ? 'ALL TYPE' : id}</button>)}
        <span className="filter-gap"/>
        {(['ALL', 'BREAKOUT', 'WATCHING'] as const).map(id => <button key={id} className={statusFilter === id ? 'on' : ''} onClick={() => setStatusFilter(id)}>{id}</button>)}
      </div>
      <div className="table-wrap opt-table">
        <table>
          <thead><tr>
            <SortTh label="Contract" col="contract" sort={sort} dir={dir} onSort={onSort}/>
            <SortTh label="Type" col="type" sort={sort} dir={dir} onSort={onSort}/>
            <SortTh label="Spot" col="spot" sort={sort} dir={dir} onSort={onSort}/>
            <SortTh label="Index %" col="change" sort={sort} dir={dir} onSort={onSort}/>
            <SortTh label="Opt %" col="optMove" sort={sort} dir={dir} onSort={onSort}/>
            <SortTh label="Strike" col="strike" sort={sort} dir={dir} onSort={onSort}/>
            <SortTh label="Premium" col="premium" sort={sort} dir={dir} onSort={onSort}/>
            <SortTh label="Buy above" col="buyAbove" sort={sort} dir={dir} onSort={onSort}/>
            <SortTh label="SL" col="sl" sort={sort} dir={dir} onSort={onSort}/>
            <SortTh label="TGT" col="tgt" sort={sort} dir={dir} onSort={onSort}/>
            <SortTh label="Status" col="status" sort={sort} dir={dir} onSort={onSort}/>
            <th/>
          </tr></thead>
          <tbody>{setups.map(s => <tr key={s.line} onClick={() => openIndex(s)}>
            <td><div className="symbol"><div><b>{s.label}</b><span>{s.title} · lot {s.lot} · {s.dataStatus === 'LIVE' ? 'spot LIVE' : 'DEMO spot'}</span></div></div></td>
            <td><span className="signal">{s.type}</span></td>
            <td><b>{s.spot.toLocaleString('en-IN')}</b></td>
            <td><Change n={s.change}/></td>
            <td><Change n={s.optionChange}/></td>
            <td>{s.strike}</td>
            <td>{money(s.premium)} <span className="muted">DEMO</span></td>
            <td><b className="positive">{money(s.buyAbove)}</b></td>
            <td>{money(s.sl)}</td>
            <td>{money(s.tgt)}</td>
            <td>{s.breakout ? <span className="signal"><Zap size={12}/> Breakout</span> : <span className="muted">Watching</span>}</td>
            <td><button className="trade-btn" onClick={e => { e.stopPropagation(); openIndex(s); }}>Paper {s.type}</button></td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="disclaimer" style={{margin: '10px 16px'}}>{breaks[0] ? breaks[0].reason : 'No index-option breakout on this snapshot. Premiums are DEMO DATA, not exchange LTPs.'}</p>
    </div>
    <div className="panel">
      <div className="panel-head"><div><h2>Equity breakouts</h2><p>Cash names matching price/volume confirmation</p></div></div>
      <StockTable rows={equity} watch={watch} open={open} toggle={toggle} paper={paper} emptyLive={feedMode === 'UNAVAILABLE'}/>
    </div>
  </>;
}

function MoversPage({threshold = 0, mode = 'movers', stocks, watch, open, toggle, paper, feedMode, indexSpots, openIndex, search}: {
  threshold?: number; mode?: 'movers' | 'gainers' | 'momentum'; stocks: Stock[]; watch: string[]; open: (s: Stock) => void; toggle: (s: string) => void; paper: (s: Stock) => void;
  feedMode: FeedMode; indexSpots: ReturnType<typeof resolveIndexSpots>; openIndex: (s: OptionSetup) => void; search: string;
}) {
  const [sort, setSort] = useState<OptSortKey>(mode === 'momentum' ? 'status' : 'optMove');
  const [dir, setDir] = useState<'up' | 'down'>('down');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CE' | 'PE'>('ALL');
  const [indexFilter, setIndexFilter] = useState<'ALL' | 'INDEX' | 'STOCK' | 'NIFTY' | 'BANKNIFTY' | 'SENSEX'>('ALL');
  const onSort = (col: OptSortKey) => {
    if (sort === col) setDir(d => d === 'up' ? 'down' : 'up');
    else { setSort(col); setDir('down'); }
  };
  const raw = combinedOptionSetups(indexSpots, stocks).filter(s => {
    if (mode === 'momentum') return (s.kind === 'STOCK' && (s.underMomentum || 0) >= 75) || (s.kind === 'INDEX' && s.breakout);
    if (mode === 'gainers') return s.optionChange > 0;
    return Math.abs(s.optionChange) >= (threshold || 0);
  });
  const options = raw
    .filter(s => !search || (s.label + ' ' + s.line).toLowerCase().includes(search.toLowerCase()))
    .filter(s => typeFilter === 'ALL' || s.type === typeFilter)
    .filter(s => indexFilter === 'ALL' || (indexFilter === 'INDEX' && s.kind === 'INDEX') || (indexFilter === 'STOCK' && s.kind === 'STOCK') || s.underlying === indexFilter)
    .slice()
    .sort((a, b) => {
      const av = optSortValue(a, sort);
      const bv = optSortValue(b, sort);
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return dir === 'up' ? cmp : -cmp;
    });
  const equity = (mode === 'momentum' ? stocks.filter(s => s.momentum >= 75).sort((a,b)=>b.momentum-a.momentum) : mode === 'gainers' ? [...stocks].sort((a,b)=>b.change-a.change) : stocks.filter(s => s.change >= (threshold||0))).filter(s => !search || (s.symbol + ' ' + s.name).toLowerCase().includes(search.toLowerCase()));
  return <>
    <PageTitle title={mode === 'gainers' ? 'Top Gainers' : mode === 'momentum' ? 'High Momentum' : `${threshold}%+ Movers`} subtitle={`Automatic scanner · cash + index options + stock options · EDUCATIONAL / SIMULATED — NOT FINANCIAL ADVICE`}/>
    <div className="paper-summary">
      <div><span>Index option hits</span><b>{options.length}</b><small>Opt % ≥ {threshold} · DEMO estimate</small></div>
      <div><span>Equity hits</span><b>{equity.length}</b><small>Session change ≥ {threshold}%</small></div>
      <div><span>Scanner</span><b>LIVE RUN</b><small>Refreshes with every tick</small></div>
      <div><span>Auto</span><b>2–15% band</b><small>Index option paper auto uses this too</small></div>
    </div>
    <div className="panel" style={{marginBottom: 16}}>
      <div className="panel-head"><div><h2>{mode === 'gainers' ? 'Option top gainers' : mode === 'momentum' ? 'High-momentum options' : `Option ${threshold}%+ scanner`} · index + stock</h2><p>Estimated option % from index move × delta / DEMO premium — not a live option LTP</p></div><span className="demo-tag">AUTO SCAN</span></div>
      <div className="filter-tabs">
        {(['ALL', 'INDEX', 'STOCK', 'NIFTY', 'BANKNIFTY', 'SENSEX'] as const).map(id => <button key={id} className={indexFilter === id ? 'on' : ''} onClick={() => setIndexFilter(id)}>{id}</button>)}
        <span className="filter-gap"/>
        {(['ALL', 'CE', 'PE'] as const).map(id => <button key={id} className={typeFilter === id ? 'on' : ''} onClick={() => setTypeFilter(id)}>{id === 'ALL' ? 'ALL TYPE' : id}</button>)}
      </div>
      <div className="table-wrap opt-table">{options.length === 0 ? <div className="empty"><Search/><h3>No index-option {threshold}%+ hits</h3><p>Scanner is running. Opt % is a DEMO estimate from index move.</p></div> : <table>
        <thead><tr>
          <SortTh label="Contract" col="contract" sort={sort} dir={dir} onSort={onSort}/>
          <SortTh label="Type" col="type" sort={sort} dir={dir} onSort={onSort}/>
          <SortTh label="Spot" col="spot" sort={sort} dir={dir} onSort={onSort}/>
          <SortTh label="Index %" col="change" sort={sort} dir={dir} onSort={onSort}/>
          <SortTh label="Opt %" col="optMove" sort={sort} dir={dir} onSort={onSort}/>
          <SortTh label="Strike" col="strike" sort={sort} dir={dir} onSort={onSort}/>
          <SortTh label="Premium" col="premium" sort={sort} dir={dir} onSort={onSort}/>
          <SortTh label="Buy above" col="buyAbove" sort={sort} dir={dir} onSort={onSort}/>
          <SortTh label="SL" col="sl" sort={sort} dir={dir} onSort={onSort}/>
          <SortTh label="TGT" col="tgt" sort={sort} dir={dir} onSort={onSort}/>
          <SortTh label="Status" col="status" sort={sort} dir={dir} onSort={onSort}/>
          <th/>
        </tr></thead>
        <tbody>{options.map(s => <tr key={s.line} onClick={() => openIndex(s)}>
          <td><div className="symbol"><div><b>{s.label}</b><span>{s.title} · lot {s.lot} · {s.dataStatus === 'LIVE' ? 'spot LIVE' : 'DEMO spot'}</span></div></div></td>
          <td><span className="signal">{s.type}</span></td>
          <td><b>{s.spot.toLocaleString('en-IN')}</b></td>
          <td><Change n={s.change}/></td>
          <td><Change n={s.optionChange}/></td>
          <td>{s.strike}</td>
          <td>{money(s.premium)} <span className="muted">DEMO</span></td>
          <td><b className="positive">{money(s.buyAbove)}</b></td>
          <td>{money(s.sl)}</td>
          <td>{money(s.tgt)}</td>
          <td>{s.breakout ? <span className="signal"><Zap size={12}/> Breakout</span> : <span className="muted">{threshold}%+ opt</span>}</td>
          <td><button className="trade-btn" onClick={e => { e.stopPropagation(); openIndex(s); }}>Paper {s.type}</button></td>
        </tr>)}</tbody>
      </table>}</div>
    </div>
    <div className="panel">
      <div className="panel-head"><div><h2>{mode === 'gainers' ? 'Equity top gainers' : mode === 'momentum' ? 'High-momentum cash' : `Equity ${threshold}%+ movers`}</h2><p>Cash market names</p></div></div>
      <StockTable rows={equity} watch={watch} open={open} toggle={toggle} paper={paper} emptyLive={feedMode === 'UNAVAILABLE'}/>
    </div>
  </>;
}

function IndexOptionBoard({spots, stocks = [], openIndex, indexAutoOn, setIndexAutoOn}: {spots: ReturnType<typeof resolveIndexSpots>; stocks?: Stock[]; openIndex: (s: OptionSetup) => void; indexAutoOn: boolean; setIndexAutoOn: (v: boolean) => void}) {
  const all = combinedOptionSetups(spots, stocks);
  const breaks = all.filter(s => s.breakout);
  const setups = [...breaks, ...all.filter(s => !s.breakout)].slice(0, 18);
  return <div className="panel idx-board">
    <div className="panel-head">
      <div><h2>Options · index + stock</h2><p>NIFTY/BANKNIFTY/SENSEX plus RELIANCE/INFY etc CE-PE BUY ABOVE. Premium DEMO. EDUCATIONAL / SIMULATED — NOT FINANCIAL ADVICE</p></div>
      <button className={`auto-switch ${indexAutoOn ? 'on' : ''}`} onClick={() => setIndexAutoOn(!indexAutoOn)}>{indexAutoOn ? 'Stop option auto' : 'Start option auto'}</button>
    </div>
    <div className="idx-scan-bar"><b>{breaks.length} breakout</b><span> scanned {setups.length} contracts · paper auto max {INDEX_OPTION_AUTO.maxPositions} · no Dhan orders</span></div>
    <div className="idx-grid">{setups.map(s => <button className={`idx-card ${s.breakout ? 'breakout' : ''}`} key={s.line} onClick={() => openIndex(s)}>
      <div className="idx-card-top"><b>{s.label}</b><em>{s.breakout ? 'BREAKOUT' : s.dataStatus === 'LIVE' ? 'SPOT LIVE' : 'DEMO SPOT'}</em></div>
      <div className="idx-line">BUY ABOVE <strong>{money(s.buyAbove)}</strong></div>
      <div className="idx-meta"><span>SL {money(s.sl)}</span><span>TGT {money(s.tgt)}</span><span>Spot {s.spot.toLocaleString('en-IN')} ({s.change >= 0 ? '+' : ''}{s.change.toFixed(2)}%)</span></div>
      <small>{s.reason}</small>
    </button>)}</div>
  </div>;
}

function TradeModal({stock, close, submit, live, initialSide = 'BUY', preset}: {stock: Stock; close: () => void; submit: (p: Position) => void; live: boolean; initialSide?: 'BUY' | 'SELL'; preset?: {product: 'CASH' | 'OPTION'; optionType?: 'CE' | 'PE'; strike?: number} | null}) {
  const isIndex = stock.sector === 'Index';
  const spec = specFor(stock.symbol);
  const [side, setSide] = useState<'BUY' | 'SELL'>(initialSide);
  const [product, setProduct] = useState<'CASH' | 'OPTION'>(preset?.product || (isIndex ? 'OPTION' : 'CASH'));
  const [optionType, setOptionType] = useState<'CE' | 'PE'>(preset?.optionType || 'CE');
  const [qty, setQty] = useState(10);
  const [lots, setLots] = useState(1);
  const [copied, setCopied] = useState(false);
  const step = spec?.step || (stock.price >= 1000 ? 10 : 5);
  const lotSize = spec?.lot || 50;
  const atm = spec ? indexStrike(stock.price, spec.step) : roundStrike(stock.price);
  const [strikeOff, setStrikeOff] = useState(() => preset?.strike ? Math.round((preset.strike - atm) / step) : 0);
  const strike = atm + strikeOff * step;
  const premium = demoOptionPremium(stock.price, strike, optionType);
  const buyAbove = +(Math.round(premium * 1.02 * 20) / 20).toFixed(2);
  const slPx = +(buyAbove * 0.85).toFixed(2);
  const tgtPx = +(buyAbove * 1.3).toFixed(2);
  const idea = recommend(stock);
  const capital = product === 'OPTION' ? lots * lotSize * buyAbove : qty * stock.price;
  const label = product === 'OPTION' ? `${stock.symbol} ${strike} ${optionType}` : stock.symbol;
  const line = product === 'OPTION' ? `${label} ${side} ABOVE ${buyAbove}` : `${label} PAPER ${side}`;
  const summary = `PAPER / MANUAL TICKET — NOT AN ORDER\n${line}\nSpot: ${stock.price}\nSL: ${slPx}  TGT: ${tgtPx}\nLots: ${product === 'OPTION' ? lots + ' x ' + lotSize : qty}\nPlace this yourself in official Dhan if you choose.`;
  const copy = async () => {
    await navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  const place = () => {
    if (product === 'OPTION') {
      submit({symbol: stock.symbol, qty: lots, entry: buyAbove, side, source: 'manual', product: 'OPTION', optionType, strike, lotSize, entrySpot: stock.price, label, stop: slPx, target: tgtPx});
    } else {
      submit({symbol: stock.symbol, qty, entry: stock.price, side, source: 'manual', product: 'CASH', stop: +(stock.price * 0.98).toFixed(2), target: +(stock.price * 1.04).toFixed(2)});
    }
  };
  return <div className="modal-wrap"><div className="modal">
    <div className="modal-head"><div><span className="simulation">PAPER TRADE · SIMULATION ONLY</span><h2>{stock.symbol}</h2><p>{stock.name}</p></div><button onClick={close}><X/></button></div>
    {!isIndex && <div className="side-tabs product-tabs"><button className={product === 'CASH' ? 'active buy' : ''} onClick={() => setProduct('CASH')}>Stock cash</button><button className={product === 'OPTION' ? 'active buy' : ''} onClick={() => setProduct('OPTION')}>Stock option</button></div>}
    {isIndex && <div className="side-tabs product-tabs"><button className="active buy">Index option</button></div>}
    <div className="side-tabs"><button className={side === 'BUY' ? 'active buy' : ''} onClick={() => setSide('BUY')}>Paper Buy</button><button className={side === 'SELL' ? 'active sell' : ''} onClick={() => setSide('SELL')}>Paper Sell</button></div>
    <div className="quote-row"><span>{product === 'OPTION' ? 'DEMO premium / trigger' : live ? 'Dhan last price' : 'Demo price'}</span><b>{money(product === 'OPTION' ? premium : stock.price)}</b></div>
    {product === 'OPTION' && <div className="buy-above-box"><span>{label}</span><h3>{side} ABOVE {money(buyAbove)}</h3><p>SL {money(slPx)} · TGT {money(tgtPx)} · Spot {stock.price.toLocaleString('en-IN')}</p></div>}
    {product === 'OPTION' && <div className="modal-warning"><CircleAlert/>Live option-chain quotes are not connected. BUY ABOVE uses DEMO premium from spot. EDUCATIONAL / SIMULATED — NOT FINANCIAL ADVICE.</div>}
    {product === 'CASH' && <div className="idea-row"><span>AI setup</span><b>{idea.action}</b><small>{idea.reason}</small></div>}
    {product === 'OPTION' ? <>
      <div className="side-tabs"><button className={optionType === 'CE' ? 'active buy' : ''} onClick={() => setOptionType('CE')}>Call CE</button><button className={optionType === 'PE' ? 'active sell' : ''} onClick={() => setOptionType('PE')}>Put PE</button></div>
      <div className="strike-row">{[-2, -1, 0, 1, 2].map(off => <button key={off} className={atm + off * step === strike ? 'active' : ''} onClick={() => setStrikeOff(off)}>{atm + off * step}</button>)}</div>
      <div className="form-row"><label>Lots<input min={1} type="number" value={lots} onChange={e => setLots(Math.max(1, +e.target.value))}/></label><label>Lot size<small className="field-static">{lotSize}</small></label></div>
    </> : <div className="form-row"><label>Quantity<input min={1} type="number" value={qty} onChange={e => setQty(Math.max(1, +e.target.value))}/></label><label>Order type<select><option>Market simulation</option><option>Limit simulation</option></select></label></div>}
    <div className="risk-box"><div><span>Capital allocated</span><b>{money(capital)}</b></div><div><span>Max loss to SL</span><b className="negative">{product === 'OPTION' ? money((buyAbove - slPx) * lots * lotSize) : money(capital * 0.02)}</b></div><div><span>Target gain</span><b className="positive">{product === 'OPTION' ? money((tgtPx - buyAbove) * lots * lotSize) : money(capital * 0.04)}</b></div><div><span>Contract</span><b>{label}</b></div></div>
    <div className="modal-warning"><CircleAlert/>This creates a local simulated position. No order is sent to NSE or Dhan.</div>
    <button className="submit-trade" onClick={place}>Paper {side.toLowerCase()} {product === 'OPTION' ? label : 'cash'} <ArrowUpRight/></button>
    <div className="manual-row">
      <button className="secondary" onClick={copy}><Copy size={14}/>{copied ? 'Copied' : 'Copy ticket'}</button>
      <a className="secondary" href={DHAN_WEB} target="_blank" rel="noreferrer"><ExternalLink size={14}/> Open Dhan manually</a>
    </div>
  </div></div>;
}

function BrokerModal({close, onConnected}: {close: () => void; onConnected: (s: BrokerStatus) => void}) {
  const [clientId, setClientId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const connect = async () => {
    setBusy(true); setError('');
    try {
      const status = await api<BrokerStatus>('/api/broker/connect', {method: 'POST', body: JSON.stringify({clientId, accessToken})});
      setAccessToken('');
      onConnected(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not connect');
    } finally {
      setBusy(false);
    }
  };
  return <div className="modal-wrap"><div className="modal broker-modal">
    <div className="modal-head"><div><span className="simulation">BROKER CONNECTION · READ ONLY</span><h2>Connect DhanHQ</h2><p>Live quotes and account view — never order placement</p></div><button onClick={close}><X/></button></div>
    <div className="broker-safety"><ShieldCheck/><div><b>Token stays on the server</b><span>Paste the 24-hour Access Token from web.dhan.co. TradeMate does not store it in this browser and cannot place, modify or cancel orders.</span></div></div>
    <ol className="dhan-steps">
      <li>Login at <a href={DHAN_WEB} target="_blank" rel="noreferrer">web.dhan.co</a></li>
      <li>My Profile → Access DhanHQ APIs</li>
      <li>Generate Access Token (valid 24 hours)</li>
      <li>Paste Client ID + token below</li>
    </ol>
    <label className="token-field"><span>Dhan Client ID</span><input value={clientId} onChange={e => setClientId(e.target.value.trim())} placeholder="e.g. 1000000001" autoComplete="off"/></label>
    <label className="token-field"><span>Access Token</span><span className="token-input"><input type={show ? 'text' : 'password'} value={accessToken} onChange={e => setAccessToken(e.target.value)} placeholder="Paste token — not your Dhan password" autoComplete="off"/><button type="button" onClick={() => setShow(v => !v)}>{show ? <EyeOff size={16}/> : <Eye size={16}/>}</button></span></label>
    {error && <div className="modal-warning"><CircleAlert/>{error}</div>}
    <button className="submit-trade" disabled={busy || clientId.length < 4 || accessToken.length < 20} onClick={connect}>{busy ? 'Checking with Dhan…' : 'Connect read-only'}</button>
    <p className="broker-foot">No buy, sell, modify or cancel-order API is available in TradeMate. Token expires every 24 hours.</p>
  </div></div>;
}

function PositionBar({positions, stocks, openPositions, buy, sell}: {positions: Position[]; stocks: Stock[]; openPositions: () => void; buy: () => void; sell: () => void}) {
  const {pnl, invested} = bookSummary(positions, stocks);
  return <div className="pos-bar">
    <button className="pos-summary" onClick={openPositions}><BriefcaseBusiness size={14}/><span>Positions</span><b>{positions.length}</b><em className={pnl >= 0 ? 'positive' : 'negative'}>{money(pnl)}</em></button>
    <div className="pos-track">
      {positions.length === 0 ? <span className="pos-empty">No paper positions · P&L {money(0)}</span> : positions.map((p, i) => {
        const m = markPosition(p, stocks);
        return <button className="pos-chip" key={i} onClick={openPositions}><b>{m.label}</b><span>{p.side}</span><em className={m.pnl >= 0 ? 'positive' : 'negative'}>{money(m.pnl)}</em></button>;
      })}
    </div>
    <div className="pos-actions"><button className="buy-mini" onClick={buy}>Buy</button><button className="sell-mini" onClick={sell}>Sell</button></div>
    <small className="pos-invested">Invested {money(invested)}</small>
  </div>;
}

function Ticker({stocks, live}: {stocks: Stock[]; live: boolean}) {
  if (!stocks.length) return null;
  return <div className="ticker"><div className="ticker-label"><Activity/> {live ? 'LIVE TAPE' : 'DEMO TAPE'}</div><div className="ticker-track">{[...stocks, ...stocks].map((s, i) => <div className="ticker-item" key={s.symbol + i}><b>{s.symbol}</b><span>{money(s.price)}</span><Change n={s.change}/></div>)}</div></div>;
}

function AIAssistant({close, stocks, paper}: {close: () => void; stocks: Stock[]; paper: (s: Stock, side: 'BUY' | 'SELL') => void}) {
  const pack = ideasFor(stocks);
  const intro = 'Educational paper ideas only — NOT FINANCIAL ADVICE. Ask for NIFTY 24800 CE BUY ABOVE style index-option setups, or cash BUY/SELL labels from the scanner.';
  const [q, setQ] = useState('');
  const [messages, setMessages] = useState<{role: 'ai' | 'user'; text: string}[]>([{role: 'ai', text: intro}]);
  const ask = (text: string) => {
    if (!text.trim()) return;
    const lower = text.toLowerCase();
    let answer: string;
    if (lower.includes('nifty') || lower.includes('banknifty') || lower.includes('sensex') || (lower.includes('option') && lower.includes('index'))) {
      answer = 'Index option cards on Dashboard use the format NIFTY 24800 CE BUY ABOVE 198. Premium, SL and target are DEMO (no live option chain). Spot is LIVE only if Dhan index quotes work, otherwise DEMO. Paper buy only — not a Dhan order. EDUCATIONAL / SIMULATED — NOT FINANCIAL ADVICE.';
    } else if (lower.includes('recommend') || lower.includes('idea') || lower.includes('buy') || lower.includes('sell')) {
      const lines = [...pack.buys.map(b => `PAPER BUY ${b.symbol}: ${b.reason}`), ...pack.sells.map(b => `PAPER SELL ${b.symbol}: ${b.reason}`)];
      answer = (lines.length ? lines.join(' ') : 'No 2–7% momentum-breakout cash setup. Use Index options BUY ABOVE cards for NIFTY/BANKNIFTY paper ideas.') + ' EDUCATIONAL / SIMULATED — NOT FINANCIAL ADVICE.';
    } else if (lower.includes('option')) {
      answer = 'Stock and index option tickets are paper-only. Format: NIFTY 24800 CE BUY ABOVE 185, SL 157, TGT 240. Premiums are DEMO. Place real orders in official Dhan yourself.';
    } else if (lower.includes('auto')) {
      answer = 'Auto Trade is paper cash only. It never sends index-option or Dhan orders.';
    } else if (lower.includes('dhan') || lower.includes('connect')) {
      answer = 'Generate a 24-hour Access Token on web.dhan.co under My Profile → Access DhanHQ APIs.';
    } else {
      answer = 'I only give educational paper BUY ABOVE / BUY / SELL labels. Not financial advice. No live broker orders.';
    }
    setMessages(v => [...v, {role: 'user', text}, {role: 'ai', text: answer}]);
    setQ('');
  };
  return <div className="ai-drawer">
    <div className="ai-head"><div><Bot/><span><b>TradeMate AI</b><small>Educational assistant</small></span></div><button onClick={close}><X/></button></div>
    <div className="ai-safety"><ShieldCheck/> Informational only — not financial advice</div>
    <div className="ai-messages">{messages.map((m, i) => <div key={i} className={`ai-msg ${m.role}`}>{m.text}</div>)}</div>
    <div className="ai-ideas">{[...pack.buys, ...pack.sells].slice(0, 4).map(r => {
      const s = stocks.find(x => x.symbol === r.symbol);
      return s ? <button key={r.symbol + r.action} onClick={() => paper(s, r.action === 'PAPER SELL' ? 'SELL' : 'BUY')}>{r.action} {r.symbol}</button> : null;
    })}</div>
    <div className="ai-prompts"><button onClick={() => ask('NIFTY 24800 CE BUY ABOVE')}>NIFTY BUY ABOVE</button><button onClick={() => ask('Give buy sell recommendations')}>Cash ideas</button><button onClick={() => ask('Explain options')}>Options</button></div>
    <form className="ai-input" onSubmit={e => { e.preventDefault(); ask(q); }}><input value={q} onChange={e => setQ(e.target.value)} placeholder="Ask NIFTY 24800 CE BUY ABOVE…"/><button><Send/></button></form>
    <p className="ai-foot">AI-generated analysis is informational and not a guarantee of future performance.</p>
  </div>;
}

function AutoTradePage({stocks, positions, feedMode, marketStatus, autoOn, setAutoOn, indexAutoOn, setIndexAutoOn, autoLog, setAutoLog, setPositions, ping, indexSpots, openIndex}: {
  stocks: Stock[]; positions: Position[]; feedMode: FeedMode; marketStatus: string;
  autoOn: boolean; setAutoOn: (v: boolean) => void; indexAutoOn: boolean; setIndexAutoOn: (v: boolean) => void;
  autoLog: AutoEvent[];
  setAutoLog: (v: AutoEvent[] | ((x: AutoEvent[]) => AutoEvent[])) => void;
  setPositions: (v: Position[] | ((x: Position[]) => Position[])) => void; ping: (t: string) => void;
  indexSpots: ReturnType<typeof resolveIndexSpots>; openIndex: (s: OptionSetup) => void;
}) {
  const r = DEFAULT_AUTO_RULES;
  const autoBook = positions.filter(p => p.source === 'auto' && p.product !== 'OPTION');
  const optBook = positions.filter(p => p.source === 'auto' && p.product === 'OPTION');
  const breaks = indexBreakouts(indexSpots);
  const candidates = stocks.map(s => ({stock: s, gate: evaluateEntry(toSnapshot(s), r)})).filter(x => x.gate.ok).sort((a, b) => b.stock.momentum - a.stock.momentum);
  const blocked = feedMode === 'UNAVAILABLE' || (feedMode === 'LIVE' && marketStatus !== 'OPEN');
  const toggle = () => {
    const next = !autoOn;
    setAutoOn(next);
    const event: AutoEvent = {t: new Date().toLocaleTimeString('en-IN', {timeZone: 'Asia/Kolkata', hour12: false}), kind: 'info', text: next ? 'Paper auto armed' : 'Paper auto stopped'};
    setAutoLog(log => [event, ...log].slice(0, 40));
    ping(next ? 'Paper auto ON — no broker orders' : 'Paper auto OFF');
  };
  return <>
    <PageTitle title="Auto Trade" subtitle="Paper simulation only · never sends orders to Dhan or NSE"/>
    <div className="auto-hero">
      <div>
        <span className="simulation">PAPER AUTO · SIMULATION ONLY</span>
        <h2>{r.name}</h2>
        <p>Long-only educational cash bot. EDUCATIONAL / SIMULATED — NOT FINANCIAL ADVICE</p>
      </div>
      <button className={`auto-switch ${autoOn ? 'on' : ''}`} onClick={toggle} disabled={feedMode === 'UNAVAILABLE'}>
        {autoOn ? <Pause size={18}/> : <PlayCircle size={18}/>}
        {autoOn ? 'Stop cash auto' : 'Start cash auto'}
      </button>
    </div>
    <div className="auto-hero">
      <div>
        <span className="simulation">INDEX OPTION AUTO · PAPER ONLY</span>
        <h2>{INDEX_OPTION_AUTO.name}</h2>
        <p>Scans NIFTY / BANKNIFTY / SENSEX. CE if index ≥ +0.35% near strike, PE if ≤ −0.35%. Paper BUY ABOVE, max {INDEX_OPTION_AUTO.maxPositions}. DEMO premium. No Dhan orders.</p>
      </div>
      <button className={`auto-switch ${indexAutoOn ? 'on' : ''}`} onClick={() => { const next = !indexAutoOn; setIndexAutoOn(next); ping(next ? 'Index option paper auto ON' : 'Index option auto OFF'); }}>
        {indexAutoOn ? 'Stop option auto' : 'Start option auto'}
      </button>
    </div>
    <IndexOptionBoard spots={indexSpots} stocks={stocks} openIndex={openIndex} indexAutoOn={indexAutoOn} setIndexAutoOn={setIndexAutoOn}/>
    {blocked && <div className="modal-warning" style={{marginBottom: 14}}><CircleAlert/>{feedMode === 'UNAVAILABLE' ? 'LIVE DATA UNAVAILABLE — auto entries are paused.' : 'Market is not open. Paper auto will not open new live-session entries.'}</div>}
    <div className="paper-summary">
      <div><span>Engine</span><b>{autoOn ? 'Armed' : 'Off'}</b><small>Local paper fills only</small></div>
      <div><span>Cash auto</span><b>{autoBook.length}/{r.maxPositions}</b><small>Equity longs</small></div>
      <div><span>Index option auto</span><b>{optBook.length}/{INDEX_OPTION_AUTO.maxPositions}</b><small>{breaks.length} breakouts</small></div>
      <div><span>Risk / reward</span><b>1 : {(r.targetPercent / r.stopPercent).toFixed(1)}</b><small>{r.stopPercent}% SL · {r.targetPercent}% TG</small></div>
    </div>
    <div className="dash-grid">
      <div className="panel">
        <div className="panel-head"><div><h2>Default rule card</h2><p>Transparent gates</p></div></div>
        <div className="rule"><span>Session change</span><b>{r.minChangePercent}% to {r.maxChangePercent}%</b></div>
        <div className="rule"><span>Momentum</span><b>≥ {r.minMomentum}</b></div>
        <div className="rule"><span>Stop / target</span><b>{r.stopPercent}% / {r.targetPercent}%</b></div>
        <div className="disclaimer">Auto Trade cannot place Dhan orders.</div>
      </div>
      <div className="panel">
        <div className="panel-head"><div><h2>Rule matches</h2></div><span className="demo-tag">{feedMode === 'LIVE' ? 'LIVE' : 'DEMO'}</span></div>
        {candidates.length === 0 ? <div className="empty"><Gauge/><h3>No setup yet</h3></div> : <div className="trade-picker">{candidates.slice(0, 6).map(({stock: s}) => <button key={s.symbol} type="button"><span><b>{s.symbol}</b><small>Mom {s.momentum}</small></span><span><b>{money(s.price)}</b><Change n={s.change}/></span></button>)}</div>}
      </div>
    </div>
    <div className="panel" style={{marginTop: 14}}>
      <div className="panel-head"><div><h2>Auto activity</h2></div><button onClick={() => setAutoLog([])}>Clear log</button></div>
      {autoLog.length === 0 ? <div className="empty"><Power/><h3>No auto events yet</h3></div> : <div className="alerts-list" style={{padding: 10}}>{autoLog.map((e, i) => <div className="alert-item" key={i}><div>{e.kind === 'entry' ? <PlayCircle/> : e.kind === 'exit' ? <Pause/> : <Activity/>}</div><span><b>{e.symbol || 'Engine'}</b><p>{e.text}</p></span><small>{e.t}</small></div>)}</div>}
    </div>
  </>;
}

function MobileNav({page, go, openMenu, openScan}: {page: Page; go: (p: Page) => void; openMenu: () => void; openScan: () => void}) {
  const scanOn = (SCAN_PAGES as string[]).includes(page);
  return <nav className="mobile-nav" aria-label="Mobile">
    <button className={page === 'Dashboard' ? 'active' : ''} onClick={() => go('Dashboard')}><LayoutDashboard/><span>Home</span></button>
    <button className={scanOn ? 'active' : ''} onClick={openScan}><Flame/><span>Scan</span></button>
    <button className={page === 'Paper Trade' ? 'active' : ''} onClick={() => go('Paper Trade')}><WalletCards/><span>Trade</span></button>
    <button className={page === 'Positions' ? 'active' : ''} onClick={() => go('Positions')}><BriefcaseBusiness/><span>P&amp;L</span></button>
    <button onClick={openMenu}><Menu/><span>More</span></button>
  </nav>;
}

function ScanSheet({page, go, close}: {page: Page; go: (p: Page) => void; close: () => void}) {
  return <div className="sheet-wrap" onClick={close}>
    <div className="sheet" onClick={e => e.stopPropagation()}>
      <div className="sheet-head"><h3>Scanners</h3><button onClick={close} aria-label="Close"><X/></button></div>
      <p className="sheet-note">Cash + index options + stock options · EDUCATIONAL / SIMULATED — NOT FINANCIAL ADVICE</p>
      <div className="sheet-list">{SCAN_HUB.map(item => <button key={item.id} className={page === item.id ? 'on' : ''} onClick={() => go(item.id)}><b>{item.id}</b><span>{item.hint}</span></button>)}</div>
    </div>
  </div>;
}
