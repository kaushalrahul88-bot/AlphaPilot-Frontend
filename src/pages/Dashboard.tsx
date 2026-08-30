import { useCallback, useEffect, useState } from 'react';
import { Activity, Brain, Database, FlaskConical, Gauge, RefreshCw, ScanLine, Server, ShieldCheck } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, StatCard } from '@/components/ui';
import { getHealth } from '@/lib/alphaPilotApi';
import { getCommodityProbe, type CommodityProbeResponse } from '@/lib/commodityApi';
import type { PageKey } from '@/components/Sidebar';

type Health = Awaited<ReturnType<typeof getHealth>>;

export function Dashboard({ onNavigate }: { onNavigate: (p: PageKey) => void }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [copper, setCopper] = useState<CommodityProbeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [healthResult, copperResult] = await Promise.allSettled([
      getHealth(),
      getCommodityProbe('COPPER'),
    ]);
    if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
    if (copperResult.status === 'fulfilled') setCopper(copperResult.value);
    const failures = [healthResult, copperResult]
      .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
      .map(result => result.reason instanceof Error ? result.reason.message : String(result.reason));
    setError(failures.length ? failures.join(' · ') : null);
    setCheckedAt(new Date().toISOString());
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const collectorEnabled = health?.commodity_collector_enabled === true;
  const apiReady = health?.ok === true;
  const copperReady = copper?.ready_for_phase1 === true;
  const contract = copper?.contract;
  const candleCount = Number(copper?.candle_count ?? (Array.isArray(copper?.candles) ? copper.candles.length : 0));

  return <div className="space-y-5">
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <div className="flex items-center gap-2">
          <Brain size={24} className="text-blue-600"/>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Market Brain</h1>
        </div>
        <p className="text-sm text-slate-500 mt-1">AlphaPilot command center — observe, store, validate, then decide.</p>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={15} className={`inline mr-1.5 ${loading ? 'animate-spin' : ''}`}/>
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
        <Button variant="primary" onClick={() => onNavigate('trade-scanner')}>
          <ScanLine size={15} className="inline mr-1.5"/>Open Scanner
        </Button>
      </div>
    </div>

    {error && <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs text-amber-700 dark:text-amber-300">{error}</div>}

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard label="Backend API" value={apiReady ? 'ONLINE' : health ? 'DEGRADED' : 'CHECKING'} accent={apiReady ? 'green' : 'amber'} icon={<Server size={20}/>} />
      <StatCard label="Market Provider" value={health?.provider ?? '—'} accent="blue" icon={<Activity size={20}/>} />
      <StatCard label="Research Memory" value={collectorEnabled ? 'PERSISTENT' : health ? 'DISABLED' : 'CHECKING'} accent={collectorEnabled ? 'green' : 'amber'} icon={<Database size={20}/>} />
      <StatCard label="Production Rules" value="FROZEN" subvalue="Research cannot self-promote" accent="blue" icon={<ShieldCheck size={20}/>} />
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-2">
        <CardHeader title="Current Market Brain Process" subtitle="Evidence-first workflow. A trade setup is the output, not the starting point." action={<Badge variant="blue">RESEARCH → VALIDATE</Badge>} />
        <CardBody>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <ProcessStep number="1" title="Observe" detail="Live + historical market data" active />
            <ProcessStep number="2" title="Store" detail="Durable PostgreSQL memory" active={collectorEnabled} />
            <ProcessStep number="3" title="Validate" detail="Chronological regime stability" active />
            <ProcessStep number="4" title="Decide" detail="Trade / no-trade after gates" active />
          </div>
          <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Research policy</p>
            <p className="text-xs text-slate-500 mt-1">No indicator, filter, or candidate rule is promoted because it looks good in one period. AlphaPilot requires repeatability across chronological windows and fresh untouched validation before a rule can advance.</p>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Copper Research" subtitle="Current commodity proving ground" action={<Badge variant={copperReady ? 'green' : 'blue'}>{copperReady ? 'DATA READY' : 'RESEARCH'}</Badge>} />
        <CardBody className="space-y-3">
          <Metric label="Contract" value={String(contract?.trading_symbol ?? 'Resolving…')} />
          <Metric label="Expiry" value={String(contract?.expiry_date ?? contract?.expiry ?? '—')} />
          <Metric label="Probe Candles" value={Number.isFinite(candleCount) && candleCount > 0 ? String(candleCount) : '—'} />
          <Metric label="Provider" value={String(copper?.provider ?? health?.provider ?? '—')} />
          <Button size="sm" variant="ghost" onClick={() => onNavigate('commodity-backtest')} className="w-full">Open Research & Backtest</Button>
        </CardBody>
      </Card>
    </div>

    <Card>
      <CardHeader title="Primary Workspaces" subtitle="Only current AlphaPilot workflows are surfaced here. Legacy experiments remain archived in code." />
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Workspace icon={<FlaskConical size={18}/>} title="Research & Backtest" detail="Commodity validation and historical evidence" onClick={() => onNavigate('commodity-backtest')} />
          <Workspace icon={<Gauge size={18}/>} title="Commodity Data" detail="Groww contracts, candles and diagnostics" onClick={() => onNavigate('commodity-diagnostics')} />
          <Workspace icon={<Activity size={18}/>} title="Live Validation" detail="Forward-test decisions without live execution" onClick={() => onNavigate('live-validation')} />
          <Workspace icon={<ShieldCheck size={18}/>} title="Risk Center" detail="Risk gates before any executable setup" onClick={() => onNavigate('risk')} />
        </div>
      </CardBody>
    </Card>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader title="What is intentionally hidden" subtitle="Old screens are no longer part of the main workflow." />
        <CardBody>
          <p className="text-xs text-slate-500">Legacy Candidate A–H validators, old setup-discovery panels, experimental Market Brain versions, mock portfolio widgets, and duplicate diagnostics are retained in the repository for audit/history but are no longer rendered as the main product experience.</p>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="System Snapshot" subtitle={checkedAt ? `Last refreshed ${new Date(checkedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })}` : 'Checking backend'} />
        <CardBody>
          <div className="grid grid-cols-2 gap-3">
            <Metric label="API Version" value={health?.version ?? '—'} />
            <Metric label="Collector" value={collectorEnabled ? 'Enabled' : health ? 'Disabled' : '—'} />
            <Metric label="Copper Probe" value={copperReady ? 'Ready' : copper ? 'Needs review' : '—'} />
            <Metric label="Execution" value="Rule-gated" />
          </div>
          <Button size="sm" variant="ghost" className="w-full mt-3" onClick={() => onNavigate('system-health')}>Open System Health</Button>
        </CardBody>
      </Card>
    </div>

    <p className="text-[11px] text-slate-400 text-center pb-3">AlphaPilot provides research and decision-support tooling. Research results do not guarantee future trading performance.</p>
  </div>;
}

function ProcessStep({ number, title, detail, active }: { number: string; title: string; detail: string; active: boolean }) {
  return <div className={`rounded-lg border p-3 ${active ? 'border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/10' : 'border-slate-200 dark:border-slate-800'}`}>
    <div className="flex items-center gap-2"><span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center ${active ? 'bg-blue-600 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-500'}`}>{number}</span><p className="text-sm font-semibold">{title}</p></div>
    <p className="text-[11px] text-slate-500 mt-2">{detail}</p>
  </div>;
}

function Workspace({ icon, title, detail, onClick }: { icon: React.ReactNode; title: string; detail: string; onClick: () => void }) {
  return <button onClick={onClick} className="text-left rounded-lg border border-slate-200 dark:border-slate-800 p-4 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
    <div className="flex items-center gap-2 text-blue-600">{icon}<span className="text-sm font-semibold text-slate-900 dark:text-white">{title}</span></div>
    <p className="text-xs text-slate-500 mt-2">{detail}</p>
  </button>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><p className="text-[10px] text-slate-500">{label}</p><p className="text-sm font-semibold mt-1 break-all">{value}</p></div>;
}
