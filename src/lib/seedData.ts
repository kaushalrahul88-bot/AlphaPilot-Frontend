import type { Position, JournalEntry, Watchlist } from './types';
import { genId } from './format';

export function seedPositions(): Position[] {
  return [
    { id: genId(), symbol: 'NIFTY', exchange: 'NSE', type: 'FUTURE', quantity: 75, buyPrice: 24600, currentPrice: 24850.5, avgPrice: 24600, entryDate: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10), stopLoss: 24400, target: 25100, positionSize: 1845000, brokerage: 120, realizedPnl: 0, lotSize: 75, lots: 1 },
    { id: genId(), symbol: 'RELIANCE', exchange: 'NSE', type: 'STOCK', quantity: 100, buyPrice: 2850, currentPrice: 2945.8, avgPrice: 2850, entryDate: new Date(Date.now() - 15 * 86400000).toISOString().slice(0, 10), stopLoss: 2780, target: 3100, positionSize: 285000, brokerage: 40, realizedPnl: 0 },
    { id: genId(), symbol: 'TCS', exchange: 'NSE', type: 'STOCK', quantity: 50, buyPrice: 4100, currentPrice: 4180.5, avgPrice: 4100, entryDate: new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10), stopLoss: 3980, target: 4400, positionSize: 205000, brokerage: 40, realizedPnl: 0 },
    { id: genId(), symbol: 'CRUDEOIL', exchange: 'MCX', type: 'COMMODITY', quantity: 100, buyPrice: 6400, currentPrice: 6580, avgPrice: 6400, entryDate: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), stopLoss: 6200, target: 6900, positionSize: 640000, brokerage: 200, realizedPnl: 0, lotSize: 100, lots: 1 },
  ];
}

export function seedJournal(): JournalEntry[] {
  return [
    { id: genId(), date: new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10), instrument: 'NIFTY', direction: 'BULLISH', entry: 24600, exit: 24850, quantity: 75, stopLoss: 24400, target: 25100, strategy: 'Trend Following', reason: 'EMA crossover with volume confirmation', emotionBefore: 'Confident', emotionAfter: 'Satisfied', result: 'WIN', pnl: 18750, mistake: '' },
    { id: genId(), date: new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10), instrument: 'BANKNIFTY', direction: 'BEARISH', entry: 54200, exit: 54500, quantity: 35, stopLoss: 54600, target: 53500, strategy: 'Mean Reversion', reason: 'RSI overbought reversal', emotionBefore: 'Anxious', emotionAfter: 'Frustrated', result: 'LOSS', pnl: -10500, mistake: 'Moved stop loss' },
    { id: genId(), date: new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10), instrument: 'RELIANCE', direction: 'BULLISH', entry: 2880, exit: 2920, quantity: 100, stopLoss: 2830, target: 2980, strategy: 'Breakout', reason: 'Breakout above resistance with volume', emotionBefore: 'Excited', emotionAfter: 'Happy', result: 'WIN', pnl: 4000, mistake: '' },
    { id: genId(), date: new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10), instrument: 'CRUDEOIL', direction: 'BULLISH', entry: 6500, exit: 6450, quantity: 100, stopLoss: 6400, target: 6800, strategy: 'News Based', reason: 'OPEC cut news', emotionBefore: 'Greedy', emotionAfter: 'Regretful', result: 'LOSS', pnl: -5000, mistake: 'Entered without proper setup' },
    { id: genId(), date: new Date(Date.now() - 5 * 86400000).toISOString().slice(0, 10), instrument: 'TCS', direction: 'BULLISH', entry: 4120, exit: 4180, quantity: 50, stopLoss: 4050, target: 4250, strategy: 'Trend Following', reason: 'Strong uptrend continuation', emotionBefore: 'Cautious', emotionAfter: 'Satisfied', result: 'WIN', pnl: 3000, mistake: '' },
    { id: genId(), date: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10), instrument: 'NIFTY', direction: 'BEARISH', entry: 24700, exit: 24750, quantity: 75, stopLoss: 24900, target: 24400, strategy: 'Counter Trend', reason: 'Felt like reversing', emotionBefore: 'Revengeful', emotionAfter: 'Angry', result: 'LOSS', pnl: -3750, mistake: 'Revenge trading' },
    { id: genId(), date: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10), instrument: 'INFY', direction: 'BULLISH', entry: 1830, exit: 1850, quantity: 100, stopLoss: 1800, target: 1880, strategy: 'Swing', reason: 'Support bounce', emotionBefore: 'Calm', emotionAfter: 'Happy', result: 'WIN', pnl: 2000, mistake: '' },
  ];
}

export function seedWatchlists(): Watchlist[] {
  return [
    { id: genId(), name: 'Index Watch', symbols: ['NIFTY', 'BANKNIFTY'] },
    { id: genId(), name: 'F&O Stocks', symbols: ['RELIANCE', 'TCS', 'HDFCBANK', 'INFY', 'ICICIBANK', 'SBIN', 'TATAMOTORS'] },
    { id: genId(), name: 'Commodities', symbols: ['CRUDEOIL', 'NATGAS', 'GOLD'] },
  ];
}
