import { useCallback, useEffect, useState } from 'react';
import { Brain, Microscope, RefreshCw, ShieldCheck } from 'lucide-react';
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
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const contract = copper?.contract;
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

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard label="Current Mind v1" value="FROZEN" subvalue="Holdout validation required for learning" accent="blue" icon={<ShieldCheck size={20}/>} />
      <StatCard label="Replay" value={replayStatus} subvalue={replay ? `${replay.evaluated_clicks}/${replay.scheduled_clicks} clicks` : 'Open audit to unlock'} accent={replayStatus === 'COMPLETED' ? 'green' : 'amber'} />
      <StatCard label="Data Integrity" value={integrity} subvalue={parityPass === true ? 'Stored = Groww' : 'Audit evidence'} accent={integrity === 'VERIFIED' ? 'green' : 'amber'} />
      <StatCard label="Copper" value={String(contract?.trading_symbol ?? replay?.reference_contract ?? 'Resolving…')} subvalue={health?.provider ?? 'Checking provider'} accent="blue" />
    </div>

    <Card>
      <CardHeader title="Current Mind Replay" subtitle="The primary research scorecard. Structural underlying R only — never fabricated historical option P&L." action={<Badge variant={replayStatus === 'COMPLETED' ? 'green' : replayStatus === 'RUNNING' ? 'amber' : 'default'}>{replayStatus}</Badge>} />
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
        </div> : <div className="flex items-center justify-between gap-4 flex-wrap rounded-lg border border-slate-200 dark:border-slate-800 p-4">
          <div><p className="text-sm font-semibold">Replay metrics are protected</p><p className="text-xs text-slate-500 mt-1">Unlock Current Mind Audit once in this browser tab to surface the latest scorecard here.</p></div>
          <Button size="sm" variant="primary" onClick={() => onNavigate('current-mind-audit')}>Open Audit</Button>
        </div>}
      </CardBody>
    </Card>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card>
        <CardHeader title="Evidence Integrity" subtitle="Only evidence that can legitimately influence the replay." />
        <CardBody><div className="grid grid-cols-2 gap-3">
          <Metric label="Stored MCX Data" value={dataPass == null ? 'LOCKED' : dataPass ? 'PASS' : 'REVIEW'} good={dataPass === true}/>
          <Metric label="Groww Parity" value={parityPass == null ? 'LOCKED' : parityPass ? 'PASS' : 'REVIEW'} good={parityPass === true}/>
          <Metric label="China Macro PIT" value={replay?.data_context?.china_macro_point_in_time ? 'AVAILABLE' : '—'} good={replay?.data_context?.china_macro_point_in_time === true}/>
          <Metric label="Historical News" value={replay?.data_context?.historical_news ? 'AUDITED / USED' : 'AUDIT PENDING'} />
        </div>
        <Button size="sm" variant="ghost" className="w-full mt-3" onClick={() => onNavigate('current-mind-audit')}><Microscope size={14} className="inline mr-1.5"/>Inspect Evidence &amp; Clicks</Button>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Decision Discipline" subtitle="What the system is allowed to do." action={<Badge variant="blue">MARKET BRAIN → OPTION BRAIN</Badge>} />
        <CardBody className="space-y-3">
          <Rule title="Market Brain" detail="Forms the Copper underlying thesis from point-in-time, leakage-safe evidence." />
          <Rule title="Option Brain" detail="Expresses a valid bullish/bearish thesis as CE/PE using genuine option data only." />
          <Rule title="Abstention is valid" detail="WAIT / NO TRADE are investigated when followed by large moves; they are not automatically errors." />
          <Rule title="Learning is guarded" detail="No rule change is accepted because it improves this replay alone; it must survive holdout validation." />
        </CardBody>
      </Card>
    </div>

    <Card>
      <CardHeader title="Next Required Action" subtitle="Keep the dashboard action-oriented instead of duplicating diagnostic pages." />
      <CardBody>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-semibold">{replayStatus === 'RUNNING' ? 'Wait for the active replay/audit to complete' : integrity === 'REVIEW' ? 'Resolve evidence-integrity discrepancy before interpreting performance' : 'Use Current Mind Audit for the next forensic review'}</p>
            <p className="text-xs text-slate-500 mt-1">Detailed contracts, provider diagnostics, system health, raw click tables and backtest controls stay in their dedicated pages rather than cluttering Market Brain.</p>
          </div>
          <Button variant="primary" onClick={() => onNavigate('current-mind-audit')}>Current Mind Audit</Button>
        </div>
      </CardBody>
    </Card>

    <p className="text-[11px] text-slate-400 text-center pb-3">Research and decision-support only. Backtest results do not guarantee future trading performance.</p>
  </div>;
}

function Rule({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><p className="text-sm font-semibold">{title}</p><p className="text-xs text-slate-500 mt-1">{detail}</p></div>;
}
function Metric({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return <div className={`rounded-lg border p-3 ${good ? 'border-emerald-200 dark:border-emerald-900 bg-emerald-50/30 dark:bg-emerald-950/10' : 'border-slate-200 dark:border-slate-800'}`}><p className="text-[10px] text-slate-500">{label}</p><p className="text-sm font-semibold mt-1 break-all">{value}</p></div>;
}
