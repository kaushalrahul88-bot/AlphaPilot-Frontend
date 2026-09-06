import { INSTRUMENTS } from '@/lib/marketData';

export type MarketCategory = 'FNO' | 'COMMODITIES' | 'CRYPTO';
export type WorkspaceState = 'CONNECTED' | 'AVAILABLE' | 'PLANNED';

export interface DashboardInstrument {
  symbol: string;
  name: string;
  category: MarketCategory;
  state: WorkspaceState;
}

const fnoInstruments: DashboardInstrument[] = INSTRUMENTS
  .filter((instrument) => instrument.type === 'INDEX' || instrument.type === 'STOCK')
  .map((instrument) => ({
    symbol: instrument.symbol,
    name: instrument.name,
    category: 'FNO' as const,
    state: 'AVAILABLE' as const,
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

export const DASHBOARD_UNIVERSE: Record<MarketCategory, DashboardInstrument[]> = {
  FNO: fnoInstruments,
  COMMODITIES: commodityInstruments,
  CRYPTO: cryptoInstruments,
};

export const MARKET_CATEGORY_LABELS: Record<MarketCategory, string> = {
  FNO: 'F&O',
  COMMODITIES: 'Commodities',
  CRYPTO: 'Crypto',
};

export function defaultInstrument(category: MarketCategory): DashboardInstrument {
  const preferred = category === 'COMMODITIES' ? 'COPPER' : category === 'CRYPTO' ? 'BTC' : 'NIFTY';
  return DASHBOARD_UNIVERSE[category].find((item) => item.symbol === preferred) ?? DASHBOARD_UNIVERSE[category][0];
}

export function findDashboardInstrument(category: MarketCategory, symbol: string): DashboardInstrument {
  return DASHBOARD_UNIVERSE[category].find((item) => item.symbol === symbol) ?? defaultInstrument(category);
}
