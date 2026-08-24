import type { RiskLimits, Position } from './types';
import { positionPnl } from './portfolio';

export interface RiskReport {
  maxRiskPerTrade: number;
  riskPerTradePct: number;
  openRisk: number;
  openRiskPct: number;
  concentration: { symbol: string; pct: number; exceeds: boolean }[];
  maxConcentrationPct: number;
  leverage: number;
  maxLeverage: number;
  consecutiveLosses: number;
  largestLoss: number;
  largestWin: number;
  violations: string[];
}

export function riskReport(positions: Position[], limits: RiskLimits, tradingCapital: number, recentPnls: number[]): RiskReport {
  const maxRiskPerTrade = (tradingCapital * limits.maxRiskPerTradePct) / 100;
  let openRisk = 0, totalValue = 0;
  const concentration: { symbol: string; pct: number; exceeds: boolean }[] = [];
  for (const pos of positions) {
    const pnl = positionPnl(pos);
    totalValue += pnl.currentValue;
    if (pos.stopLoss) openRisk += Math.abs((pos.avgPrice - pos.stopLoss) * pos.quantity);
  }
  for (const pos of positions) {
    const pnl = positionPnl(pos);
    const pct = totalValue > 0 ? (pnl.currentValue / totalValue) * 100 : 0;
    concentration.push({ symbol: pos.symbol, pct, exceeds: pct > limits.maxConcentrationPct });
  }
  concentration.sort((a, b) => b.pct - a.pct);
  const openRiskPct = tradingCapital > 0 ? (openRisk / tradingCapital) * 100 : 0;
  const leverage = tradingCapital > 0 ? totalValue / tradingCapital : 0;
  let consecutiveLosses = 0;
  for (let i = recentPnls.length - 1; i >= 0; i--) { if (recentPnls[i] < 0) consecutiveLosses++; else break; }
  const losses = recentPnls.filter((p) => p < 0);
  const wins = recentPnls.filter((p) => p > 0);
  const largestLoss = losses.length > 0 ? Math.min(...losses) : 0;
  const largestWin = wins.length > 0 ? Math.max(...wins) : 0;
  const violations: string[] = [];
  if (openRiskPct > limits.maxOpenRiskPct) violations.push(`Open risk (${openRiskPct.toFixed(1)}%) exceeds your limit (${limits.maxOpenRiskPct}%).`);
  if (leverage > limits.maxLeverage) violations.push(`Leverage (${leverage.toFixed(2)}x) exceeds your limit (${limits.maxLeverage}x).`);
  for (const c of concentration) if (c.exceeds) violations.push(`${c.symbol} concentration (${c.pct.toFixed(1)}%) exceeds your limit (${limits.maxConcentrationPct}%).`);
  return { maxRiskPerTrade, riskPerTradePct: limits.maxRiskPerTradePct, openRisk, openRiskPct, concentration, maxConcentrationPct: limits.maxConcentrationPct, leverage, maxLeverage: limits.maxLeverage, consecutiveLosses, largestLoss, largestWin, violations };
}

export function checkTradeViolation(potentialLoss: number, tradingCapital: number, limits: RiskLimits, openRisk: number): { violates: boolean; message: string } {
  const maxRiskPerTrade = (tradingCapital * limits.maxRiskPerTradePct) / 100;
  const v: string[] = [];
  if (potentialLoss > maxRiskPerTrade) v.push(`This trade risks ₹${potentialLoss.toFixed(0)}, exceeding your per-trade limit of ₹${maxRiskPerTrade.toFixed(0)}.`);
  if (openRisk + potentialLoss > (tradingCapital * limits.maxOpenRiskPct) / 100) v.push(`Adding this trade would push total open risk above your ${limits.maxOpenRiskPct}% limit.`);
  return { violates: v.length > 0, message: v.join(' ') };
}
