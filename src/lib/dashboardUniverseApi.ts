import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';
import {
  DASHBOARD_UNIVERSE,
  withRemoteCategory,
  type DashboardInstrument,
  type DashboardUniverse,
  type MarketCategory,
} from '@/lib/dashboardUniverse';

interface DashboardUniverseResponse {
  status?: string;
  generated_at?: string;
  source?: { fno?: string };
  categories?: Partial<Record<MarketCategory, Array<Partial<DashboardInstrument>>>>;
  counts?: Partial<Record<MarketCategory, number>>;
}

export interface LoadedDashboardUniverse {
  universe: DashboardUniverse;
  status: string;
  source?: string;
  generatedAt?: string;
  counts: Record<MarketCategory, number>;
}

export async function getDashboardUniverse(): Promise<LoadedDashboardUniverse> {
  const response = await fetch(`${ALPHAPILOT_API_BASE}/v1/dashboard/market-universe`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Dashboard universe API ${response.status}`);
  }
  const payload = await response.json() as DashboardUniverseResponse;
  let universe = DASHBOARD_UNIVERSE;
  universe = withRemoteCategory(universe, 'FNO', payload.categories?.FNO);
  universe = withRemoteCategory(universe, 'COMMODITIES', payload.categories?.COMMODITIES);
  universe = withRemoteCategory(universe, 'CRYPTO', payload.categories?.CRYPTO);
  return {
    universe,
    status: payload.status ?? 'ACTIVE',
    source: payload.source?.fno,
    generatedAt: payload.generated_at,
    counts: {
      FNO: universe.FNO.length,
      COMMODITIES: universe.COMMODITIES.length,
      CRYPTO: universe.CRYPTO.length,
    },
  };
}
