import { useCallback, useEffect, useState } from 'react';
import { Activity, Brain, Database, FlaskConical, Gauge, Microscope, RefreshCw, ScanLine, Server, ShieldCheck } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, StatCard } from '@/components/ui';
import { getHealth } from '@/lib/alphaPilotApi';
import { getCommodityProbe, type CommodityProbeResponse } from '@/lib/commodityApi';
import { getCurrentMindDataIntegrity, getCurrentMindProviderParity, getCurrentMindReplayStatus, readCurrentMindToken, type CurrentMindReplay, type DataIntegrityAudit, type ProviderParityAudit } from '@/lib/currentMindAuditApi';
import type { PageKey } from '@/components/Sidebar';

type Health = Awaited<ReturnType<typeof getHealth>>;

export function Dashboard({ onNavigate }: { onNavigate: (p: PageKey) => void }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [copper, setCopper] = useState<CommodityProbeResponse | null>(null);
  const [replay, setReplay] = useState<CurrentMindReplay | null>(null);
  const [dataAudit, setDataAudit] = useState<DataIntegrityAudit | null>(null);
  const [parity, setParity] = useState<ProviderParityAudit | null>(null);
  const [replayStatus, setReplayStatus] = useState('NOT LOADED');
  const [loading, setLoading] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const failures: string[] = [];
    const [healthResult, copperResult] = await Promise.allSettled([getHealth(), getCommodityProbe('COPPER')]);
    if (healthResult.status === 'fulfilled') setHealth(healthResult.value);
    else failures.push('Backend health unavailable');
    if (copperResult.status === 'fulfilled') setCopper(copperResult.value);
    else failures.push('Copper probe unavailable');

    const token = readCurrentMindToken();
    if (token) {
      const [jobResult, dataResult, parityResult] = await Promise.allSettled([
        getCurrentMindReplayStatus(token),
        getCurrentMindDataIntegrity(token),
        getCurrentMindProviderParity(token),
      ]);
      if (jobResult.status === 'fulfilled') {
        setReplayStatus(jobResult.value.status);
        setReplay(jobResult.value.result ?? null);
      } else failures.push('Current Mind status unavailable');
      if (dataResult.status === 'fulfilled') setDataAudit(dataResult.value);
      else failures.push('Data integrity unavailable');
      if (parityResult.status === 'fulfilled') setParity(parityResult.value);
      else failures.push('Provider parity unavailable');
    } else {
      setReplayStatus('AUDIT TOKEN REQUIRED');
      setReplay(null);
      setDataAudit(null);
      setParity(null);
    }

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
  const dataPass = dataAudit ? Object.values(dataAudit.checks).every(Boolean) : null;
  const parityPass = parity ? Object.values(parity.checks).every(Boolean) : null;
  const integrity = dataPass === true && parityPass === true ? 'VERIFIED' : dataPass === false || parityPass === false ? 'REVIEW' : 'LOCKED';
  const actions = replay?.actions ?? {};

  return <div className="space-y-5">
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <div className="flex items-center gap-2"><Brain size={24} className="text-blue-600"/><h1 className="text-xl font-bold text-slate-900 dark:text-white">Market Brain</h1></div>
        <p className="text-sm text-slate-500 mt-1">Copper decision-system command center — validate the information, form the thesis, then express it through options.</p>
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} className={`inline mr-1.5 ${loading ? 'animate-spin' : ''}`}/>{loading ? 'Refreshing…' : 'Refresh'}</Button>
        <Button variant="primary" onClick={() => onNavigate('current-mind-audit')}><Microscope size={15} className="inline mr-1.5"/>Current Mind Audit</Button>
      </div>
    </div>

    {error && <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs text-amber-700 dark:text-amber-300">{error}</div>}

    <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
      <StatCard label="Backend API" value={apiReady ? 'ONLINE' : health ? 'DEGRADED' : 'CHECKING'} accent={apiReady ? 'green' : 'amber'} icon={<Server size={20}/>} />
      <StatCard label="Market Provider" value={health?.provider ?? '—'} accent="blue" icon={<Activity size={20}/>} />
      <StatCard label="Research Memory" value={collectorEnabled ? 'PERSISTENT' : health ? 'DISABLED' : 'CHECKING'} accent={collectorEnabled ? 'green' : 'amber'} icon={<Database size={20}/>} />
      <StatCard label="Data Integrity" value={integrity} subvalue={parityPass === true ? 'Stored = Groww' : 'Open audit for details'} accent={integrity === 'VERIFIED' ? 'green' : 'amber'} icon={<Gauge size={20}/>} />
      <StatCard label="Current Mind v1" value="FROZEN" subvalue="Learning requires holdout validation" accent="blue" icon={<ShieldCheck size={20}/>} />
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <Card className="xl:col-span-2">
        <CardHeader title="Frozen Current Mind Replay" subtitle="Underlying structural-R research only; not historical option-premium P&L." action={<Badge variant={replayStatus === 'COMPLETED' ? 'green' : replayStatus === 'RUNNING' ? 'amber' : 'default'}>{replayStatus}</Badge>} />
        <CardBody>
          {replay ? <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
              <Metric label="Clicks" value={`${replay.evaluated_clicks}/${replay.scheduled_clicks}`} good={replay.click_coverage_exact === true} />
              <Metric label="BUY CE" value={String(actions.BUY_CE ?? 0)} />
              <Metric label="BUY PE" value={String(actions.BUY_PE ?? 0)} />
              <Metric label="WAIT" value={String(actions.WAIT ?? 0)} />
              <Metric label="NO TRADE" value={String(actions.NO_TRADE ?? 0)} />
              <Metric label="Targets / Stops" value={`${replay.targets} / ${replay.stops}`} />
              <Metric label="Expectancy" value={replay.expectancy_r_resolved == null ? '—' : `${replay.expectancy_r_resolved.toFixed(3)}R`} />
              <Metric label="Missed Moves" value={String(replay.missed_large_moves_after_abstention)} />
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant={replay.click_coverage_exact ? 'green' : 'red'}>{replay.click_coverage_exact ? 'EXACT CLICK COVERAGE' : 'COVERAGE REVIEW'}</Badge>
              <Badge variant="blue">{replay.complete_sessions} COMPLETE SESSIONS</Badge>
              <Badge variant="default">AUG 27/28 PARTIAL EXCLUDED</Badge>
              <Badge variant="amber">NO FABRICATED OPTION P&amp;L</Badge>
            </div>
          </div> : <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-sm font-semibold">Replay metrics are protected research data</p>
            <p className="text-xs text-slate-500 mt-1">Open Current Mind Audit once in this tab and enter the audit token. The dashboard will then surface the latest replay state and metrics.</p>
            <Button size="sm" variant="ghost" className="mt-3" onClick={() => onNavigate('current-mind-audit')}>Open Current Mind Audit</Button>
          </div>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Copper Ground Truth" subtitle="Contract and data used by Market Brain" action={<Badge variant={copperReady ? 'green' : 'blue'}>{copperReady ? 'READY' : 'RESEARCH'}</Badge>} />
        <CardBody className="space-y-3">
          <Metric label="Contract" value={String(contract?.trading_symbol ?? replay?.reference_contract ?? 'Resolving…')} />
          <Metric label="Expiry" value={String(contract?.expiry_date ?? contract?.expiry ?? '—')} />
          <Metric label="Candles" value={Number.isFinite(candleCount) && candleCount > 0 ? String(candleCount) : replay ? String(replay.candles) : '—'} />
          <Metric label="Provider" value={String(copper?.provider ?? health?.provider ?? '—')} />
          <div className="grid grid-cols-2 gap-2">
            <Metric label="Stored Data" value={dataPass == null ? 'LOCKED' : dataPass ? 'PASS' : 'REVIEW'} good={dataPass === true}/>
            <Metric label="Groww Parity" value={parityPass == null ? 'LOCKED' : parityPass ? 'PASS' : 'REVIEW'} good={parityPass === true}/>
          </div>
        </CardBody>
      </Card>
    </div>

    <Card>
      <CardHeader title="Decision Architecture" subtitle="AlphaPilot is a disciplined option-trading decision system, not a prediction machine." action={<Badge variant="blue">THESIS → OPTION EXPRESSION</Badge>} />
      <CardBody>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <ProcessStep number="1" title="Perceive" detail="MCX structure, volume and point-in-time context" />
          <ProcessStep number="2" title="Remember" detail="Leakage-safe experience available only after historical outcomes resolve" />
          <ProcessStep number="3" title="Form Thesis" detail="Market Brain chooses bullish, bearish, WAIT or NO TRADE" />
          <ProcessStep number="4" title="Express" detail="Option Brain uses genuine CE/PE data only; no synthetic premium assumptions" />
        </div>
        <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-800 p-4">
          <p className="text-sm font-semibold">Research discipline</p>
          <p className="text-xs text-slate-500 mt-1">Stops and missed moves are investigated before rules change. Any learning change must survive guarded holdout validation rather than merely improve this replay sample.</p>
        </div>
      </CardBody>
    </Card>

    <Card>
      <CardHeader title="Primary Workspaces" subtitle="The current AlphaPilot workflow" />
      <CardBody><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <Workspace icon={<Microscope size={18}/>} title="Current Mind Audit" detail="Inspect every deterministic click and outcome" onClick={() => onNavigate('current-mind-audit')} />
        <Workspace icon={<FlaskConical size={18}/>} title="Research & Backtest" detail="Controlled historical validation" onClick={() => onNavigate('commodity-backtest')} />
        <Workspace icon={<Gauge size={18}/>} title="Commodity Data" detail="Contracts, candles and diagnostics" onClick={() => onNavigate('commodity-diagnostics')} />
        <Workspace icon={<Activity size={18}/>} title="Live Validation" detail="Forward-test without live execution" onClick={() => onNavigate('live-validation')} />
        <Workspace icon={<ScanLine size={18}/>} title="Trade Scanner" detail="Live setup expression after all gates" onClick={() => onNavigate('trade-scanner')} />
      </div></CardBody>
    </Card>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader title="Information Coverage" subtitle="Unavailable information stays unavailable; it never becomes directional evidence."/>
        <CardBody><div className="grid grid-cols-2 gap-3">
          <Metric label="MCX 5m" value={replay?.data_context?.mcx_5m ? 'AVAILABLE' : '—'} good={replay?.data_context?.mcx_5m === true}/>
          <Metric label="China Macro PIT" value={replay?.data_context?.china_macro_point_in_time ? 'AVAILABLE' : '—'} good={replay?.data_context?.china_macro_point_in_time === true}/>
          <Metric label="Historical News" value={replay?.data_context?.historical_news ? 'AVAILABLE' : 'INTEGRITY AUDIT'} />
          <Metric label="Historical Option Premium" value={replay?.data_context?.historical_option_premium ? 'AVAILABLE' : 'UNAVAILABLE'} />
        </div></CardBody>
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

    <p className="text-[11px] text-slate-400 text-center pb-3">Research and decision-support only. Backtest results do not guarantee future trading performance.</p>
  </div>;
}

function ProcessStep({ number, title, detail }: { number: string; title: string; detail: string }) {
  return <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/10 p-3"><div className="flex items-center gap-2"><span className="w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center bg-blue-600 text-white">{number}</span><p className="text-sm font-semibold">{title}</p></div><p className="text-[11px] text-slate-500 mt-2">{detail}</p></div>;
}
function Workspace({ icon, title, detail, onClick }: { icon: React.ReactNode; title: string; detail: string; onClick: () => void }) {
  return <button onClick={onClick} className="text-left rounded-lg border border-slate-200 dark:border-slate-800 p-4 hover:border-blue-300 dark:hover:border-blue-700 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"><div className="flex items-center gap-2 text-blue-600">{icon}<span className="text-sm font-semibold text-slate-900 dark:text-white">{title}</span></div><p className="text-xs text-slate-500 mt-2">{detail}</p></button>;
}
function Metric({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return <div className={`rounded-lg border p-3 ${good ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/10' : 'border-slate-200 dark:border-slate-800'}`}><p className="text-[10px] text-slate-500">{label}</p><p className="text-sm font-semibold mt-1 break-all">{value}</p></div>;
}
