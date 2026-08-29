import type { Position } from './types';
import { getQuote, getSectorMap } from './marketData';
import { cumulativeEquity, maxDrawdown } from './indicators';

export interface PositionPnl {
  investedValue: number;
  currentValue: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
  totalPnl: number;
  totalPnlPct: number;
}

export function positionPnl(pos: Position, currentPrice?: number): PositionPnl {
  const ltp = currentPrice ?? pos.currentPrice ?? getQuote(pos.symbol)?.ltp ?? pos.buyPrice;
  const investedValue = pos.quantity * pos.avgPrice;
  const currentValue = pos.quantity * ltp;
  const unrealizedPnl = currentValue - investedValue - pos.brokerage;
  const unrealizedPnlPct = investedValue > 0 ? (unrealizedPnl / investedValue) * 100 : 0;
  const totalPnl = unrealizedPnl + pos.realizedPnl;
  const totalPnlPct = investedValue > 0 ? (totalPnl / investedValue) * 100 : 0;
  return { investedValue, currentValue, unrealizedPnl, unrealizedPnlPct, realizedPnl: pos.realizedPnl, totalPnl, totalPnlPct };
}

export interface PortfolioSummary {
  totalValue: number;
  investedCapital: number;
  availableCash: number;
  todayPnl: number;
  todayPnlPct: number;
  realizedPnl: number;
  unrealizedPnl: number;
  totalPnl: number;
  returnPct: number;
  winRate: number;
  avgProfit: number;
  avgLoss: number;
  maxDrawdown: number;
  openRisk: number;
  openRiskPct: number;
}

export function portfolioSummary(positions: Position[], tradingCapital: number, realizedHistory: number[]): PortfolioSummary {
  let investedCapital = 0, totalValue = 0, unrealizedPnl = 0, realizedPnl = 0, todayPnl = 0, openRisk = 0;
  for (const pos of positions) {
    const pnl = positionPnl(pos);
    investedCapital += pnl.investedValue;
    totalValue += pnl.currentValue;
    unrealizedPnl += pnl.unrealizedPnl;
    realizedPnl += pos.realizedPnl;
    todayPnl += pnl.unrealizedPnl;
    if (pos.stopLoss) openRisk += Math.abs((pos.avgPrice - pos.stopLoss) * pos.quantity);
  }
  const totalPnl = unrealizedPnl + realizedPnl;
  const availableCash = tradingCapital - investedCapital;
  const returnPct = investedCapital > 0 ? (totalPnl / investedCapital) * 100 : 0;
  const todayPnlPct = investedCapital > 0 ? (todayPnl / investedCapital) * 100 : 0;
  const openRiskPct = tradingCapital > 0 ? (openRisk / tradingCapital) * 100 : 0;
  const wins = realizedHistory.filter((p) => p > 0);
  const losses = realizedHistory.filter((p) => p < 0);
  const winRate = wins.length + losses.length > 0 ? (wins.length / (wins.length + losses.length)) * 100 : 0;
  const avgProfit = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;
  const ddSeries = realizedHistory.length > 0 ? cumulativeEquity(realizedHistory) : [tradingCapital + totalPnl];
  return {
    totalValue: totalValue + availableCash, investedCapital, availableCash,
    todayPnl, todayPnlPct, realizedPnl, unrealizedPnl, totalPnl, returnPct,
    winRate, avgProfit, avgLoss, maxDrawdown: maxDrawdown(ddSeries), openRisk, openRiskPct,
  };
}

export function allocationBySymbol(positions: Position[]): { symbol: string; value: number; pct: number }[] {
  const total = positions.reduce((sum, p) => sum + positionPnl(p).currentValue, 0);
  return positions.map((p) => {
    const value = positionPnl(p).currentValue;
    return { symbol: p.symbol, value, pct: total > 0 ? (value / total) * 100 : 0 };
  }).sort((a, b) => b.value - a.value);
}

export function allocationBySector(positions: Position[]): { sector: string; value: number; pct: number }[] {
  const sectorMap = getSectorMap();
  const total = positions.reduce((sum, p) => sum + positionPnl(p).currentValue, 0);
  const bySector: Record<string, number> = {};
  for (const p of positions) {
    const sector = sectorMap[p.symbol] ?? 'Other';
    bySector[sector] = (bySector[sector] ?? 0) + positionPnl(p).currentValue;
  }
  return Object.entries(bySector).map(([sector, value]) => ({ sector, value, pct: total > 0 ? (value / total) * 100 : 0 })).sort((a, b) => b.value - a.value);
}
