import { useMemo, useState } from 'react';
import { ArrowRight, FlaskConical, LineChart, ScanLine } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { CryptoBtcDashboardPanel } from '@/components/CryptoBtcDashboardPanel';
import { DashboardMarketSelector } from '@/components/DashboardMarketSelector';
import { Dashboard } from '@/pages/Dashboard';
import type { PageKey } from '@/components/Sidebar';
import {
  defaultInstrument,
  findDashboardInstrument,
  type DashboardInstrument,
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

function savedInstrument(category: MarketCategory): DashboardInstrument {
  try {
    const symbol = window.localStorage.getItem(`${SYMBOL_KEY_PREFIX}${category}`);
    if (symbol) return findDashboardInstrument(category, symbol);
  } catch { /* localStorage may be unavailable */ }
  return defaultInstrument(category);
}

export function MarketBrainDashboard({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  const [category, setCategory] = useState<MarketCategory>(() => savedCategory());
  const [symbols, setSymbols] = useState<Record<MarketCategory, string>>(() => ({
    FNO: savedInstrument('FNO').symbol,
    COMMODITIES: savedInstrument('COMMODITIES').symbol,
    CRYPTO: savedInstrument('CRYPTO').symbol,
  }));

  const instrument = useMemo(() => findDashboardInstrument(category, symbols[category]), [category, symbols]);

  const select = (nextCategory: MarketCategory, symbol: string) => {
    const nextInstrument = findDashboardInstrument(nextCategory, symbol);
    setCategory(nextCategory);
    setSymbols((current) => ({ ...current, [nextCategory]: nextInstrument.symbol }));
    try {
      window.localStorage.setItem(CATEGORY_KEY, nextCategory);
      window.localStorage.setItem(`${SYMBOL_KEY_PREFIX}${nextCategory}`, nextInstrument.symbol);
    } catch { /* selection still works without persistence */ }
  };

  return <div className="space-y-5">
    <DashboardMarketSelector category={category} instrument={instrument} onSelect={select} />
    {category === 'FNO' && <FnoWorkspace instrument={instrument} onNavigate={onNavigate} />}
    {category === 'COMMODITIES' && <CommodityWorkspace instrument={instrument} onNavigate={onNavigate} />}
    {category === 'CRYPTO' && <CryptoWorkspace instrument={instrument} />}
  </div>;
}

function FnoWorkspace({ instrument, onNavigate }: { instrument: DashboardInstrument; onNavigate: (page: PageKey) => void }) {
  return <Card>
    <CardHeader
      title={`F&O — ${instrument.name}`}
      subtitle="The category is now isolated from commodity and crypto research. Existing F&O tools remain available while the per-instrument Market Brain dashboard is wired next."
      action={<Badge variant="blue">{instrument.symbol}</Badge>}
    />
    <CardBody className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <WorkspaceAction title="Markets" detail="Watchlists and instrument view" icon={<LineChart size={18}/>} onClick={() => onNavigate('markets')} />
        <WorkspaceAction title="Trade Scanner" detail="F&O setup discovery" icon={<ScanLine size={18}/>} onClick={() => onNavigate('trade-scanner')} />
        <WorkspaceAction title="Backtest" detail="Historical strategy validation" icon={<FlaskConical size={18}/>} onClick={() => onNavigate('backtest')} />
      </div>
      <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 text-xs text-slate-500">
        Selected instrument: <span className="font-semibold text-slate-800 dark:text-slate-200">{instrument.symbol} — {instrument.name}</span>. No commodity or crypto result is shown in this workspace.
      </div>
    </CardBody>
  </Card>;
}

function CommodityWorkspace({ instrument, onNavigate }: { instrument: DashboardInstrument; onNavigate: (page: PageKey) => void }) {
  if (instrument.state !== 'CONNECTED') {
    return <PlannedWorkspace category="Commodities" instrument={instrument} />;
  }
  return <div className="space-y-3">
    <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/20 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
      <div><p className="text-sm font-semibold">Commodity workspace · {instrument.name}</p><p className="text-[11px] text-slate-500 mt-0.5">Current live research is wired for Copper and Crude Oil Mini. Shared-brain diagnostics remain visible together where they are intentionally comparative.</p></div>
      <Badge variant="green">CONNECTED</Badge>
    </div>
    <Dashboard onNavigate={onNavigate} />
  </div>;
}

function CryptoWorkspace({ instrument }: { instrument: DashboardInstrument }) {
  if (instrument.symbol !== 'BTC' || instrument.state !== 'CONNECTED') {
    return <PlannedWorkspace category="Crypto" instrument={instrument} />;
  }
  return <CryptoBtcDashboardPanel />;
}

function PlannedWorkspace({ category, instrument }: { category: string; instrument: DashboardInstrument }) {
  return <Card>
    <CardHeader title={`${category} — ${instrument.name}`} subtitle="Instrument is present in the new dashboard universe, but its live AlphaPilot research pipeline is not connected yet." action={<Badge variant="default">PLANNED</Badge>} />
    <CardBody>
      <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">{instrument.symbol} is ready in navigation</p>
        <p className="text-xs text-slate-500 mt-1">AlphaPilot will not display mock live results for this instrument. We can connect its genuine data + Market Brain pipeline when we expand this category.</p>
      </div>
    </CardBody>
  </Card>;
}

function WorkspaceAction({ title, detail, icon, onClick }: { title: string; detail: string; icon: React.ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4 text-left hover:border-blue-400 dark:hover:border-blue-700 transition-colors bg-white dark:bg-slate-900">
    <div className="flex items-center justify-between gap-3"><div className="text-blue-600">{icon}</div><ArrowRight size={16} className="text-slate-400"/></div>
    <p className="text-sm font-semibold mt-3 text-slate-900 dark:text-white">{title}</p>
    <p className="text-[11px] text-slate-500 mt-1">{detail}</p>
  </button>;
}
