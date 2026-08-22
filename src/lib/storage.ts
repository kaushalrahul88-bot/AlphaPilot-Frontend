import type { Position, JournalEntry, Watchlist, Alert, RiskLimits } from './types';

const PREFIX = 'alphapilot:';

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

export interface AppState {
  positions: Position[];
  journal: JournalEntry[];
  watchlists: Watchlist[];
  alerts: Alert[];
  riskLimits: RiskLimits;
  tradingCapital: number;
  theme: 'dark' | 'light';
}

export const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxRiskPerTradePct: 1,
  maxDailyLossPct: 3,
  maxWeeklyLossPct: 6,
  maxOpenRiskPct: 6,
  maxConcentrationPct: 30,
  maxLeverage: 3,
};

export const DEFAULT_SCANNER_FILTERS = {
  minRiskReward: 1.5,
  maxRiskPct: 1,
  minLiquidity: 100000,
  avoidHighVolatility: true,
  trendAlignment: true,
};

export function loadState(): AppState {
  return {
    positions: load<Position[]>('positions', []),
    journal: load<JournalEntry[]>('journal', []),
    watchlists: load<Watchlist[]>('watchlists', []),
    alerts: load<Alert[]>('alerts', []),
    riskLimits: load<RiskLimits>('riskLimits', DEFAULT_RISK_LIMITS),
    tradingCapital: load<number>('tradingCapital', 1000000),
    theme: load<'dark' | 'light'>('theme', 'dark'),
  };
}

export function saveState(state: Partial<AppState>): void {
  if (state.positions !== undefined) save('positions', state.positions);
  if (state.journal !== undefined) save('journal', state.journal);
  if (state.watchlists !== undefined) save('watchlists', state.watchlists);
  if (state.alerts !== undefined) save('alerts', state.alerts);
  if (state.riskLimits !== undefined) save('riskLimits', state.riskLimits);
  if (state.tradingCapital !== undefined) save('tradingCapital', state.tradingCapital);
  if (state.theme !== undefined) save('theme', state.theme);
}
