import type { Position } from './types';
import { getQuote } from './marketData';
import { positionPnl } from './portfolio';

export interface ScenarioResult {
  symbol: string;
  priceChangePct: number;
  newPrice: number;
  totalImpact: number;
  positions: { symbol: string; quantity: number; pnlImpact: number; newPnl: number }[];
}

export function scenarioAnalysis(positions: Position[], symbol: string, priceChangePct: number): ScenarioResult {
  const quote = getQuote(symbol);
  const newPrice = quote.ltp * (1 + priceChangePct / 100);
  let totalImpact = 0;
  const pos: { symbol: string; quantity: number; pnlImpact: number; newPnl: number }[] = [];
  for (const p of positions) {
    if (p.symbol === symbol) {
      const currentPnl = positionPnl(p).unrealizedPnl;
      const newValue = p.quantity * newPrice;
      const invested = p.quantity * p.avgPrice;
      const newPnl = newValue - invested - p.brokerage;
      const impact = newPnl - currentPnl;
      totalImpact += impact;
      pos.push({ symbol: p.symbol, quantity: p.quantity, pnlImpact: impact, newPnl });
    }
  }
  return { symbol, priceChangePct, newPrice, totalImpact, positions: pos };
}

export function optionScenario(entryPrice: number, targetPrice: number, quantity: number, lotSize: number): { profit: number; pnlPct: number } {
  const totalQty = quantity * lotSize;
  const profit = (targetPrice - entryPrice) * totalQty;
  const pnlPct = entryPrice > 0 ? ((targetPrice - entryPrice) / entryPrice) * 100 : 0;
  return { profit, pnlPct };
}
