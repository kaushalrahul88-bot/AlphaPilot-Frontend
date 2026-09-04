import { useCallback, useEffect, useState } from 'react';
import { Activity, Brain, Microscope, RefreshCw, ShieldCheck, Zap } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, StatCard } from '@/components/ui';
import { getHealth } from '@/lib/alphaPilotApi';
import {
  generateCrudeMiniResult,
  getCrudeMiniResearchStatus,
  type CrudeMiniResearchStatus,
  type CrudeMiniResult,
} from '@/lib/crudeMiniApi';
import type { PageKey } from '@/components/Sidebar';

type Health = Awaited<ReturnType<typeof getHealth>>;

export function Dashboard({ onNavigate }: { onNavigate: (p: PageKey) => void }) {
  const [health, setHealth] = useState<Health | null>(null);
  const [researchStatus, setResearchStatus] = useState<CrudeMiniResearchStatus | null>(null);
  const [result, setResult] = useState<CrudeMiniResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [nextHealth, nextResearch] = await Promise.all([getHealth(), getCrudeMiniResearchStatus()]);
      setHealth(nextHealth);
      setResearchStatus(nextResearch);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AlphaPilot status unavailable');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const generate = async () => {
    setGenerating(true); setError(null);
    try {
      const nextResult = await generateCrudeMiniResult();
      setResult(nextResult);
      try { setResearchStatus(await getCrudeMiniResearchStatus()); } catch { /* result remains valid */ }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to generate AlphaPilot result');
    } finally {
      setGenerating(false);
    }
  };

  const action = result?.current_mind?.action ?? result?.status ?? 'READY';
  const option = result?.data?.option_positioning;
  const expression = result?.execution?.option_expression;
  const premiumMemory = result?.data?.option_premium_memory;
  const ledger = researchStatus?.episode_ledger;
  const validation = researchStatus?.validation;
  const progress = Math.max(0, Math.min(100, validation?.progress_pct ?? 0));
  const safe = result?.execution?.paper_signal_only === true && result?.execution?.live_execution_enabled === false && result?.execution?.broker_order_placement_enabled === false;

  return <div className="space-y-5">
    <div className="flex items-start justify-between gap-3 flex-wrap">
      <div>
        <div className="flex items-center gap-2"><Brain size={24} className="text-blue-600"/><h1 className="text-xl font-bold text-slate-900 dark:text-white">AlphaPilot Command Center</h1></div>
        <p className="text-sm text-slate-500 mt-1">F&amp;O + Commodity options intelligence. Copper Brain is retained; Crude Oil Mini Brain is the active commodity development track.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Button variant="ghost" onClick={() => void refresh()} disabled={loading}><RefreshCw size={15} className={`inline mr-1.5 ${loading ? 'animate-spin' : ''}`}/>Refresh</Button>
        <Button variant="primary" onClick={() => void generate()} disabled={generating}><Zap size={15} className="inline mr-1.5"/>{generating ? 'Generating…' : 'Generate Crude Oil Mini Result'}</Button>
      </div>
    </div>

    {error && <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs text-amber-700 dark:text-amber-300">{error}</div>}

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard label="Platform" value="F&O + COMMODITY" subvalue="Options trade expression" accent="blue" icon={<ShieldCheck size={20}/>} />
      <StatCard label="Copper Brain" value="DEVELOPED RESEARCH" subvalue="Existing commodity research track" accent="green" />
      <StatCard label="Crude Oil Mini Brain" value="FROZEN V1 · LEARNING" subvalue="CRUDEOILM prospective research" accent="amber" />
      <StatCard label="Backend" value={health?.ok ? 'ONLINE' : 'CHECKING'} subvalue={health ? `${health.provider} · v${health.version}` : 'Connecting…'} accent={health?.ok ? 'green' : 'amber'} />
    </div>

    <Card>
      <CardHeader
        title="Crude Oil Mini — Research Loop"
        subtitle="Freeze V1 → Capture → Observe outcome → Diagnose → Build memory → Validate → Improve → Holdout → Prospective → Promote"
        action={<Badge variant={researchStatus?.research_protocol?.status === 'FROZEN' ? 'green' : 'default'}>{researchStatus?.research_protocol?.status ?? 'LOADING'}</Badge>}
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric label="Prospective episodes" value={String(ledger?.episode_count ?? 0)} />
          <Metric label="120m resolved" value={`${validation?.primary_resolved_cases ?? 0} / ${validation?.minimum_ready_cases ?? 20}`} />
          <Metric label="Outcome rows" value={String(ledger?.outcome_rows ?? 0)} />
          <Metric label="Missed clean moves" value={String(validation?.primary_missed_clean_moves ?? 0)} />
        </div>

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2"><Activity size={15} className="text-blue-600"/><p className="text-xs font-semibold">Validation readiness</p></div>
            <span className="text-xs font-semibold">{progress.toFixed(0)}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} /></div>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-[11px] text-slate-500">{validation?.stage ?? 'ACCUMULATING_PROSPECTIVE_CASES'} · primary horizon {validation?.primary_horizon_minutes ?? 120}m.</p>
            <Badge variant={validation?.descriptive_validation_ready ? 'green' : 'default'}>{validation?.descriptive_validation_ready ? 'DESCRIPTIVE VALIDATION READY' : 'VALIDATION LOCKED'}</Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Stage label="Freeze V1" value={researchStatus?.pipeline?.freeze_v1} />
          <Stage label="Capture" value={researchStatus?.pipeline?.capture} />
          <Stage label="Observe" value={researchStatus?.pipeline?.observe_outcome} />
          <Stage label="Diagnose" value={researchStatus?.pipeline?.diagnose} />
          <Stage label="Memory" value={researchStatus?.pipeline?.build_memory} />
          <Stage label="Validate" value={researchStatus?.pipeline?.validate} />
          <Stage label="Improve" value={researchStatus?.pipeline?.improve} />
          <Stage label="Holdout" value={researchStatus?.pipeline?.holdout_test} />
          <Stage label="Prospective" value={researchStatus?.pipeline?.prospective_test} />
          <Stage label="Promote" value={researchStatus?.pipeline?.promote} />
        </div>

        <p className="text-[11px] text-slate-500">Automatic prospective research sampling is scheduled every 30 minutes during the weekday MCX session. It uses the PIT-safe endpoint, creates no broker order, uses no historical backfill, and does not change the frozen V1 decision.</p>
      </CardBody>
    </Card>

    <Card>
      <CardHeader title="Crude Oil Mini — Manual Market Brain" subtitle="Press anytime. During a closed MCX session AlphaPilot reports MARKET CLOSED instead of fabricating a setup." action={<Badge variant={result?.status === 'EVALUATED' ? 'green' : result?.status === 'DATA_ERROR' ? 'red' : 'blue'}>{action}</Badge>} />
      <CardBody className="space-y-4">
        {!result ? <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-5 text-center"><p className="text-sm font-semibold">Ready for a point-in-time evaluation</p><p className="text-xs text-slate-500 mt-1">Current Mind + V2 shadow + registered option OI/premium + PIT news/global context.</p><Button className="mt-4" variant="primary" onClick={() => void generate()} disabled={generating}>{generating ? 'Generating…' : 'Generate AlphaPilot Result'}</Button></div> : <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label="Current Mind" value={result.current_mind?.action ?? result.status} />
            <Metric label="Evidence" value={result.current_mind?.evidence_quality ?? '—'} />
            <Metric label="V2 Shadow" value={`${result.integrated_v2_shadow?.direction ?? '—'} · ${result.integrated_v2_shadow?.confidence ?? '—'}`} />
            <Metric label="OI + Premium V1" value={option?.direction ?? option?.directional_inference ?? option?.status ?? 'UNAVAILABLE'} />
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4">
            <p className="text-xs font-semibold">Reason / Thesis</p><p className="text-sm mt-1">{result.current_mind?.reason ?? result.reason ?? 'No additional reason returned.'}</p>
            {result.current_mind?.thesis && <p className="text-xs text-slate-500 mt-2">{result.current_mind.thesis}</p>}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2"><div><p className="text-xs font-semibold">Option Expression V1</p><p className="text-[11px] text-slate-500 mt-0.5">Downstream of Current Mind; it cannot create direction.</p></div><Badge variant={expression?.status === 'EXPRESSED' ? 'green' : 'default'}>{expression?.status ?? (['BUY_CE', 'BUY_PE'].includes(result.current_mind?.action ?? '') ? 'UNAVAILABLE' : 'NOT REQUIRED')}</Badge></div>
              {expression?.status === 'EXPRESSED' ? <>
                <div className="grid grid-cols-2 gap-2">
                  <Metric label="Contract" value={expression.trading_symbol ?? '—'} />
                  <Metric label="Strike / Type" value={`${formatNumber(expression.strike)} ${expression.option_type ?? ''}`.trim()} />
                  <Metric label="Premium reference" value={formatMoney(expression.premium_reference)} />
                  <Metric label="Lots / Quantity" value={`${expression.lots ?? '—'} / ${expression.quantity ?? '—'}`} />
                  <Metric label="Estimated outlay" value={formatMoney(expression.estimated_premium_outlay)} />
                  <Metric label="Expiry" value={formatDate(expression.expiry_date)} />
                </div>
                <p className="text-[11px] text-slate-500">PIT contract selection · {expression.premium_reference_basis ?? 'premium reference'} · capital committed remains ₹0.</p>
              </> : <p className="text-xs text-slate-500">{expression?.reason ?? 'WAIT / NO_TRADE decisions intentionally have no option contract, premium or quantity.'}</p>}
            </div>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between gap-2"><div><p className="text-xs font-semibold">Option Premium Memory V1</p><p className="text-[11px] text-slate-500 mt-0.5">Prospective first-seen CRUDEOILM option response memory.</p></div><Badge variant={premiumMemory?.status === 'DESCRIPTIVE_READY' ? 'green' : premiumMemory?.status === 'UNAVAILABLE' ? 'red' : 'blue'}>{premiumMemory?.status ?? 'UNAVAILABLE'}</Badge></div>
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Immutable snapshots" value={String(premiumMemory?.snapshot_count ?? 0)} />
                <Metric label="Contracts" value={String(premiumMemory?.contract_count ?? 0)} />
                <Metric label="Response segments" value={String(premiumMemory?.response_segments ?? 0)} />
                <Metric label="Trading days" value={String(premiumMemory?.trading_days ?? 0)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant={premiumMemory?.first_seen_immutable ? 'green' : 'default'}>{premiumMemory?.first_seen_immutable ? 'FIRST-SEEN IMMUTABLE' : 'PROVENANCE UNVERIFIED'}</Badge>
                <Badge variant="default">NO BACKFILL</Badge>
                <Badge variant="default">DECISION EFFECT: NONE</Badge>
              </div>
              <p className="text-[11px] text-slate-500">{premiumMemory?.storage_note ?? premiumMemory?.reason ?? 'Memory becomes available only from genuine prospective observations.'}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metric label="Click" value={new Date(result.click_at).toLocaleString()} />
            <Metric label="Latest completed bar" value={result.latest_completed_bar_available_at ? new Date(result.latest_completed_bar_available_at).toLocaleString() : '—'} />
            <Metric label="PIT candles" value={String(result.data?.candles ?? '—')} />
            <Metric label="Market" value={result.market_session?.status ?? '—'} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={result.point_in_time ? 'green' : 'red'}>{result.point_in_time ? 'POINT-IN-TIME' : 'PIT REVIEW'}</Badge>
            <Badge variant="blue">OPTIONS ONLY</Badge>
            <Badge variant={option?.first_seen_immutable ? 'green' : 'red'}>{option?.first_seen_immutable ? 'OPTION PIT: FIRST-SEEN IMMUTABLE' : 'OPTION PIT: UNVERIFIED'}</Badge>
            <Badge variant={safe ? 'green' : 'red'}>{safe ? 'PAPER ONLY · NO BROKER ORDERS' : 'SAFETY REVIEW'}</Badge>
            <Badge variant={result.data?.expensive_180_day_live_refetch_used === false ? 'green' : 'default'}>PIT STORE PATH</Badge>
            <Badge variant="default">V2 DECISION EFFECT: NONE</Badge>
          </div>
        </>}
      </CardBody>
    </Card>

    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card><CardHeader title="Platform Scope" subtitle="The dashboard reflects AlphaPilot's actual product scope."/><CardBody className="space-y-3"><Rule title="F&O" detail="Indian equity/index F&O research expressed through option buying."/><Rule title="Commodities" detail="Copper Brain plus active CRUDEOILM Brain development."/><Rule title="Trade expression" detail="BUY CE / BUY PE / WAIT / NO TRADE. No futures execution and no option selling."/></CardBody></Card>
      <Card><CardHeader title="Decision Discipline" subtitle="Frozen decision logic and shadow research remain separated."/><CardBody className="space-y-3"><Rule title="Current Mind" detail="Primary point-in-time decision layer, frozen as baseline V1."/><Rule title="Integrated Direction V2" detail="Shadow-only; decision_effect remains NONE."/><Rule title="Prospective experience" detail="Only fully resolved prior 120-minute episodes can enter Memory V1; outcomes cannot rank their own analogues."/></CardBody></Card>
    </div>

    <div className="flex justify-end"><Button variant="ghost" onClick={() => onNavigate('current-mind-audit')}><Microscope size={14} className="inline mr-1.5"/>Open Current Mind Audit</Button></div>
    <p className="text-[11px] text-slate-400 text-center pb-3">Research and decision-support only. No real-money order placement is enabled.</p>
  </div>;
}

function Stage({ label, value }: { label: string; value?: string }) {
  const normalized = value ?? 'UNKNOWN';
  const variant = normalized === 'COMPLETE' || normalized === 'READY' ? 'green' : normalized === 'ACTIVE' ? 'blue' : 'default';
  return <Badge variant={variant}>{label}: {normalized}</Badge>;
}
function Rule({ title, detail }: { title: string; detail: string }) { return <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><p className="text-sm font-semibold">{title}</p><p className="text-xs text-slate-500 mt-1">{detail}</p></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><p className="text-[10px] text-slate-500">{label}</p><p className="text-sm font-semibold mt-1 break-all">{value}</p></div>; }
function formatNumber(value?: number) { return value == null ? '—' : String(value); }
function formatMoney(value?: number) { return value == null ? '—' : `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }
function formatDate(value?: string) { if (!value) return '—'; const date = new Date(value); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(); }
