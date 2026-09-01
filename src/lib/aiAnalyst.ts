import type { Direction, Position, JournalEntry } from './types';
import { getQuote, getInstrument } from './marketData';
import { ema, rsi, macd, atr, supportResistance } from './indicators';
import { positionPnl, portfolioSummary, allocationBySymbol } from './portfolio';
import { riskReport } from './risk';
import { cumulativeEquity, maxDrawdown } from './indicators';

export interface AnalysisResult {
  symbol: string;
  ltp: number;
  trend: string;
  momentum: string;
  support: number;
  resistance: number;
  breakout: number;
  breakdown: number;
  volumeBehavior: string;
  volatility: string;
  ema9: number;
  ema20: number;
  ema50: number;
  vwap: number;
  rsiVal: number;
  macdVal: number;
  macdSignal: number;
  atrVal: number;
  prevHigh: number;
  prevLow: number;
  open: number;
  high: number;
  low: number;
  close: number;
  summary: string;
  direction: Direction;
  confidence: number;
  disclaimer: string;
}

export function analyzeInstrument(symbol: string): AnalysisResult {
  const quote = getQuote(symbol);
  const ohlc = quote.ohlc ?? [];
  const ema9Arr = ema(ohlc, 9), ema20Arr = ema(ohlc, 20), ema50Arr = ema(ohlc, 50);
  const rsiArr = rsi(ohlc, 14);
  const macdRes = macd(ohlc);
  const atrVal = atr(ohlc, 14);
  const sr = supportResistance(ohlc, 20);
  const last = ohlc.length - 1;
  const ema9 = ema9Arr[last], ema20 = ema20Arr[last], ema50 = ema50Arr[last];
  const rsiVal = rsiArr[last] ?? 50;
  const macdVal = macdRes.macd[last], macdSignal = macdRes.signal[last];
  const vwap = ohlc.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, ohlc.length);
  const prevHigh = ohlc[ohlc.length - 2] ?? quote.high;
  const prevLow = ohlc[ohlc.length - 2] ?? quote.low;

  let trend = 'SIDEWAYS', direction: Direction = 'NEUTRAL';
  if (ema9 > ema20 && ema20 > ema50) { trend = 'UPTREND'; direction = 'BULLISH'; }
  else if (ema9 < ema20 && ema20 < ema50) { trend = 'DOWNTREND'; direction = 'BEARISH'; }

  const momentum = macdVal > macdSignal ? 'POSITIVE — MACD above signal line' : 'NEGATIVE — MACD below signal line';
  const volumeBehavior = quote.volume > 10000000 ? 'High volume — strong participation' : 'Moderate volume';
  const volatility = atrVal / quote.ltp > 0.02 ? 'Elevated volatility (ATR > 2% of price)' : 'Normal volatility (ATR < 2% of price)';

  let confidence = 50;
  if (direction === 'BULLISH' && rsiVal > 50 && rsiVal < 70) confidence += 20;
  if (direction === 'BEARISH' && rsiVal < 50 && rsiVal > 30) confidence += 20;
  if (macdVal > macdSignal && direction === 'BULLISH') confidence += 10;
  if (macdVal < macdSignal && direction === 'BEARISH') confidence += 10;
  confidence = Math.min(confidence, 90);

  const summary = `${symbol} is currently in a ${trend.toLowerCase()} with ${momentum.toLowerCase()}. Price is trading at ₹${quote.ltp.toFixed(2)} with support at ₹${sr.support.toFixed(2)} and resistance at ₹${sr.resistance.toFixed(2)}. RSI is at ${rsiVal.toFixed(0)}, suggesting ${rsiVal > 70 ? 'overbought conditions' : rsiVal < 30 ? 'oversold conditions' : 'neutral momentum'}. ${volumeBehavior}. ${volatility}.`;

  return {
    symbol, ltp: quote.ltp, trend, momentum, support: sr.support, resistance: sr.resistance,
    breakout: sr.resistance, breakdown: sr.support, volumeBehavior, volatility,
    ema9, ema20, ema50, vwap, rsiVal, macdVal, macdSignal, atrVal,
    prevHigh, prevLow, open: quote.open, high: quote.high, low: quote.low, close: quote.ltp,
    summary, direction, confidence,
    disclaimer: 'Live market data unavailable — analysis based on the latest available MOCK data. This is analytical information, not financial advice.',
  };
}

export function analyzePortfolio(positions: Position[], tradingCapital: number, realizedHistory: number[], journal: JournalEntry[]): string {
  if (positions.length === 0) return 'You have no open positions. Add positions to your portfolio to get a personalized analysis.';
  const summary = portfolioSummary(positions, tradingCapital, realizedHistory);
  const alloc = allocationBySymbol(positions);
  const report = riskReport(positions, { maxRiskPerTradePct: 1, maxDailyLossPct: 3, maxWeeklyLossPct: 6, maxOpenRiskPct: 6, maxConcentrationPct: 30, maxLeverage: 3 }, tradingCapital, realizedHistory);

  let result = `Portfolio Overview:\n`;
  result += `Total Value: ₹${summary.totalValue.toFixed(0)} | Invested: ₹${summary.investedCapital.toFixed(0)} | Cash: ₹${summary.availableCash.toFixed(0)}\n`;
  result += `Unrealized P&L: ₹${summary.unrealizedPnl.toFixed(0)} | Realized P&L: ₹${summary.realizedPnl.toFixed(0)} | Return: ${summary.returnPct.toFixed(2)}%\n`;
  result += `Win Rate: ${summary.winRate.toFixed(0)}% | Open Risk: ₹${summary.openRisk.toFixed(0)} (${summary.openRiskPct.toFixed(1)}%)\n\n`;
  result += `Top Holdings:\n`;
  alloc.slice(0, 3).forEach((a) => { result += `  ${a.symbol}: ${a.pct.toFixed(1)}% (₹${a.value.toFixed(0)})\n`; });
  if (report.violations.length > 0) {
    result += `\nRisk Warnings:\n`;
    report.violations.forEach((v) => { result += `  ⚠ ${v}\n`; });
  }
  if (journal.length > 0) {
    const mistakes: Record<string, number> = {};
    journal.forEach((j) => { if (j.mistake) mistakes[j.mistake] = (mistakes[j.mistake] ?? 0) + 1; });
    const topMistake = Object.entries(mistakes).sort((a, b) => b[1] - a[1])[0];
    if (topMistake) result += `\nMost common mistake: ${topMistake[0]} (${topMistake[1]} occurrences)\n`;
  }
  result += `\nDisclaimer: Analysis based on MOCK data. Not financial advice.`;
  return result;
}

export function buildTradingProfile(journal: JournalEntry[]): {
  bestStrategy?: string; worstStrategy?: string; bestInstrument?: string; worstInstrument?: string;
  bestTime?: string; worstTime?: string; avgHoldingPeriod?: string; avgRiskReward?: number;
  winRate?: number; profitFactor?: number; maxDrawdown?: number; commonMistake?: string;
} {
  if (journal.length === 0) return {};
  const strategyPnl: Record<string, number> = {};
  const instrumentPnl: Record<string, number> = {};
  const timePnl: Record<string, number> = {};
  const mistakes: Record<string, number> = {};
  let totalRR = 0, rrCount = 0;
  const wins = journal.filter((j) => j.pnl > 0);
  const losses = journal.filter((j) => j.pnl < 0);
  const grossProfit = wins.reduce((a, j) => a + j.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((a, j) => a + j.pnl, 0));

  journal.forEach((j) => {
    if (j.strategy) strategyPnl[j.strategy] = (strategyPnl[j.strategy] ?? 0) + j.pnl;
    instrumentPnl[j.instrument] = (instrumentPnl[j.instrument] ?? 0) + j.pnl;
    const hour = new Date(j.date).getHours();
    const slot = hour < 12 ? 'Morning' : hour < 15 ? 'Afternoon' : 'Evening';
    timePnl[slot] = (timePnl[slot] ?? 0) + j.pnl;
    if (j.mistake) mistakes[j.mistake] = (mistakes[j.mistake] ?? 0) + 1;
    if (j.stopLoss && j.target && j.entry) {
      const risk = Math.abs(j.entry - j.stopLoss);
      const reward = Math.abs(j.target - j.entry);
      if (risk > 0) { totalRR += reward / risk; rrCount++; }
    }
  });

  const bestStrategy = Object.entries(strategyPnl).sort((a, b) => b[1] - a[1])[0]?.[0];
  const worstStrategy = Object.entries(strategyPnl).sort((a, b) => a[1] - b[1])[0]?.[0];
  const bestInstrument = Object.entries(instrumentPnl).sort((a, b) => b[1] - a[1])[0]?.[0];
  const worstInstrument = Object.entries(instrumentPnl).sort((a, b) => a[1] - b[1])[0]?.[0];
  const bestTime = Object.entries(timePnl).sort((a, b) => b[1] - a[1])[0]?.[0];
  const worstTime = Object.entries(timePnl).sort((a, b) => a[1] - b[1])[0]?.[0];
  const commonMistake = Object.entries(mistakes).sort((a, b) => b[1] - a[1])[0]?.[0];
  const winRate = journal.length > 0 ? (wins.length / journal.length) * 100 : 0;
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  const equity = cumulativeEquity(journal.map((j) => j.pnl));
  const dd = maxDrawdown(equity);

  return {
    bestStrategy, worstStrategy, bestInstrument, worstInstrument, bestTime, worstTime,
    avgHoldingPeriod: '1-3 days (MVP estimate)',
    avgRiskReward: rrCount > 0 ? totalRR / rrCount : undefined,
    winRate, profitFactor, maxDrawdown: dd, commonMistake,
  };
}

export function analyzeJournalMistakes(journal: JournalEntry[]): { mistake: string; count: number; pct: number }[] {
  const mistakes: Record<string, number> = {};
  journal.forEach((j) => { if (j.mistake) mistakes[j.mistake] = (mistakes[j.mistake] ?? 0) + 1; });
  const total = Object.values(mistakes).reduce((a, b) => a + b, 0);
  return Object.entries(mistakes).map(([mistake, count]) => ({ mistake, count, pct: total > 0 ? (count / total) * 100 : 0 })).sort((a, b) => b.count - a.count);
}

export function generateWeeklyReport(journal: JournalEntry[]): string {
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recent = journal.filter((j) => new Date(j.date).getTime() > weekAgo);
  if (recent.length === 0) return 'No trades in the past week. No behavioral patterns to report.';
  const wins = recent.filter((j) => j.pnl > 0);
  const losses = recent.filter((j) => j.pnl < 0);
  const totalPnl = recent.reduce((a, j) => a + j.pnl, 0);
  const mistakeAnalysis = analyzeJournalMistakes(recent);
  let report = `Weekly Trading Behavior Report\n\n`;
  report += `Trades this week: ${recent.length}\nWins: ${wins.length} | Losses: ${losses.length} | Win Rate: ${((wins.length / recent.length) * 100).toFixed(0)}%\n`;
  report += `Net P&L: ₹${totalPnl.toFixed(0)}\n\n`;
  if (mistakeAnalysis.length > 0) {
    report += `Recurring Mistakes:\n`;
    mistakeAnalysis.slice(0, 5).forEach((m) => { report += `  • ${m.mistake}: ${m.count} times (${m.pct.toFixed(0)}%)\n`; });
  }
  if (recent.length > 10) report += `\n⚠ Overtrading detected: ${recent.length} trades in a week is high. Consider reducing trade frequency.\n`;
  report += `\nDisclaimer: Based on your journal entries. Not financial advice.`;
  return report;
}
