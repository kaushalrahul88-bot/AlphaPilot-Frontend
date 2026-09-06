import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowRight, FlaskConical, LineChart, ScanLine } from 'lucide-react';
import { Badge, Card, CardBody, CardHeader } from '@/components/ui';
import { CommodityInstrumentDashboardPanel } from '@/components/CommodityInstrumentDashboardPanel';
import { CryptoBtcDashboardPanel } from '@/components/CryptoBtcDashboardPanel';
import { DashboardMarketSelector } from '@/components/DashboardMarketSelector';
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
    {category === 'FNO' && <FnoWorkspace instrument={instrument} onNavigate={onNavigate} universeStatus={universeStatus} />}
    {category === 'COMMODITIES' && <CommodityWorkspace instrument={instrument} />}
    {category === 'CRYPTO' && <CryptoWorkspace instrument={instrument} />}
  </div>;
}

function FnoWorkspace({ instrument, onNavigate, universeStatus }: { instrument: DashboardInstrument; onNavigate: (page: PageKey) => void; universeStatus: string }) {
  return <Card>
    <CardHeader
      title={`F&O — ${instrument.name}`}
      subtitle="Current NSE derivatives underlyings are loaded from Groww's documented instrument master. F&O remains isolated from Commodity and Crypto research."
      action={<div className="flex gap-2"><Badge variant={universeStatus === 'LIVE UNIVERSE' ? 'green' : 'amber'}>{universeStatus}</Badge><Badge variant="blue">{instrument.symbol}</Badge></div>}
    />
    <CardBody className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <WorkspaceAction title="Markets" detail="Watchlists and instrument view" icon={<LineChart size={18}/>} onClick={() => onNavigate('markets')} />
        <WorkspaceAction title="Trade Scanner" detail="F&O setup discovery" icon={<ScanLine size={18}/>} onClick={() => onNavigate('trade-scanner')} />
        <WorkspaceAction title="Backtest" detail="Historical strategy validation" icon={<FlaskConical size={18}/>} onClick={() => onNavigate('backtest')} />
      </div>
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-500">
        Selected underlying: <span className="font-semibold text-slate-800 dark:text-slate-200">{instrument.symbol} — {instrument.name}</span>. The dropdown selection does not create a trade; each Market Brain route still has to pass its own evidence and data gates.
      </div>
    </CardBody>
  </Card>;
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

function WorkspaceAction({ title, detail, icon, onClick }: { title: string; detail: string; icon: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-blue-400 dark:hover:border-blue-700 transition-colors bg-white dark:bg-slate-900">
    <div className="flex items-center justify-between gap-3"><div className="text-blue-600">{icon}</div><ArrowRight size={16} className="text-slate-400"/></div>
    <p className="text-sm font-semibold mt-3 text-slate-900 dark:text-white">{title}</p>
    <p className="text-[11px] text-slate-500 mt-1">{detail}</p>
  </button>;
}
