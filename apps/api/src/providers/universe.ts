/**
 * Identifier-only NSE equity map for DhanHQ (securityId is not a price).
 * Quotes are fetched live; missing instruments are omitted, never invented.
 */
export type ListedStock = {
  symbol: string;
  name: string;
  sector: string;
  securityId: number;
  segment: 'NSE_EQ';
};

export const NSE_EQUITY_UNIVERSE: ListedStock[] = [
  {symbol: 'RELIANCE', name: 'Reliance Industries', sector: 'Energy', securityId: 2885, segment: 'NSE_EQ'},
  {symbol: 'TCS', name: 'Tata Consultancy Services', sector: 'Technology', securityId: 11536, segment: 'NSE_EQ'},
  {symbol: 'HDFCBANK', name: 'HDFC Bank', sector: 'Financials', securityId: 1333, segment: 'NSE_EQ'},
  {symbol: 'INFY', name: 'Infosys', sector: 'Technology', securityId: 1594, segment: 'NSE_EQ'},
  {symbol: 'ICICIBANK', name: 'ICICI Bank', sector: 'Financials', securityId: 4963, segment: 'NSE_EQ'},
  {symbol: 'HINDUNILVR', name: 'Hindustan Unilever', sector: 'FMCG', securityId: 1394, segment: 'NSE_EQ'},
  {symbol: 'ITC', name: 'ITC', sector: 'FMCG', securityId: 1660, segment: 'NSE_EQ'},
  {symbol: 'SBIN', name: 'State Bank of India', sector: 'Financials', securityId: 3045, segment: 'NSE_EQ'},
  {symbol: 'BHARTIARTL', name: 'Bharti Airtel', sector: 'Telecom', securityId: 10604, segment: 'NSE_EQ'},
  {symbol: 'BAJFINANCE', name: 'Bajaj Finance', sector: 'Financials', securityId: 317, segment: 'NSE_EQ'},
  {symbol: 'KOTAKBANK', name: 'Kotak Mahindra Bank', sector: 'Financials', securityId: 1922, segment: 'NSE_EQ'},
  {symbol: 'LT', name: 'Larsen & Toubro', sector: 'Industrials', securityId: 11483, segment: 'NSE_EQ'},
  {symbol: 'AXISBANK', name: 'Axis Bank', sector: 'Financials', securityId: 5900, segment: 'NSE_EQ'},
  {symbol: 'ASIANPAINT', name: 'Asian Paints', sector: 'Materials', securityId: 236, segment: 'NSE_EQ'},
  {symbol: 'MARUTI', name: 'Maruti Suzuki India', sector: 'Automobile', securityId: 10999, segment: 'NSE_EQ'},
  {symbol: 'SUNPHARMA', name: 'Sun Pharmaceutical', sector: 'Healthcare', securityId: 3351, segment: 'NSE_EQ'},
  {symbol: 'TITAN', name: 'Titan Company', sector: 'Consumer', securityId: 3506, segment: 'NSE_EQ'},
  {symbol: 'WIPRO', name: 'Wipro', sector: 'Technology', securityId: 3787, segment: 'NSE_EQ'},
  {symbol: 'ULTRACEMCO', name: 'UltraTech Cement', sector: 'Materials', securityId: 11532, segment: 'NSE_EQ'},
  {symbol: 'HCLTECH', name: 'HCL Technologies', sector: 'Technology', securityId: 7229, segment: 'NSE_EQ'},
  {symbol: 'NTPC', name: 'NTPC', sector: 'Energy', securityId: 11630, segment: 'NSE_EQ'},
  {symbol: 'POWERGRID', name: 'Power Grid Corporation', sector: 'Energy', securityId: 14977, segment: 'NSE_EQ'},
  {symbol: 'ONGC', name: 'Oil & Natural Gas Corp', sector: 'Energy', securityId: 2475, segment: 'NSE_EQ'},
  {symbol: 'TATAMOTORS', name: 'Tata Motors', sector: 'Automobile', securityId: 3456, segment: 'NSE_EQ'},
  {symbol: 'TATASTEEL', name: 'Tata Steel', sector: 'Materials', securityId: 3499, segment: 'NSE_EQ'},
  {symbol: 'JSWSTEEL', name: 'JSW Steel', sector: 'Materials', securityId: 11723, segment: 'NSE_EQ'},
  {symbol: 'ADANIENT', name: 'Adani Enterprises', sector: 'Conglomerate', securityId: 25, segment: 'NSE_EQ'},
  {symbol: 'ADANIPORTS', name: 'Adani Ports', sector: 'Infrastructure', securityId: 15083, segment: 'NSE_EQ'},
  {symbol: 'COALINDIA', name: 'Coal India', sector: 'Energy', securityId: 20374, segment: 'NSE_EQ'},
  {symbol: 'M&M', name: 'Mahindra & Mahindra', sector: 'Automobile', securityId: 2031, segment: 'NSE_EQ'},
  {symbol: 'TECHM', name: 'Tech Mahindra', sector: 'Technology', securityId: 13538, segment: 'NSE_EQ'},
  {symbol: 'CIPLA', name: 'Cipla', sector: 'Healthcare', securityId: 694, segment: 'NSE_EQ'},
  {symbol: 'DRREDDY', name: "Dr. Reddy's Laboratories", sector: 'Healthcare', securityId: 881, segment: 'NSE_EQ'},
  {symbol: 'EICHERMOT', name: 'Eicher Motors', sector: 'Automobile', securityId: 910, segment: 'NSE_EQ'},
  {symbol: 'GRASIM', name: 'Grasim Industries', sector: 'Materials', securityId: 1232, segment: 'NSE_EQ'},
  {symbol: 'HINDALCO', name: 'Hindalco Industries', sector: 'Materials', securityId: 1363, segment: 'NSE_EQ'},
  {symbol: 'INDUSINDBK', name: 'IndusInd Bank', sector: 'Financials', securityId: 5258, segment: 'NSE_EQ'},
  {symbol: 'DIVISLAB', name: "Divi's Laboratories", sector: 'Healthcare', securityId: 10940, segment: 'NSE_EQ'},
  {symbol: 'BPCL', name: 'Bharat Petroleum', sector: 'Energy', securityId: 526, segment: 'NSE_EQ'},
  {symbol: 'HEROMOTOCO', name: 'Hero MotoCorp', sector: 'Automobile', securityId: 1348, segment: 'NSE_EQ'},
  {symbol: 'BRITANNIA', name: 'Britannia Industries', sector: 'FMCG', securityId: 547, segment: 'NSE_EQ'},
  {symbol: 'APOLLOHOSP', name: 'Apollo Hospitals', sector: 'Healthcare', securityId: 157, segment: 'NSE_EQ'},
  {symbol: 'TATACONSUM', name: 'Tata Consumer Products', sector: 'FMCG', securityId: 3432, segment: 'NSE_EQ'}
];

export const INDEX_UNIVERSE = [
  {symbol: 'NIFTY 50', securityId: 13, segment: 'NSE_IDX' as const},
  {symbol: 'NIFTY BANK', securityId: 25, segment: 'NSE_IDX' as const},
  {symbol: 'NIFTY 500', securityId: 17, segment: 'NSE_IDX' as const},
  {symbol: 'SENSEX', securityId: 51, segment: 'BSE_IDX' as const}
];

export const bySymbol = new Map(NSE_EQUITY_UNIVERSE.map(s => [s.symbol, s]));
export const bySecurityId = new Map(NSE_EQUITY_UNIVERSE.map(s => [String(s.securityId), s]));
