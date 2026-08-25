import type { TradeSetup, ScannerFilters, Direction } from './types';
import { getQuote, getInstrument, getOptionsChain, getExpiries } from './marketData';
import { ema, rsi, macd, atr, supportResistance } from './indicators';
import { calculatePositionSizing } from './positionSizing';

export function analyzeTrend(ohlc: number[]): { trend: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS'; momentum: number; ema9: number; ema20: number; ema50: number; rsiVal: number; macdVal: number; macdSignal: number; atrVal: number; support: number; resistance: number; vwap: number } {
  const ema9Arr = ema(ohlc, 9);
  const ema20Arr = ema(ohlc, 20);
  const ema50Arr = ema(ohlc, 50);
  const rsiArr = rsi(ohlc, 14);
  const macdRes = macd(ohlc);
  const atrVal = atr(ohlc, 14);
  const sr = supportResistance(ohlc, 20);
  const last = ohlc.length - 1;
  const ema9 = ema9Arr[last], ema20 = ema20Arr[last], ema50 = ema50Arr[last];
  const rsiVal = rsiArr[last] ?? 50;
  const macdVal = macdRes.macd[last], macdSignal = macdRes.signal[last];
  const vwap = ohlc.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, ohlc.length);
  let trend: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS' = 'SIDEWAYS';
  if (ema9 > ema20 && ema20 > ema50) trend = 'UPTREND';
  else if (ema9 < ema20 && ema20 < ema50) trend = 'DOWNTREND';
  const momentum = ((macdVal - macdSignal) / Math.abs(macdSignal || 1)) * 100;
  return { trend, momentum, ema9, ema20, ema50, rsiVal, macdVal, macdSignal, atrVal, support: sr.support, resistance: sr.resistance, vwap };
}

function scoreSetup(rr: number, trendAlign: boolean, rsiVal: number, momentum: number, liquidity: number, filters: ScannerFilters): number {
  let score = 0;
  score += Math.min(rr * 20, 40);
  if (trendAlign) score += 25;
  if (rsiVal > 40 && rsiVal < 70) score += 15;
  if (Math.abs(momentum) > 0.5) score += 10;
  if (liquidity > filters.minLiquidity) score += 10;
  return Math.min(score, 100);
}

export function scanForSetups(symbols: string[], tradingCapital: number, filters: ScannerFilters): TradeSetup[] {
  const setups: TradeSetup[] = [];
  for (const symbol of symbols) {
    const inst = getInstrument(symbol);
    if (!inst) continue;
    const quote = getQuote(symbol);
    const ohlc = quote.ohlc ?? [];
    if (ohlc.length < 20) continue;
    const a = analyzeTrend(ohlc);
    const liquidity = quote.volume;
    if (liquidity < filters.minLiquidity) continue;
    const maxRiskRupees = (tradingCapital * filters.maxRiskPct) / 100;

    // Bullish setup
    if (a.trend === 'UPTREND' && (!filters.trendAlignment || true)) {
      const entry = quote.ltp;
      const stopLoss = Math.max(a.support, a.ema20) * 0.998;
      const riskPerUnit = entry - stopLoss;
      if (riskPerUnit > 0) {
        const target1 = entry + riskPerUnit * filters.minRiskReward;
        const target2 = entry + riskPerUnit * (filters.minRiskReward * 2);
        const rr = (target1 - entry) / riskPerUnit;
        const ps = calculatePositionSizing({ tradingCapital, maxRiskPct: filters.maxRiskPct, entryPrice: entry, stopLoss, targetPrice: target1, brokerage: 50, lotSize: inst.lotSize });
        if (ps.quantity > 0 && rr >= filters.minRiskReward) {
          const trendAlign = a.trend === 'UPTREND';
          const score = scoreSetup(rr, trendAlign, a.rsiVal, a.momentum, liquidity, filters);
          if (score >= 50) {
            setups.push({
              instrument: symbol, kind: 'FUTURES', direction: 'BULLISH' as Direction,
              entryZone: [Math.round(entry * 99.8) / 100, Math.round(entry * 100.2) / 100],
              stopLoss: Math.round(stopLoss * 100) / 100, target1: Math.round(target1 * 100) / 100, target2: Math.round(target2 * 100) / 100,
              riskReward: Math.round(rr * 100) / 100, quantity: ps.quantity, lots: ps.lots, maxRisk: ps.potentialLoss,
              potentialProfit: ps.potentialProfit, score, confidence: Math.round(score * 0.8),
              reasons: [`Price above EMA9/20/50 — uptrend confirmed`, `RSI at ${a.rsiVal.toFixed(0)} — healthy momentum`, `Support at ${a.support.toFixed(2)}, resistance at ${a.resistance.toFixed(2)}`, `Risk/Reward ${rr.toFixed(2)}:1 meets minimum`],
              invalidation: `Close below ${stopLoss.toFixed(2)} invalidates the bullish setup`,
            });
          }
        }
      }
    }

    // Bearish setup
    if (a.trend === 'DOWNTREND') {
      const entry = quote.ltp;
      const stopLoss = Math.min(a.resistance, a.ema20) * 1.002;
      const riskPerUnit = stopLoss - entry;
      if (riskPerUnit > 0) {
        const target1 = entry - riskPerUnit * filters.minRiskReward;
        const target2 = entry - riskPerUnit * (filters.minRiskReward * 2);
        const rr = (entry - target1) / riskPerUnit;
        const ps = calculatePositionSizing({ tradingCapital, maxRiskPct: filters.maxRiskPct, entryPrice: entry, stopLoss, targetPrice: target1, brokerage: 50, lotSize: inst.lotSize });
        if (ps.quantity > 0 && rr >= filters.minRiskReward) {
          const score = scoreSetup(rr, true, a.rsiVal, a.momentum, liquidity, filters);
          if (score >= 50) {
            setups.push({
              instrument: symbol, kind: 'FUTURES', direction: 'BEARISH' as Direction,
              entryZone: [Math.round(entry * 99.8) / 100, Math.round(entry * 100.2) / 100],
              stopLoss: Math.round(stopLoss * 100) / 100, target1: Math.round(target1 * 100) / 100, target2: Math.round(target2 * 100) / 100,
              riskReward: Math.round(rr * 100) / 100, quantity: ps.quantity, lots: ps.lots, maxRisk: ps.potentialLoss,
              potentialProfit: ps.potentialProfit, score, confidence: Math.round(score * 0.8),
              reasons: [`Price below EMA9/20/50 — downtrend confirmed`, `RSI at ${a.rsiVal.toFixed(0)} — bearish momentum`, `Resistance at ${a.resistance.toFixed(2)}, support at ${a.support.toFixed(2)}`, `Risk/Reward ${rr.toFixed(2)}:1 meets minimum`],
              invalidation: `Close above ${stopLoss.toFixed(2)} invalidates the bearish setup`,
            });
          }
        }
      }
    }
  }
  // Options setups for indices
  for (const symbol of ['NIFTY', 'BANKNIFTY']) {
    const quote = getQuote(symbol);
    const ohlc = quote.ohlc ?? [];
    if (ohlc.length < 20) continue;
    const a = analyzeTrend(ohlc);
    const expiry = getExpiries(symbol)[0];
    const chain = getOptionsChain(symbol, expiry);
    const maxRiskRupees = (tradingCapital * filters.maxRiskPct) / 100;
    const inst = getInstrument(symbol)!;

    if (a.trend === 'UPTREND' && a.rsiVal < 70) {
      const atmRow = chain.rows.find((r) => r.strike === chain.atmStrike);
      const itmRow = chain.rows.find((r) => r.strike === chain.atmStrike - (symbol === 'NIFTY' ? 50 : 100));
      const row = itmRow ?? atmRow;
      if (row) {
        const entry = row.ceLtp;
        const stopLoss = entry * 0.7;
        const riskPerUnit = entry - stopLoss;
        const target1 = entry * 1.5;
        const target2 = entry * 2.0;
        const rr = (target1 - entry) / riskPerUnit;
        const ps = calculatePositionSizing({ tradingCapital, maxRiskPct: filters.maxRiskPct, entryPrice: entry, stopLoss, targetPrice: target1, brokerage: 50, lotSize: inst.lotSize });
        if (ps.quantity > 0 && rr >= filters.minRiskReward) {
          const score = scoreSetup(rr, true, a.rsiVal, a.momentum, row.ceVolume, filters);
          if (score >= 50) {
            setups.push({
              instrument: symbol, kind: 'OPTIONS', optionType: 'CE', strike: row.strike, expiry,
              direction: 'BULLISH' as Direction,
              entryZone: [Math.round(entry * 99) / 100, Math.round(entry * 101) / 100],
              stopLoss: Math.round(stopLoss * 100) / 100, target1: Math.round(target1 * 100) / 100, target2: Math.round(target2 * 100) / 100,
              riskReward: Math.round(rr * 100) / 100, quantity: ps.quantity, lots: ps.lots, maxRisk: ps.potentialLoss,
              potentialProfit: ps.potentialProfit, score, confidence: Math.round(score * 0.75),
              reasons: [`Uptrend — CE at strike ${row.strike} (delta ${row.ceDelta})`, `IV at ${row.ceIv}%, theta ${row.ceTheta}`, `Risk/Reward ${rr.toFixed(2)}:1`, `Lot size ${inst.lotSize}, ${ps.lots} lots`],
              invalidation: `Premium drops below ${stopLoss.toFixed(2)} or underlying breaks ${a.support.toFixed(2)}`,
            });
          }
        }
      }
    }

    if (a.trend === 'DOWNTREND' && a.rsiVal > 30) {
      const atmRow = chain.rows.find((r) => r.strike === chain.atmStrike);
      const otmRow = chain.rows.find((r) => r.strike === chain.atmStrike + (symbol === 'NIFTY' ? 50 : 100));
      const row = otmRow ?? atmRow;
      if (row) {
        const entry = row.peLtp;
        const stopLoss = entry * 0.7;
        const riskPerUnit = entry - stopLoss;
        const target1 = entry * 1.5;
        const target2 = entry * 2.0;
        const rr = (target1 - entry) / riskPerUnit;
        const ps = calculatePositionSizing({ tradingCapital, maxRiskPct: filters.maxRiskPct, entryPrice: entry, stopLoss, targetPrice: target1, brokerage: 50, lotSize: inst.lotSize });
        if (ps.quantity > 0 && rr >= filters.minRiskReward) {
          const score = scoreSetup(rr, true, a.rsiVal, a.momentum, row.peVolume, filters);
          if (score >= 50) {
            setups.push({
              instrument: symbol, kind: 'OPTIONS', optionType: 'PE', strike: row.strike, expiry,
              direction: 'BEARISH' as Direction,
              entryZone: [Math.round(entry * 99) / 100, Math.round(entry * 101) / 100],
              stopLoss: Math.round(stopLoss * 100) / 100, target1: Math.round(target1 * 100) / 100, target2: Math.round(target2 * 100) / 100,
              riskReward: Math.round(rr * 100) / 100, quantity: ps.quantity, lots: ps.lots, maxRisk: ps.potentialLoss,
              potentialProfit: ps.potentialProfit, score, confidence: Math.round(score * 0.75),
              reasons: [`Downtrend — PE at strike ${row.strike} (delta ${row.peDelta})`, `IV at ${row.peIv}%, theta ${row.peTheta}`, `Risk/Reward ${rr.toFixed(2)}:1`, `Lot size ${inst.lotSize}, ${ps.lots} lots`],
              invalidation: `Premium drops below ${stopLoss.toFixed(2)} or underlying breaks ${a.resistance.toFixed(2)}`,
            });
          }
        }
      }
    }
  }
  setups.sort((a, b) => b.score - a.score);
  return setups.slice(0, 3);
}

export function generateTradeSetup(symbol: string, tradingCapital: number, filters: ScannerFilters): TradeSetup | null {
  const setups = scanForSetups([symbol], tradingCapital, filters);
  return setups[0] ?? null;
}

export function suggestOptionStrike(symbol: string, direction: Direction): { strike: number; type: 'CE' | 'PE'; premium: number; delta: number; iv: number; theta: number; reason: string } | null {
  const expiry = getExpiries(symbol)[0];
  const chain = getOptionsChain(symbol, expiry);
  const isBullish = direction === 'BULLISH';
  const type = isBullish ? 'CE' : 'PE';
  const offset = isBullish ? -1 : 1;
  const step = symbol === 'NIFTY' ? 50 : 100;
  const targetStrike = chain.atmStrike + offset * step;
  const row = chain.rows.find((r) => r.strike === targetStrike) ?? chain.rows.find((r) => r.strike === chain.atmStrike);
  if (!row) return null;
  const premium = isBullish ? row.ceLtp : row.peLtp;
  const delta = isBullish ? row.ceDelta : row.peDelta;
  const iv = isBullish ? row.ceIv : row.peIv;
  const theta = isBullish ? row.ceTheta : row.peTheta;
  const distance = Math.abs(row.strike - chain.spot) / chain.spot * 100;
  return {
    strike: row.strike, type, premium, delta, iv, theta,
    reason: `${type} at ${row.strike} — delta ${delta}, ${distance.toFixed(1)}% from ATM, IV ${iv}%. ${isBullish ? 'Slightly ITM for better delta' : 'Slightly OTM for lower premium cost'}.`,
  };
}
