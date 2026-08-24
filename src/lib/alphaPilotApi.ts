export const ALPHAPILOT_API_BASE = 'https://alphapilot-api-pnio.onrender.com';

export interface ManualGiftInput {
  ltp: number;
  change_pct: number;
  entered_at?: string;
}

export const MANUAL_GIFT_STORAGE_KEY = 'alphapilot.manualGift';
export const FNO_SCAN_EVENT = 'alphapilot:fno-scan';
export const MTF_SCAN_EVENT = 'alphapilot:mtf-scan';
export const API_ERROR_EVENT = 'alphapilot:api-error';

export function readStoredManualGift(): ManualGiftInput | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(MANUAL_GIFT_STORAGE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as ManualGiftInput;
    if (!Number.isFinite(value?.ltp) || value.ltp <= 0 || !Number.isFinite(value?.change_pct)) return null;
    if (!value.entered_at) return null;
    const ageMs = Date.now() - new Date(value.entered_at).getTime();
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 30 * 60 * 1000) {
      window.localStorage.removeItem(MANUAL_GIFT_STORAGE_KEY);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

export interface FnoScanResponse {
  provider: string;
  mode: string;
  symbol: string;
  expiry?: string | null;
  overall_alpha_score: number;
  technical_score: number;
  fno_score: number;
  market_score?: number;
  status: string;
  signal: string;
  technical: any;
  market_context?: any;
  external_context?: any;
  external_context_adjustment?: number;
  fno: any;
  oi_change?: any;
  warning?: string;
  _client_latency_ms?: number;
  _client_received_at?: string;
  [key: string]: any;
}

export interface MtfScanItem {
  symbol: string;
  status: string;
  signal: string;
  multi_timeframe_score?: number;
  direction?: string;
  entry?: number;
  stop_loss?: number;
  target1?: number;
  target2?: number;
  risk_reward?: number;
  reason?: string;
  timeframes?: Record<string, any>;
  [key: string]: any;
}

export interface MtfScanResponse {
  provider: string;
  mode: string;
  timeframes: string[];
  min_risk_reward: number;
  setups: MtfScanItem[];
  others: MtfScanItem[];
  _client_latency_ms?: number;
  _client_received_at?: string;
}

export interface MarketNewsItem {
  headline: string;
  source: string;
  published_at?: string | null;
  url?: string | null;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  preferred_source?: boolean;
  error?: string;
}

export interface MarketNewsResponse {
  provider: string;
  preferred_sources: string[];
  cache_ttl_seconds: number;
  generated_at: string;
  items: Record<string, MarketNewsItem[]>;
}

export type TradeNewsItem = MarketNewsItem;
export type TradeNewsResponse = MarketNewsResponse;

export interface BacktestTrade {
  symbol: string;
  timestamp: string;
  action: 'BUY CE' | 'BUY PE';
  direction: 'LONG' | 'SHORT';
  mtf_alpha: number;
  entry: number;
  stop_loss: number;
  target1: number;
  target2?: number;
  underlying_rr: number;
  outcome: string;
  exit_price: number;
  r_multiple: number;
}

export interface BacktestResponse {
  mode: string;
  start_date: string;
  end_date: string;
  min_risk_reward: number;
  entry_before?: string | null;
  summary: { trades: number; wins: number; losses: number; win_rate: number; total_r: number; average_r: number; max_drawdown_r: number };
  trades: BacktestTrade[];
  errors: { symbol: string; error: string }[];
  limitations: string[];
}

const RETRY_DELAYS_MS = [0, 1500, 3500];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function optionBuyAction(direction?: string | null) {
  return direction === 'LONG' ? 'BUY CE' : direction === 'SHORT' ? 'BUY PE' : null;
}

function withReadableFnoAction(response: FnoScanResponse): FnoScanResponse {
  const direction = response.technical?.direction ?? response.recommended_option?.direction;
  const action = optionBuyAction(direction);
  if (!action) return response;
  return { ...response, raw_signal: response.signal, signal: action, option_action: action };
}

function withReadableMtfActions(response: MtfScanResponse): MtfScanResponse {
  const convert = (item: MtfScanItem) => {
    if (item.status !== 'SETUP') return item;
    const action = optionBuyAction(item.direction);
    return action ? { ...item, raw_signal: item.signal, signal: action, option_action: action } : item;
  };
  return { ...response, setups: (response.setups ?? []).map(convert), others: (response.others ?? []).map(convert) };
}

function emitApiError(path: string, message: string) {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(API_ERROR_EVENT, {
    detail: { path, message, captured_at: new Date().toISOString() },
  }));
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt += 1) {
    if (RETRY_DELAYS_MS[attempt] > 0) await sleep(RETRY_DELAYS_MS[attempt]);
    try {
      const response = await fetch(`${ALPHAPILOT_API_BASE}${path}`, {
        ...init,
        headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      });
      if (response.ok) return response.json() as Promise<T>;
      const detail = await response.text().catch(() => '');
      const message = `AlphaPilot API ${response.status}: ${detail || response.statusText}`;
      if (response.status !== 408 && response.status !== 429 && response.status < 500) throw new Error(message);
      lastError = new Error(message);
    } catch (error) { lastError = error; }
  }
  const message = lastError instanceof Error ? lastError.message : 'Failed to fetch AlphaPilot API after retries.';
  const finalMessage = `${message} (retried ${RETRY_DELAYS_MS.length - 1} times)`;
  emitApiError(path, finalMessage);
  throw new Error(finalMessage);
}

export function getHealth() {
  return requestJson<{ ok: boolean; service: string; version: string; provider: string }>('/health');
}

export function getQuote(symbol: string) {
  return requestJson<any>(`/v1/quote/${encodeURIComponent(symbol.trim().toUpperCase())}`);
}

export function getCandles(symbol: string, timeframe = '5m') {
  const params = new URLSearchParams({ timeframe });
  return requestJson<any>(`/v1/candles/${encodeURIComponent(symbol.trim().toUpperCase())}?${params.toString()}`);
}

export function getOptionChain(symbol: string, expiry?: string | null) {
  const params = expiry ? `?expiry=${encodeURIComponent(expiry)}` : '';
  return requestJson<any>(`/v1/options/${encodeURIComponent(symbol.trim().toUpperCase())}${params}`);
}

export async function scanMtf(symbols: string[], minRiskReward = 1.5, timeframes: string[] = ['5m', '15m', '1h']): Promise<MtfScanResponse> {
  const startedAt = performance.now();
  const response = await requestJson<MtfScanResponse>('/v1/scan/mtf', { method: 'POST', body: JSON.stringify({ symbols, timeframes, min_risk_reward: minRiskReward }) });
  const readable = withReadableMtfActions({
    ...response,
    _client_latency_ms: Math.round(performance.now() - startedAt),
    _client_received_at: new Date().toISOString(),
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MTF_SCAN_EVENT, { detail: { symbols: [...symbols], response: readable, captured_at: new Date().toISOString() } }));
  }
  return readable;
}

export async function scanFno(symbol: string, minRiskReward = 1.5, timeframes: string[] = ['5m', '15m', '1h'], manualGift?: ManualGiftInput | null): Promise<FnoScanResponse> {
  const effectiveManualGift = manualGift === undefined ? readStoredManualGift() : manualGift;
  const startedAt = performance.now();
  const response = await requestJson<FnoScanResponse>('/v1/scan/fno', {
    method: 'POST',
    body: JSON.stringify({ symbol, timeframes, min_risk_reward: minRiskReward, expiry: null, include_market: true, take_snapshot: true, manual_gift: effectiveManualGift ?? null }),
  });
  const readable = withReadableFnoAction({
    ...response,
    _client_latency_ms: Math.round(performance.now() - startedAt),
    _client_received_at: new Date().toISOString(),
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FNO_SCAN_EVENT, { detail: readable }));
  }
  return readable;
}

export function getMarketNews(symbols: string[], limit = 3) {
  const unique = [...new Set(symbols.map(symbol => symbol.trim().toUpperCase()).filter(Boolean))].slice(0, 20);
  const params = new URLSearchParams({ symbols: unique.join(','), limit: String(Math.max(1, Math.min(limit, 5))) });
  return requestJson<MarketNewsResponse>(`/v1/news?${params.toString()}`);
}

export const getTradeNews = getMarketNews;

export function runHistoricalBacktest(symbols: string[], startDate: string, endDate: string, minRiskReward = 1.5, entryBefore?: string | null) {
  return requestJson<BacktestResponse>('/v1/backtest', {
    method: 'POST',
    body: JSON.stringify({ symbols, start_date: startDate, end_date: endDate, min_risk_reward: minRiskReward, entry_before: entryBefore ?? null }),
  });
}
