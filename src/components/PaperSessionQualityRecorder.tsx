import { useEffect, useRef } from 'react';
import { API_ERROR_EVENT, getCandles, getHealth, getOptionChain, getQuote } from '@/lib/alphaPilotApi';
import { PAPER_TRADE_LIFECYCLE_EVENT, readPaperTrades } from '@/lib/paperTradeLifecycleStorage';
import {
  appendSessionDataIncident,
  appendSessionHealthSnapshot,
  readSessionHealthSnapshots,
  sessionDateIst,
  sessionPhase,
} from '@/lib/paperSessionQualityStorage';

const CHECK_INTERVAL_MS = 5 * 60_000;

function exactOptionAvailable(chain: unknown, strike: number, optionType: 'CE' | 'PE') {
  if (!chain || typeof chain !== 'object') return false;
  const root = chain as Record<string, unknown>;
  if (String(root.provider ?? '').toUpperCase() !== 'GROWW') return false;
  const raw = (root.data && typeof root.data === 'object' ? root.data : root) as Record<string, unknown>;
  const payload = (raw.payload && typeof raw.payload === 'object' ? raw.payload : raw) as Record<string, unknown>;
  const strikes = payload.strikes;
  if (!strikes || typeof strikes !== 'object') return false;
  for (const [key, value] of Object.entries(strikes as Record<string, unknown>)) {
    if (Math.abs(Number(key) - strike) > 1e-6 || !value || typeof value !== 'object') continue;
    const leg = (value as Record<string, unknown>)[optionType];
    if (!leg || typeof leg !== 'object') return false;
    return Number((leg as Record<string, unknown>).ltp) > 0;
  }
  return false;
}

function freshFiveMinuteCandles(value: unknown) {
  if (!value || typeof value !== 'object') return false;
  const candles = (value as { candles?: unknown }).candles;
  if (!Array.isArray(candles) || !candles.length) return false;
  const last = candles[candles.length - 1];
  if (!Array.isArray(last) || last.length < 1) return false;
  const raw = last[0];
  let timestamp = typeof raw === 'number' ? raw : new Date(String(raw)).getTime();
  if (typeof raw === 'number' && raw < 1_000_000_000_000) timestamp *= 1000;
  const age = Date.now() - timestamp;
  return Number.isFinite(age) && age >= -2 * 60_000 && age <= 20 * 60_000;
}

export function PaperSessionQualityRecorder() {
  const checkingRef = useRef(false);

  useEffect(() => {
    const onApiError = (event: Event) => {
      const detail = (event as CustomEvent<{ path?: string; message?: string; captured_at?: string }>).detail;
      const path = detail?.path ?? '';
      const relevant = ['/health', '/v1/quote/', '/v1/candles/', '/v1/options/', '/v1/paper-trades/']
        .some(prefix => path.startsWith(prefix));
      if (!relevant) return;
      appendSessionDataIncident({
        captured_at: detail?.captured_at ?? new Date().toISOString(),
        source: path || 'AlphaPilot API',
        code: (detail?.message ?? 'Unknown critical data error').slice(0, 160),
      });
    };

    const captureCurrentPhase = async () => {
      if (checkingRef.current || document.visibilityState !== 'visible') return;
      const now = new Date();
      const phase = sessionPhase(now);
      if (!phase) return;
      const today = sessionDateIst(now);
      const trades = readPaperTrades().filter(row => sessionDateIst(row.opened_at) === today);
      if (!trades.length) return;

      const contracts = new Map<string, typeof trades[number]>();
      for (const trade of trades) {
        contracts.set(trade.symbol + '|' + trade.expiry + '|' + String(trade.strike) + '|' + trade.option_type, trade);
      }
      const existing = readSessionHealthSnapshots();
      checkingRef.current = true;
      try {
        for (const trade of contracts.values()) {
          const alreadyCaptured = existing.some(row =>
            row.symbol === trade.symbol
            && row.expiry === trade.expiry
            && sessionDateIst(row.captured_at) === today
            && sessionPhase(row.captured_at) === phase
          );
          if (alreadyCaptured) continue;

          let api = false;
          let quote = false;
          let candles = false;
          let options = false;
          try {
            const health = await getHealth();
            api = Boolean(health.ok) && String(health.provider).toUpperCase() === 'GROWW';
          } catch {
            api = false;
          }
          try {
            const value = await getQuote(trade.symbol);
            quote = String(value?.provider ?? '').toUpperCase() === 'GROWW';
          } catch {
            quote = false;
          }
          try {
            candles = freshFiveMinuteCandles(await getCandles(trade.symbol, '5m'));
          } catch {
            candles = false;
          }
          try {
            const chain = await getOptionChain(trade.symbol, trade.expiry);
            options = exactOptionAvailable(chain, trade.strike, trade.option_type);
          } catch {
            options = false;
          }
          appendSessionHealthSnapshot({
            captured_at: new Date().toISOString(),
            symbol: trade.symbol,
            expiry: trade.expiry,
            checks: { api, quote, candles, options },
          });
        }
      } finally {
        checkingRef.current = false;
      }
    };

    const onLifecycle = () => void captureCurrentPhase();
    window.addEventListener(API_ERROR_EVENT, onApiError);
    window.addEventListener(PAPER_TRADE_LIFECYCLE_EVENT, onLifecycle);
    document.addEventListener('visibilitychange', onLifecycle);
    void captureCurrentPhase();
    const timer = window.setInterval(() => void captureCurrentPhase(), CHECK_INTERVAL_MS);
    return () => {
      window.removeEventListener(API_ERROR_EVENT, onApiError);
      window.removeEventListener(PAPER_TRADE_LIFECYCLE_EVENT, onLifecycle);
      document.removeEventListener('visibilitychange', onLifecycle);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
