import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Brain, RefreshCw, ShieldCheck, Zap } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { getCommodityProbe, type CommodityProbeResponse } from '@/lib/commodityApi';
import {
  generateCrudeMiniResult,
  getCrudeMiniResearchStatus,
  type CrudeMiniResearchStatus,
  type CrudeMiniResult,
} from '@/lib/crudeMiniApi';
import {
  getSharedCommodityBrainStatus,
  type SharedCommodityBrainDashboardStatus,
} from '@/lib/sharedCommodityBrainApi';
import type { DashboardInstrument } from '@/lib/dashboardUniverse';

export function CommodityInstrumentDashboardPanel({ instrument }: { instrument: DashboardInstrument }) {
  if (instrument.symbol === 'COPPER') return <CopperDashboardPanel instrument={instrument} />;
  if (instrument.symbol === 'CRUDEOILM') return <CrudeOilMiniDashboardPanel instrument={instrument} />;
  return null;
}

function CopperDashboardPanel({ instrument }: { instrument: DashboardInstrument }) {
  const [shared, setShared] = useState<SharedCommodityBrainDashboardStatus | null>(null);
  const [probe, setProbe] = useState<CommodityProbeResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    const [sharedResult, probeResult] = await Promise.allSettled([
      getSharedCommodityBrainStatus(),
      getCommodityProbe('COPPER'),
    ]);
    if (sharedResult.status === 'fulfilled') setShared(sharedResult.value);
    if (probeResult.status === 'fulfilled') setProbe(probeResult.value);
    const failures = [sharedResult, probeResult].filter((item) => item.status === 'rejected');
    if (failures.length === 2) setError('Copper dashboard data is temporarily unavailable.');
    else if (failures.length === 1) setError('One Copper data lane is temporarily unavailable; the available PIT evidence is shown below.');
    setLoading(false);
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const copper = shared?.copper;
  const latest = copper?.latest;
  const contract = probe?.contract;

  return <div className="space-y-4">
    <InstrumentHeader
      title={`Copper — Market Brain`}
      subtitle="Copper-only prospective dashboard. No Crude Oil Mini research cards are mixed into this view."
      symbol={instrument.symbol}
      status={copper?.status ?? (probe?.ready_for_phase1 ? 'ACTIVE' : 'LOADING')}
      loading={loading}
      onRefresh={refresh}
    />

    {error && <Notice>{error}</Notice>}

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Metric label="Prospective samples" value={number(copper?.prospective_evaluations)} />
      <Metric label="Directional" value={number(copper?.directional_evaluations)} />
      <Metric label="Abstentions" value={number(copper?.abstentions)} />
      <Metric label="Latest thesis" value={thesis(latest?.direction, latest?.confidence)} />
    </div>

    <Card>
      <CardHeader
        title="Copper — Prospective Shared Brain"
        subtitle="Immutable first-seen PIT evidence with Copper's own commodity profile and prospective stream."
        action={<Badge variant={copper?.status === 'ACTIVE' ? 'green' : 'default'}>{pretty(copper?.status)}</Badge>}
      />
      <CardBody className="space-y-4">
        {latest ? <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Metric label="Direction" value={latest.direction ?? 'UNKNOWN'} />
            <Metric label="Confidence" value={latest.confidence ?? '—'} />
            <Metric label="Thesis state" value={latest.thesis_state ?? '—'} />
          </div>
          <p className="text-xs text-slate-500">Latest frozen board: {formatTimestamp(latest.board_as_of)}</p>
          <EvidenceFamilies label="Supporting families" families={latest.supporting_families} />
          <EvidenceFamilies label="Opposing families" families={latest.opposing_families} />
        </> : <EmptyState text="Waiting for the next genuine Copper prospective sample. No closed-session or backfilled sample is fabricated." />}

        <div className="flex flex-wrap gap-2">
          <Badge variant={copper?.first_seen_immutable ? 'green' : 'default'}>FIRST-SEEN {copper?.first_seen_immutable ? 'IMMUTABLE' : 'CHECKING'}</Badge>
          <Badge variant={copper?.historical_backfill_used === false ? 'green' : 'default'}>NO HISTORICAL BACKFILL</Badge>
          <Badge variant="default">DECISION EFFECT: {String(copper?.decision_effect ?? 'NONE')}</Badge>
          <Badge variant="green">CAPITAL ₹{copper?.capital_committed ?? 0}</Badge>
        </div>
      </CardBody>
    </Card>

    <Card>
      <CardHeader
        title="Copper — Data Readiness"
        subtitle="Current instrument/probe visibility only. This card does not manufacture a trade setup."
        action={<Badge variant={probe?.ready_for_phase1 ? 'green' : 'default'}>{probe?.ready_for_phase1 ? 'READY' : pretty(probe?.symbol ? probe.status : undefined)}</Badge>}
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric label="Provider" value={String(probe?.provider ?? '—')} />
          <Metric label="Contract" value={String(contract?.trading_symbol ?? contract?.groww_symbol ?? '—')} />
          <Metric label="Expiry" value={String(contract?.expiry_date ?? contract?.expiry ?? '—')} />
          <Metric label="Lot size" value={contract?.lot_size == null ? '—' : String(contract.lot_size)} />
          <Metric label="Quote lane" value={probe?.quote_ok == null ? '—' : probe.quote_ok ? 'OK' : 'UNAVAILABLE'} />
          <Metric label="Candles lane" value={probe?.candles_ok == null ? '—' : probe.candles_ok ? 'OK' : 'UNAVAILABLE'} />
          <Metric label="Candles" value={probe?.candle_count == null ? '—' : String(probe.candle_count)} />
          <Metric label="Phase 1" value={probe?.ready_for_phase1 ? 'READY' : 'NOT READY'} />
        </div>
        <p className="text-[11px] text-slate-500">Copper remains research-only. Dashboard readiness is not an execution permission and does not change any frozen decision rule.</p>
      </CardBody>
    </Card>
  </div>;
}

function CrudeOilMiniDashboardPanel({ instrument }: { instrument: DashboardInstrument }) {
  const [research, setResearch] = useState<CrudeMiniResearchStatus | null>(null);
  const [shared, setShared] = useState<SharedCommodityBrainDashboardStatus | null>(null);
  const [result, setResult] = useState<CrudeMiniResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextResearch, nextShared] = await Promise.all([
        getCrudeMiniResearchStatus(),
        getSharedCommodityBrainStatus(),
      ]);
      setResearch(nextResearch);
      setShared(nextShared);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Crude Oil Mini dashboard data is unavailable.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    try {
      setResult(await generateCrudeMiniResult());
      void refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to generate the Crude Oil Mini research result.');
    } finally {
      setGenerating(false);
    }
  };

  const crude = shared?.crude_oil_mini;
  const parity = crude?.latest_parity;
  const validation = research?.validation;
  const ledger = research?.episode_ledger;
  const progress = Math.max(0, Math.min(100, validation?.progress_pct ?? 0));
  const option = result?.data?.option_positioning;
  const expression = result?.execution?.option_expression;
  const action = result?.current_mind?.action ?? result?.status ?? 'READY';
  const safetyOk = useMemo(() => (
    result?.execution?.paper_signal_only === true &&
    result?.execution?.live_execution_enabled === false &&
    result?.execution?.broker_order_placement_enabled === false
  ), [result]);

  return <div className="space-y-4">
    <InstrumentHeader
      title="Crude Oil Mini — Market Brain"
      subtitle="Crude Oil Mini-only research loop, shared-core parity and manual point-in-time evaluation. Copper cards are excluded from this view."
      symbol={instrument.symbol}
      status={research?.status ?? crude?.status ?? 'LOADING'}
      loading={loading}
      onRefresh={refresh}
      action={<Button variant="primary" onClick={() => void generate()} disabled={generating}><Zap size={15} className="inline mr-1.5"/>{generating ? 'Generating…' : 'Generate Result'}</Button>}
    />

    {error && <Notice>{error}</Notice>}

    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <Metric label="Prospective episodes" value={number(ledger?.episode_count)} />
      <Metric label="120m resolved" value={`${validation?.primary_resolved_cases ?? 0} / ${validation?.minimum_ready_cases ?? 20}`} />
      <Metric label="Parity samples" value={number(crude?.shared_parity_episodes)} />
      <Metric label="Current Mind" value={result ? action : 'READY'} />
    </div>

    <Card>
      <CardHeader
        title="Crude Oil Mini — Research Loop"
        subtitle="Freeze → Capture → Observe → Diagnose → Memory → Validate → Improve → Holdout → Prospective → Promote"
        action={<Badge variant={research?.research_protocol?.status === 'FROZEN' ? 'green' : 'default'}>{research?.research_protocol?.status ?? 'LOADING'}</Badge>}
      />
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2"><Activity size={15} className="text-blue-600"/><p className="text-xs font-semibold">Validation readiness</p></div>
          <span className="text-xs font-semibold">{progress.toFixed(0)}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"><div className="h-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} /></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Metric label="Outcome rows" value={number(ledger?.outcome_rows)} />
          <Metric label="Missed clean moves" value={number(validation?.primary_missed_clean_moves)} />
          <Metric label="Stage" value={validation?.stage ?? 'ACCUMULATING'} />
          <Metric label="Promotion" value={validation?.promotion_eligible ? 'ELIGIBLE' : 'LOCKED'} />
        </div>
      </CardBody>
    </Card>

    <Card>
      <CardHeader
        title="Crude Oil Mini — Shared Core Parity"
        subtitle="Legacy V2 and the shared causal core are compared on the same PIT evidence-family snapshot."
        action={<Badge variant={crude?.status === 'ACTIVE' ? 'green' : 'default'}>{pretty(crude?.status)}</Badge>}
      />
      <CardBody className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Metric label="Legacy V2" value={thesis(parity?.legacy?.direction, parity?.legacy?.confidence)} />
          <Metric label="Shared core" value={thesis(parity?.shared?.direction, parity?.shared?.confidence)} />
          <Metric label="Agreement" value={parity?.full_thesis_agreement == null ? '—' : parity.full_thesis_agreement ? 'FULL' : 'DIVERGED'} />
          <Metric label="Latest parity" value={formatTimestamp(crude?.latest_parity_click)} />
        </div>
        {parity?.divergence_reason && <p className="text-xs text-slate-500">Divergence: {parity.divergence_reason}</p>}
        <div className="flex flex-wrap gap-2">
          <Badge variant={crude?.same_pit_family_snapshot_as_legacy ? 'green' : 'default'}>SAME PIT SNAPSHOT</Badge>
          <Badge variant="default">MEMORY: CONTEXT ONLY</Badge>
          <Badge variant="default">DECISION EFFECT: {String(crude?.decision_effect ?? 'NONE')}</Badge>
          <Badge variant="green">CAPITAL ₹{crude?.capital_committed ?? 0}</Badge>
        </div>
      </CardBody>
    </Card>

    <Card>
      <CardHeader
        title="Crude Oil Mini — Manual Point-in-Time Result"
        subtitle="Uses the genuine current research inputs. A closed or insufficient-data session stays NO TRADE / unavailable rather than inventing a setup."
        action={<Badge variant={result?.status === 'EVALUATED' ? 'green' : result?.status === 'DATA_ERROR' ? 'red' : 'blue'}>{action}</Badge>}
      />
      <CardBody className="space-y-4">
        {!result ? <EmptyState text="No manual result has been generated in this dashboard session yet." /> : <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Metric label="Current Mind" value={result.current_mind?.action ?? result.status} />
            <Metric label="Evidence" value={result.current_mind?.evidence_quality ?? '—'} />
            <Metric label="V2 Shadow" value={thesis(result.integrated_v2_shadow?.direction, result.integrated_v2_shadow?.confidence)} />
            <Metric label="OI / Premium" value={option?.direction ?? option?.directional_inference ?? option?.status ?? 'UNAVAILABLE'} />
          </div>
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-2">
            <div className="flex items-center gap-2"><Brain size={16} className="text-blue-600"/><p className="text-sm font-semibold">Option expression</p></div>
            {expression?.trading_symbol ? <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metric label="Action" value={expression.action ?? '—'} />
              <Metric label="Contract" value={expression.trading_symbol} />
              <Metric label="Lots" value={expression.lots == null ? '—' : String(expression.lots)} />
              <Metric label="Premium outlay" value={expression.estimated_premium_outlay == null ? '—' : `₹${Math.round(expression.estimated_premium_outlay).toLocaleString('en-IN')}`} />
            </div> : <p className="text-xs text-slate-500">No genuine option expression is available for this result.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant={safetyOk ? 'green' : 'default'}><ShieldCheck size={12} className="inline mr-1"/>PAPER / RESEARCH ONLY</Badge>
            <Badge variant="green">NO BROKER ORDER</Badge>
            <Badge variant="green">CAPITAL ₹{result.execution?.capital_committed ?? 0}</Badge>
          </div>
        </>}
      </CardBody>
    </Card>
  </div>;
}

function InstrumentHeader({
  title,
  subtitle,
  symbol,
  status,
  loading,
  onRefresh,
  action,
}: {
  title: string;
  subtitle: string;
  symbol: string;
  status?: string;
  loading: boolean;
  onRefresh: () => Promise<void>;
  action?: React.ReactNode;
}) {
  return <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50/60 dark:bg-blue-950/20 p-4 flex items-start justify-between gap-4 flex-wrap">
    <div>
      <div className="flex items-center gap-2"><Brain size={20} className="text-blue-600"/><h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2></div>
      <p className="text-xs text-slate-500 mt-1 max-w-3xl">{subtitle}</p>
    </div>
    <div className="flex items-center gap-2 flex-wrap">
      <Badge variant="blue">{symbol}</Badge>
      <Badge variant={status === 'ACTIVE' || status === 'READY' ? 'green' : 'default'}>{pretty(status)}</Badge>
      <Button variant="ghost" onClick={() => void onRefresh()} disabled={loading}><RefreshCw size={14} className={`inline mr-1 ${loading ? 'animate-spin' : ''}`}/>{loading ? 'Refreshing' : 'Refresh'}</Button>
      {action}
    </div>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 min-w-0">
    <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
    <p className="text-sm font-semibold text-slate-900 dark:text-white mt-1 break-words">{value}</p>
  </div>;
}

function EvidenceFamilies({ label, families }: { label: string; families?: string[] }) {
  if (!families?.length) return null;
  return <div><p className="text-[11px] font-semibold text-slate-500 mb-1.5">{label}</p><div className="flex flex-wrap gap-1.5">{families.map((family) => <Badge key={family} variant="default">{family}</Badge>)}</div></div>;
}

function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs text-amber-700 dark:text-amber-300">{children}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-5 text-center text-xs text-slate-500">{text}</div>;
}

function number(value?: number) { return value == null ? '—' : String(value); }
function thesis(direction?: string, confidence?: string) { return `${direction ?? 'UNKNOWN'}${confidence ? ` · ${confidence}` : ''}`; }
function pretty(value?: string) { return value ? value.replaceAll('_', ' ') : 'LOADING'; }
function formatTimestamp(value?: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
