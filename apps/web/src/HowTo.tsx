import {useEffect, useState} from 'react';
import {Download, LayoutDashboard, Monitor, ShieldCheck, Smartphone, Star, WalletCards, X, Zap} from 'lucide-react';

type InstallEvent = Event & {prompt: () => Promise<void>; userChoice?: Promise<{outcome: string}>};

export function usePwaInstall() {
  const [evt, setEvt] = useState<InstallEvent | null>(null);
  const [standalone, setStandalone] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(display-mode: standalone)');
    const nav = window.navigator as Navigator & {standalone?: boolean};
    const sync = () => setStandalone(media.matches || nav.standalone === true);
    sync();
    media.addEventListener?.('change', sync);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => {
      media.removeEventListener?.('change', sync);
      window.removeEventListener('beforeinstallprompt', onPrompt);
    };
  }, []);
  const install = async () => {
    if (!evt) return false;
    await evt.prompt();
    setEvt(null);
    return true;
  };
  return {canInstall: !!evt && !standalone, installed: standalone, install};
}

export function HowToModal({onClose, canInstall, onInstall, installed}: {
  onClose: () => void;
  canInstall?: boolean;
  onInstall?: () => void;
  installed?: boolean;
}) {
  return <div className="modal-wrap" onClick={onClose}>
    <div className="modal howto-modal" onClick={e => e.stopPropagation()}>
      <div className="modal-head">
        <div>
          <span className="simulation">COMPUTER + MOBILE · SAME APP</span>
          <h2>Kaise use karein</h2>
          <p>Ek hi TradeMate — laptop pe full desk, phone pe app jaisa</p>
        </div>
        <button onClick={onClose} aria-label="Close"><X/></button>
      </div>
      <div className="howto-grid">
        <section className="howto-card">
          <div className="howto-icon"><Monitor/></div>
          <h3>Computer / laptop</h3>
          <ol>
            <li>Chrome ya Edge mein yeh URL kholo.</li>
            <li>Left sidebar se Dashboard, scanners, Paper Trade.</li>
            <li>Search box mein symbol type karo — shortcut <kbd>Ctrl</kbd>+<kbd>K</kbd>.</li>
            <li>Tables click = stock detail. <b>Paper trade</b> = simulation only.</li>
            <li>Settings → Connect DhanHQ (read-only quotes).</li>
            {installed ? <li>App already installed hai — desktop icon se kholo.</li> : <li>Chrome address bar ke install icon se “Install TradeMate” — alag window, bookmark nahi.</li>}
          </ol>
        </section>
        <section className="howto-card">
          <div className="howto-icon"><Smartphone/></div>
          <h3>Mobile / tablet</h3>
          <ol>
            <li>Phone browser mein wahi URL kholo (Chrome Android / Safari iPhone).</li>
            <li>Neeche 5 buttons: <b>Home · Scan · Trade · P&amp;L · More</b>.</li>
            <li><b>Scan</b> = 2% / 5% / 10% movers, gainers, momentum, breakouts.</li>
            <li><b>More</b> = poori menu (Auto Trade, Watchlist, Alerts, Settings).</li>
            <li>Upar search icon se symbol dhoondo. Option lists cards ban jaati hain.</li>
            <li>Android Chrome: menu → <b>Add to Home screen</b> / Install app. iPhone Safari: Share → <b>Add to Home Screen</b>.</li>
            <li>Vercel URL (your-app.vercel.app) phone browser mein kholo — alag server nahi chahiye.</li>
          </ol>
        </section>
      </div>
      <div className="howto-steps">
        <div><LayoutDashboard/><span>1. Scanner dekho</span></div>
        <div><Zap/><span>2. Breakout / BUY ABOVE card</span></div>
        <div><WalletCards/><span>3. Paper trade (simulation)</span></div>
        <div><Star/><span>4. Real order sirf Dhan app mein</span></div>
      </div>
      <div className="broker-safety">
        <ShieldCheck/>
        <div>
          <b>Paper + live data only · no real orders</b>
          <span>TradeMate Dhan pe buy/sell nahi bhejta. Live quotes ke liye Settings se Dhan connect karo. Har signal EDUCATIONAL / SIMULATED — NOT FINANCIAL ADVICE hai.</span>
        </div>
      </div>
      <div className="howto-actions">
        {canInstall && <button className="submit-trade" onClick={onInstall}><Download size={16}/> Is device pe install karo</button>}
        <button className="secondary howto-done" onClick={onClose}>Samajh gaya — app kholo</button>
      </div>
    </div>
  </div>;
}

export const SCAN_HUB: {id: 'Dashboard' | 'NIFTY 500' | '2%+ Movers' | '5%+ Movers' | '10%+ Movers' | 'Top Gainers' | 'High Momentum' | 'Breakouts' | 'Watchlist' | 'Paper Trade' | 'Auto Trade' | 'Positions' | 'Alerts' | 'Settings'; hint: string}[] = [
  {id: '2%+ Movers', hint: 'Cash + index + stock options ≥ 2%'},
  {id: '5%+ Movers', hint: 'Cash + options ≥ 5%'},
  {id: '10%+ Movers', hint: 'Cash + options ≥ 10%'},
  {id: 'Top Gainers', hint: 'Sabse tez up-move'},
  {id: 'High Momentum', hint: 'Momentum 75+ cash & options'},
  {id: 'Breakouts', hint: 'Cash + CE/PE BUY ABOVE'},
  {id: 'NIFTY 500', hint: 'Poori cash universe'},
  {id: 'Auto Trade', hint: 'Paper auto rules'},
  {id: 'Watchlist', hint: 'Saved symbols'},
  {id: 'Alerts', hint: 'Rule matches'}
];

export const SCAN_PAGES = SCAN_HUB.map(s => s.id);
