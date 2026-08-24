import type { Instrument, Quote, DataStatus, OptionsChain, OptionRow, NewsItem } from './types';

export const INSTRUMENTS: Instrument[] = [
  { symbol: 'NIFTY', name: 'Nifty 50 Index', exchange: 'NSE', type: 'INDEX', lotSize: 75 },
  { symbol: 'BANKNIFTY', name: 'Nifty Bank Index', exchange: 'NSE', type: 'INDEX', lotSize: 35 },
  { symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE', type: 'STOCK', sector: 'Energy', lotSize: 250 },
  { symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE', type: 'STOCK', sector: 'IT', lotSize: 175 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', exchange: 'NSE', type: 'STOCK', sector: 'Banking', lotSize: 300 },
  { symbol: 'INFY', name: 'Infosys', exchange: 'NSE', type: 'STOCK', sector: 'IT', lotSize: 300 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', exchange: 'NSE', type: 'STOCK', sector: 'Banking', lotSize: 350 },
  { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE', type: 'STOCK', sector: 'Banking', lotSize: 300 },
  { symbol: 'TATAMOTORS', name: 'Tata Motors', exchange: 'NSE', type: 'STOCK', sector: 'Auto', lotSize: 350 },
  { symbol: 'NIFTYBEES', name: 'Nifty BeES ETF', exchange: 'NSE', type: 'ETF' },
  { symbol: 'CRUDEOIL', name: 'MCX Crude Oil Futures', exchange: 'MCX', type: 'COMMODITY', lotSize: 100 },
  { symbol: 'NATGAS', name: 'MCX Natural Gas Futures', exchange: 'MCX', type: 'COMMODITY', lotSize: 1250 },
  { symbol: 'GOLD', name: 'MCX Gold Futures', exchange: 'MCX', type: 'COMMODITY', lotSize: 100 },
];

const SEED_PRICES: Record<string, number> = {
  NIFTY: 24850.5,
  BANKNIFTY: 54200.0,
  RELIANCE: 2945.8,
  TCS: 4180.5,
  HDFCBANK: 1685.2,
  INFY: 1845.75,
  ICICIBANK: 1240.6,
  SBIN: 825.4,
  TATAMOTORS: 985.3,
  NIFTYBEES: 248.5,
  CRUDEOIL: 6580.0,
  NATGAS: 285.4,
  GOLD: 71250.0,
};

const SEED_PREV_CLOSE: Record<string, number> = {
  NIFTY: 24720.3,
  BANKNIFTY: 53800.5,
  RELIANCE: 2920.4,
  TCS: 4150.2,
  HDFCBANK: 1672.8,
  INFY: 1838.2,
  ICICIBANK: 1232.1,
  SBIN: 818.6,
  TATAMOTORS: 972.5,
  NIFTYBEES: 247.1,
  CRUDEOIL: 6520.0,
  NATGAS: 278.2,
  GOLD: 70850.0,
};

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function genOhlc(base: number, seed: number, days = 60): number[] {
  const rng = seededRandom(seed);
  const closes: number[] = [];
  let price = base * 0.92;
  for (let i = 0; i < days; i++) {
    const drift = (rng() - 0.48) * 0.025;
    price = price * (1 + drift);
    closes.push(price);
  }
  closes[closes.length - 1] = base;
  return closes;
}

const ohlcCache: Record<string, number[]> = {};

export function getOhlc(symbol: string): number[] {
  if (!ohlcCache[symbol]) {
    const base = SEED_PRICES[symbol] ?? 1000;
    const seed = symbol.split('').reduce((a, c) => a + c.charCodeAt(0), 0) * 7;
    ohlcCache[symbol] = genOhlc(base, seed);
  }
  return ohlcCache[symbol];
}

export function getQuote(symbol: string): Quote {
  const ltp = SEED_PRICES[symbol] ?? 0;
  const prevClose = SEED_PREV_CLOSE[symbol] ?? ltp;
  const change = ltp - prevClose;
  const changePct = (change / prevClose) * 100;
  const rng = seededRandom(symbol.length + Math.floor(Date.now() / 60000));
  const open = prevClose * (1 + (rng() - 0.5) * 0.005);
  const high = Math.max(ltp, open) * (1 + rng() * 0.008);
  const low = Math.min(ltp, open) * (1 - rng() * 0.008);
  const volume = Math.floor(rng() * 50000000) + 1000000;
  const vwap = (high + low + ltp) / 3;
  return {
    symbol,
    ltp,
    prevClose,
    open: Math.round(open * 100) / 100,
    high: Math.round(high * 100) / 100,
    low: Math.round(low * 100) / 100,
    volume,
    vwap: Math.round(vwap * 100) / 100,
    change: Math.round(change * 100) / 100,
    changePct: Math.round(changePct * 100) / 100,
    timestamp: Date.now(),
    status: 'MOCK' as DataStatus,
    ohlc: getOhlc(symbol),
  };
}

export function getAllQuotes(): Quote[] {
  return INSTRUMENTS.map((i) => getQuote(i.symbol));
}

export function getInstrument(symbol: string): Instrument | undefined {
  return INSTRUMENTS.find((i) => i.symbol === symbol);
}

export function getSectorMap(): Record<string, string> {
  const map: Record<string, string> = {};
  for (const inst of INSTRUMENTS) {
    map[inst.symbol] = inst.sector ?? inst.type;
  }
  return map;
}

function erf(x: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function normCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

function normPdf(x: number): number {
  return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
}

function bsDelta(spot: number, strike: number, t: number, sigma: number, isCall: boolean): number {
  const d1 = (Math.log(spot / strike) + (0.05 * t)) / (sigma * Math.sqrt(t));
  return isCall ? normCdf(d1) : normCdf(d1) - 1;
}

function bsGamma(spot: number, strike: number, t: number, sigma: number): number {
  const d1 = (Math.log(spot / strike) + (0.05 * t)) / (sigma * Math.sqrt(t));
  return normPdf(d1) / (spot * sigma * Math.sqrt(t));
}

function bsTheta(spot: number, strike: number, t: number, sigma: number, isCall: boolean): number {
  const d1 = (Math.log(spot / strike) + (0.05 * t)) / (sigma * Math.sqrt(t));
  const d2 = d1 - sigma * Math.sqrt(t);
  const term = -(spot * normPdf(d1) * sigma) / (2 * Math.sqrt(t));
  return isCall ? term - (strike * 0.05 * Math.exp(-0.05 * t) * normCdf(d2)) : term + (strike * 0.05 * Math.exp(-0.05 * t) * normCdf(-d2));
}

function bsVega(spot: number, strike: number, t: number, sigma: number): number {
  const d1 = (Math.log(spot / strike) + (0.05 * t)) / (sigma * Math.sqrt(t));
  return (spot * normPdf(d1) * Math.sqrt(t)) / 100;
}

function bsPrice(spot: number, strike: number, t: number, sigma: number, isCall: boolean): number {
  const d1 = (Math.log(spot / strike) + (0.05 * t)) / (sigma * Math.sqrt(t));
  const d2 = d1 - sigma * Math.sqrt(t);
  if (isCall) return spot * normCdf(d1) - strike * Math.exp(-0.05 * t) * normCdf(d2);
  return strike * Math.exp(-0.05 * t) * normCdf(-d2) - spot * normCdf(-d1);
}

export function getOptionsChain(symbol: string, expiry: string): OptionsChain {
  const spot = SEED_PRICES[symbol] ?? 1000;
  const rng = seededRandom(symbol.length + expiry.length);
  const step = symbol === 'NIFTY' ? 50 : symbol === 'BANKNIFTY' ? 100 : Math.max(10, Math.round(spot * 0.01));
  const atm = Math.round(spot / step) * step;
  const strikes: number[] = [];
  for (let i = -10; i <= 10; i++) strikes.push(atm + i * step);
  const t = 0.03;
  const rows: OptionRow[] = strikes.map((strike) => {
    const moneyness = Math.abs(spot - strike) / spot;
    const iv = 0.12 + moneyness * 0.4 + rng() * 0.03;
    const cePrice = Math.max(bsPrice(spot, strike, t, iv, true), 0.05);
    const pePrice = Math.max(bsPrice(spot, strike, t, iv, false), 0.05);
    const ceDelta = bsDelta(spot, strike, t, iv, true);
    const peDelta = bsDelta(spot, strike, t, iv, false);
    const gamma = bsGamma(spot, strike, t, iv);
    const ceTheta = bsTheta(spot, strike, t, iv, true);
    const peTheta = bsTheta(spot, strike, t, iv, false);
    const vega = bsVega(spot, strike, t, iv);
    const baseOi = Math.floor(rng() * 500000) + 50000;
    const ceOi = strike <= atm ? baseOi * 1.5 : baseOi * 0.6;
    const peOi = strike >= atm ? baseOi * 1.5 : baseOi * 0.6;
    return {
      strike,
      ceLtp: Math.round(cePrice * 100) / 100,
      ceOi: Math.round(ceOi),
      ceChgOi: Math.round((rng() - 0.4) * 50000),
      ceVolume: Math.floor(rng() * 200000) + 10000,
      ceIv: Math.round(iv * 10000) / 100,
      ceDelta: Math.round(ceDelta * 100) / 100,
      ceGamma: Math.round(gamma * 10000) / 10000,
      ceTheta: Math.round(ceTheta * 100) / 100,
      ceVega: Math.round(vega * 100) / 100,
      peLtp: Math.round(pePrice * 100) / 100,
      peOi: Math.round(peOi),
      peChgOi: Math.round((rng() - 0.4) * 50000),
      peVolume: Math.floor(rng() * 200000) + 10000,
      peIv: Math.round(iv * 10000) / 100,
      peDelta: Math.round(peDelta * 100) / 100,
      peGamma: Math.round(gamma * 10000) / 10000,
      peTheta: Math.round(peTheta * 100) / 100,
      peVega: Math.round(vega * 100) / 100,
    };
  });
  return { symbol, expiry, spot, atmStrike: atm, rows, timestamp: Date.now(), status: 'MOCK' };
}

export function getExpiries(_symbol: string): string[] {
  const today = new Date();
  const expiries: string[] = [];
  for (let i = 1; i <= 4; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() + i * 7);
    expiries.push(d.toISOString().slice(0, 10));
  }
  return expiries;
}

export const SEED_NEWS: NewsItem[] = [
  { id: 'n1', headline: 'Reliance Industries Q2 net profit beats estimates, up 18% YoY', source: 'MOCK — Economic Times', timestamp: Date.now() - 3600000, category: 'Earnings', symbols: ['RELIANCE'], summary: 'Reliance reported strong Q2 results with retail and telecom segments driving growth. Jio subscriber additions hit a record. Analysts view this positively for the stock.', impact: 'BULLISH' },
  { id: 'n2', headline: 'RBI holds repo rate at 6.5%, maintains accommodative stance', source: 'MOCK — Reuters', timestamp: Date.now() - 7200000, category: 'RBI', symbols: ['NIFTY', 'BANKNIFTY', 'HDFCBANK', 'ICICIBANK', 'SBIN'], summary: 'The RBI kept rates unchanged as expected. The central bank signaled potential easing in the next quarter if inflation continues to moderate. Positive for rate-sensitive sectors like banking.', impact: 'BULLISH' },
  { id: 'n3', headline: 'Crude oil prices rise on OPEC+ supply cut extension', source: 'MOCK — Bloomberg', timestamp: Date.now() - 10800000, category: 'Commodity', symbols: ['CRUDEOIL'], summary: 'OPEC+ extended voluntary production cuts, pushing Brent above $82. This impacts MCX crude oil futures positively and may affect oil-importing sectors like aviation and paints.', impact: 'BULLISH' },
  { id: 'n4', headline: 'Fed signals fewer rate cuts in 2025, dollar strengthens', source: 'MOCK — WSJ', timestamp: Date.now() - 14400000, category: 'Fed', symbols: ['NIFTY', 'BANKNIFTY'], summary: 'The Fed dot plot indicated only two cuts in 2025 vs three previously expected. A stronger dollar may lead to FII outflows from emerging markets including India. Slightly negative sentiment.', impact: 'BEARISH' },
  { id: 'n5', headline: 'TCS wins $2.5B multi-year cloud transformation deal', source: 'MOCK — Mint', timestamp: Date.now() - 18000000, category: 'Company', symbols: ['TCS', 'INFY'], summary: 'TCS announced a major deal with a European retailer. This strengthens the order book and is positive for IT sector sentiment. INFY may see sympathy flows.', impact: 'BULLISH' },
  { id: 'n6', headline: 'Natural gas inventories build more than expected', source: 'MOCK — Reuters', timestamp: Date.now() - 21600000, category: 'Commodity', symbols: ['NATGAS'], summary: 'US natural gas storage rose 90 Bcf vs 75 Bcf expected. This oversupply puts pressure on natural gas prices both globally and on MCX.', impact: 'BEARISH' },
  { id: 'n7', headline: 'India VIX cools to 13.2, lowest in a month', source: 'MOCK — NSE', timestamp: Date.now() - 25200000, category: 'Market', symbols: ['NIFTY', 'BANKNIFTY'], summary: 'Volatility index dropped, indicating reduced fear in the market. Low VIX typically supports a gradual uptrend but reduces option premium values for option sellers.', impact: 'NEUTRAL' },
  { id: 'n8', headline: 'FII net buyers after 8 sessions of selling', source: 'MOCK — Moneycontrol', timestamp: Date.now() - 28800000, category: 'Flows', symbols: ['NIFTY', 'BANKNIFTY'], summary: 'Foreign institutional investors turned net buyers of Indian equities, purchasing ₹2,340 crore. This reversal could support the market after recent consolidation.', impact: 'BULLISH' },
];

export function getNews(symbols?: string[]): NewsItem[] {
  if (!symbols || symbols.length === 0) return SEED_NEWS;
  return SEED_NEWS.filter((n) => n.symbols.some((s) => symbols.includes(s)));
}

export function getDataStatus(): DataStatus {
  return 'MOCK';
}
