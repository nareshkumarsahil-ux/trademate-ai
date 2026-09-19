export type DataStatus = 'LIVE' | 'DELAYED' | 'STALE' | 'UNAVAILABLE' | 'DEMO';
export type Stock = {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  volume: string;
  relVol: number;
  momentum: number;
  high: number;
  low: number;
  open?: number;
  breakout: boolean;
  dataStatus?: DataStatus;
  source?: string;
  timestamp?: string;
};
// Deterministic development fixtures. They are never presented as live market data.
export const DEMO_STOCKS: Stock[] = [
  {symbol: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy', price: 2948.6, change: 2.84, volume: '8.4M', relVol: 1.8, momentum: 86, high: 2971.2, low: 2864.1, breakout: true},
  {symbol: 'TATAMOTORS', name: 'Tata Motors', sector: 'Automobile', price: 1017.4, change: 6.32, volume: '15.2M', relVol: 2.4, momentum: 92, high: 1024.8, low: 958.2, breakout: true},
  {symbol: 'HDFCBANK', name: 'HDFC Bank', sector: 'Financials', price: 1692.1, change: 1.46, volume: '6.1M', relVol: 1.1, momentum: 67, high: 1704.5, low: 1659.3, breakout: false},
  {symbol: 'INFY', name: 'Infosys', sector: 'Technology', price: 1864.9, change: 3.71, volume: '9.8M', relVol: 1.9, momentum: 83, high: 1879.0, low: 1790.5, breakout: true},
  {symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical', sector: 'Healthcare', price: 1748.2, change: -1.23, volume: '2.7M', relVol: .8, momentum: 41, high: 1782.2, low: 1732.4, breakout: false},
  {symbol: 'ICICIBANK', name: 'ICICI Bank', sector: 'Financials', price: 1251.3, change: 2.11, volume: '7.2M', relVol: 1.3, momentum: 72, high: 1260.5, low: 1218.9, breakout: false},
  {symbol: 'BHARTIARTL', name: 'Bharti Airtel', sector: 'Telecom', price: 1577.8, change: 5.24, volume: '10.3M', relVol: 2.1, momentum: 89, high: 1586.1, low: 1496.2, breakout: true},
  {symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'Technology', price: 4230.5, change: -.68, volume: '1.9M', relVol: .7, momentum: 48, high: 4288.0, low: 4201.1, breakout: false},
  {symbol: 'SBIN', name: 'State Bank of India', sector: 'Financials', price: 827.65, change: 10.42, volume: '38.6M', relVol: 3.8, momentum: 97, high: 831.9, low: 752.3, breakout: true},
  {symbol: 'MARUTI', name: 'Maruti Suzuki India', sector: 'Automobile', price: 12462, change: 2.56, volume: '984K', relVol: 1.5, momentum: 78, high: 12510, low: 12128, breakout: false}
];
export const spark = [42, 44, 43, 47, 46, 50, 49, 54, 56, 55, 60, 59, 64, 68, 67, 73, 76, 79, 78, 84];
export const DHAN_WEB = 'https://web.dhan.co';
