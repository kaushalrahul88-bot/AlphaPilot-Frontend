import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, CardBody, CardHeader } from '@/components/ui';
import { CommodityInstrumentDashboardPanel } from '@/components/CommodityInstrumentDashboardPanel';
import { CryptoBtcDashboardPanel } from '@/components/CryptoBtcDashboardPanel';
import { DashboardMarketSelector } from '@/components/DashboardMarketSelector';
import { FnoInstrumentDashboardPanel } from '@/components/FnoInstrumentDashboardPanel';
import type { PageKey } from '@/components/Sidebar';
import { getDashboardUniverse } from '@/lib/dashboardUniverseApi';
import {
  DASHBOARD_UNIVERSE,
  defaultInstrument,
  findDashboardInstrument,
  type DashboardInstrument,
  type DashboardUniverse,
  type MarketCategory,
} from '@/lib/dashboardUniverse';

const CATEGORY_KEY = 'alphapilot.dashboard.category';
const SYMBOL_KEY_PREFIX = 'alphapilot.dashboard.symbol.';

function savedCategory(): MarketCategory {
  try {
    const value = window.localStorage.getItem(CATEGORY_KEY);
    if (value === 'FNO' || value === 'COMMODITIES' || value === 'CRYPTO') return value;
  } catch { /* localStorage may be unavailable */ }
  return 'COMMODITIES';
}

function savedSymbol(category: MarketCategory): string {
  try {
    const symbol = window.localStorage.getItem(`${SYMBOL_KEY_PREFIX}${category}`);
    if (symbol) return symbol;
  } catch { /* localStorage may be unavailable */ }
  return defaultInstrument(category).symbol;
}

export function MarketBrainDashboard({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  const [category, setCategory] = useState<MarketCategory>(() => savedCategory());
  const [symbols, setSymbols] = useState<Record<MarketCategory, string>>(() => ({
    FNO: savedSymbol('FNO'),
    COMMODITIES: savedSymbol('COMMODITIES'),
    CRYPTO: savedSymbol('CRYPTO'),
  }));
  const [universe, setUniverse] = useState<DashboardUniverse>(DASHBOARD_UNIVERSE);
  const [universeStatus, setUniverseStatus] = useState('LOADING UNIVERSE');

  useEffect(() => {
    let active = true;
    void getDashboardUniverse()
      .then((loaded) => {
        if (!active) return;
        setUniverse(loaded.universe);
        setUniverseStatus(loaded.status === 'ACTIVE' ? 'LIVE UNIVERSE' : loaded.status.replaceAll('_', ' '));
        setSymbols((current) => ({
          FNO: findDashboardInstrument('FNO', current.FNO, loaded.universe).symbol,
          COMMODITIES: findDashboardInstrument('COMMODITIES', current.COMMODITIES, loaded.universe).symbol,
          CRYPTO: findDashboardInstrument('CRYPTO', current.CRYPTO, loaded.universe).symbol,
        }));
      })
      .catch(() => {
        if (active) setUniverseStatus('FALLBACK UNIVERSE');
      });
    return () => { active = false; };
  }, []);

  const instrument = useMemo(() => findDashboardInstrument(category, symbols[category], universe), [category, symbols, universe]);

  const select = (nextCategory: MarketCategory, symbol: string) => {
    const nextInstrument = findDashboardInstrument(nextCategory, symbol, universe);
    setCategory(nextCategory);
    setSymbols((current) => ({ ...current, [nextCategory]: nextInstrument.symbol }));
    try {
      window.localStorage.setItem(CATEGORY_KEY, nextCategory);
      window.localStorage.setItem(`${SYMBOL_KEY_PREFIX}${nextCategory}`, nextInstrument.symbol);
    } catch { /* selection still works without persistence */ }
  };

  return <div className="space-y-5">
    <DashboardMarketSelector category={category} instrument={instrument} selectedSymbols={symbols} universe={universe} universeStatus={universeStatus} onSelect={select} />
    {category === 'FNO' && <FnoWorkspace instrument={instrument} onNavigate={onNavigate} />}
    {category === 'COMMODITIES' && <CommodityWorkspace instrument={instrument} />}
    {category === 'CRYPTO' && <CryptoWorkspace instrument={instrument} />}
  </div>;
}

function FnoWorkspace({ instrument, onNavigate }: { instrument: DashboardInstrument; onNavigate: (page: PageKey) => void }) {
  if (instrument.state !== 'CONNECTED') {
    return <Card>
      <CardHeader
        title={`F&O — ${instrument.name}`}
        subtitle="This is a current NSE F&O underlying from Groww's live instrument master, but AlphaPilot's existing live scanner does not yet map this symbol."
        action={<div className="flex gap-2"><Badge variant="blue">CURRENT F&O</Badge><Badge variant="default">CATALOG ONLY</Badge></div>}
      />
      <CardBody>
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{instrument.symbol} is available in the F&O universe</p>
          <p className="text-xs text-slate-500 mt-1">No frontend mock quote or fabricated option setup is shown. The live Groww scan mapping must be added before this instrument gets a connected Market Brain panel.</p>
        </div>
      </CardBody>
    </Card>;
  }
  return <FnoInstrumentDashboardPanel
    instrument={instrument}
    onOpenScanner={() => onNavigate('trade-scanner')}
    onOpenBacktest={() => onNavigate('backtest')}
  />;
}

function CommodityWorkspace({ instrument }: { instrument: DashboardInstrument }) {
  if (instrument.state !== 'CONNECTED') return <PlannedWorkspace category="Commodities" instrument={instrument} />;
  if (instrument.symbol !== 'COPPER' && instrument.symbol !== 'CRUDEOILM') return <PlannedWorkspace category="Commodities" instrument={instrument} />;
  return <CommodityInstrumentDashboardPanel instrument={instrument} />;
}

function CryptoWorkspace({ instrument }: { instrument: DashboardInstrument }) {
  if (instrument.symbol !== 'BTC' || instrument.state !== 'CONNECTED') return <PlannedWorkspace category="Crypto" instrument={instrument} />;
  return <CryptoBtcDashboardPanel />;
}

function PlannedWorkspace({ category, instrument }: { category: string; instrument: DashboardInstrument }) {
  return <Card>
    <CardHeader title={`${category} — ${instrument.name}`} subtitle="Instrument is present in the dashboard universe, but its live AlphaPilot research pipeline is not connected yet." action={<Badge variant="default">PLANNED</Badge>} />
    <CardBody>
      <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{instrument.symbol} is ready in navigation</p>
        <p className="text-xs text-slate-500 mt-1">AlphaPilot will not display mock live results for this instrument. Its genuine data and Market Brain pipeline must be connected before results appear here.</p>
      </div>
    </CardBody>
  </Card>;
}
