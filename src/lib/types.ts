export type Exchange = 'NSE' | 'BSE' | 'MCX';
export type InstrumentType = 'INDEX' | 'STOCK' | 'ETF' | 'MF' | 'FUTURE' | 'OPTION' | 'COMMODITY';
export type OptionType = 'CE' | 'PE';
export type DataStatus = 'MOCK' | 'DELAYED' | 'LIVE';
export type Direction = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface Instrument {
  symbol: string;
  name: string;
  exchange: Exchange;
  type: InstrumentType;
  sector?: string;
  lotSize?: number;
}

export interface Quote {
  symbol: string;
  ltp: number;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  vwap: number;
  change: number;
  changePct: number;
  timestamp: number;
  status: DataStatus;
  ohlc?: number[];
}

export interface OptionRow {
  strike: number;
  ceLtp: number;
  ceOi: number;
  ceChgOi: number;
  ceVolume: number;
  ceIv: number;
  ceDelta: number;
  ceGamma: number;
  ceTheta: number;
  ceVega: number;
  peLtp: number;
  peOi: number;
  peChgOi: number;
  peVolume: number;
  peIv: number;
  peDelta: number;
  peGamma: number;
  peTheta: number;
  peVega: number;
}

export interface OptionsChain {
  symbol: string;
  expiry: string;
  spot: number;
  atmStrike: number;
  rows: OptionRow[];
  timestamp: number;
  status: DataStatus;
}

export interface Position {
  id: string;
  symbol: string;
  exchange: Exchange;
  type: InstrumentType;
  quantity: number;
  buyPrice: number;
  currentPrice: number;
  avgPrice: number;
  entryDate: string;
  stopLoss?: number;
  target?: number;
  positionSize: number;
  brokerage: number;
  realizedPnl: number;
  optionType?: OptionType;
  strike?: number;
  expiry?: string;
  lotSize?: number;
  lots?: number;
}

export interface JournalEntry {
  id: string;
  date: string;
  instrument: string;
  direction: Direction;
  entry: number;
  exit: number;
  quantity: number;
  stopLoss?: number;
  target?: number;
  strategy?: string;
  reason?: string;
  emotionBefore?: string;
  emotionAfter?: string;
  result: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'OPEN';
  pnl: number;
  mistake?: string;
  screenshot?: string;
  notes?: string;
}

export interface Watchlist {
  id: string;
  name: string;
  symbols: string[];
}

export interface Alert {
  id: string;
  symbol: string;
  type: 'PRICE' | 'PCT' | 'SR_BREAK' | 'VOLUME' | 'OI_CHANGE' | 'RSI' | 'VWAP' | 'EMA_CROSS' | 'NEWS';
  condition: string;
  value?: number;
  active: boolean;
  triggered: boolean;
  createdAt: string;
}

export interface RiskLimits {
  maxRiskPerTradePct: number;
  maxDailyLossPct: number;
  maxWeeklyLossPct: number;
  maxOpenRiskPct: number;
  maxConcentrationPct: number;
  maxLeverage: number;
}

export interface TradeSetup {
  instrument: string;
  kind: 'FUTURES' | 'OPTIONS';
  optionType?: OptionType;
  strike?: number;
  expiry?: string;
  direction: Direction;
  entryZone: [number, number];
  stopLoss: number;
  target1: number;
  target2: number;
  riskReward: number;
  quantity: number;
  lots: number;
  maxRisk: number;
  potentialProfit: number;
  score: number;
  confidence: number;
  reasons: string[];
  invalidation: string;
}

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  timestamp: number;
  category: string;
  symbols: string[];
  summary: string;
  impact: Direction;
  url?: string;
}

export interface ScannerFilters {
  minRiskReward: number;
  maxRiskPct: number;
  minLiquidity: number;
  avoidHighVolatility: boolean;
  trendAlignment: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}
