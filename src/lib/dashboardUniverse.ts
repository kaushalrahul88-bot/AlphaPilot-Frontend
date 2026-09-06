import { INSTRUMENTS } from '@/lib/marketData';

export type MarketCategory = 'FNO' | 'COMMODITIES' | 'CRYPTO';
export type WorkspaceState = 'CONNECTED' | 'AVAILABLE' | 'PLANNED';

export interface DashboardInstrument {
  symbol: string;
  name: string;
  category: MarketCategory;
  state: WorkspaceState;
  exchange?: string;
  segment?: string;
}

export type DashboardUniverse = Record<MarketCategory, DashboardInstrument[]>;

const fnoInstruments: DashboardInstrument[] = INSTRUMENTS
  .filter((instrument) => instrument.type === 'INDEX' || instrument.type === 'STOCK')
  .map((instrument) => ({
    symbol: instrument.symbol,
    name: instrument.name,
    category: 'FNO' as const,
    state: 'AVAILABLE' as const,
    exchange: 'NSE',
    segment: 'FNO',
  }));

const commodityInstruments: DashboardInstrument[] = [
  { symbol: 'COPPER', name: 'Copper', category: 'COMMODITIES', state: 'CONNECTED' },
  { symbol: 'CRUDEOILM', name: 'Crude Oil Mini', category: 'COMMODITIES', state: 'CONNECTED' },
  { symbol: 'CRUDEOIL', name: 'Crude Oil', category: 'COMMODITIES', state: 'PLANNED' },
  { symbol: 'NATGAS', name: 'Natural Gas', category: 'COMMODITIES', state: 'PLANNED' },
  { symbol: 'SILVER', name: 'Silver', category: 'COMMODITIES', state: 'PLANNED' },
  { symbol: 'GOLD', name: 'Gold', category: 'COMMODITIES', state: 'PLANNED' },
];

const cryptoInstruments: DashboardInstrument[] = [
  { symbol: 'BTC', name: 'Bitcoin', category: 'CRYPTO', state: 'CONNECTED' },
  { symbol: 'ETH', name: 'Ethereum', category: 'CRYPTO', state: 'PLANNED' },
  { symbol: 'XAUT', name: 'Tether Gold', category: 'CRYPTO', state: 'PLANNED' },
];

export const DASHBOARD_UNIVERSE: DashboardUniverse = {
  FNO: fnoInstruments,
  COMMODITIES: commodityInstruments,
  CRYPTO: cryptoInstruments,
};

export const MARKET_CATEGORY_LABELS: Record<MarketCategory, string> = {
  FNO: 'F&O',
  COMMODITIES: 'Commodities',
  CRYPTO: 'Crypto',
};

export function defaultInstrument(category: MarketCategory, universe: DashboardUniverse = DASHBOARD_UNIVERSE): DashboardInstrument {
  const preferred = category === 'COMMODITIES' ? 'COPPER' : category === 'CRYPTO' ? 'BTC' : 'NIFTY';
  const rows = universe[category]?.length ? universe[category] : DASHBOARD_UNIVERSE[category];
  return rows.find((item) => item.symbol === preferred) ?? rows[0];
}

export function findDashboardInstrument(category: MarketCategory, symbol: string, universe: DashboardUniverse = DASHBOARD_UNIVERSE): DashboardInstrument {
  const rows = universe[category]?.length ? universe[category] : DASHBOARD_UNIVERSE[category];
  return rows.find((item) => item.symbol === symbol) ?? defaultInstrument(category, universe);
}

export function withRemoteCategory(
  universe: DashboardUniverse,
  category: MarketCategory,
  rows: Array<Partial<DashboardInstrument>> | undefined,
): DashboardUniverse {
  if (!rows?.length) return universe;
  const normalized = rows.flatMap((row): DashboardInstrument[] => {
    const symbol = String(row.symbol ?? '').trim().toUpperCase();
    if (!symbol) return [];
    const rawState = String(row.state ?? 'AVAILABLE').toUpperCase();
    const state: WorkspaceState = rawState === 'CONNECTED' || rawState === 'PLANNED' ? rawState : 'AVAILABLE';
    return [{
      symbol,
      name: String(row.name ?? symbol).trim() || symbol,
      category,
      state,
      exchange: row.exchange ? String(row.exchange) : undefined,
      segment: row.segment ? String(row.segment) : undefined,
    }];
  });
  return normalized.length ? { ...universe, [category]: normalized } : universe;
}
