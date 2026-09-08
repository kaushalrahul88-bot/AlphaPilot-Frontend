import { useCallback, useEffect, useState } from 'react';
import { Activity, FlaskConical, Play, RefreshCw, Zap } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import {
  getCryptoBtcDashboardStatus,
  getCryptoBtcUnderlyingBacktestJob,
  generateCryptoBtcLiveShadowSetup,
  runCryptoBtcUnderlyingBacktest,
  type CryptoBtcDashboardStatus,
  type CryptoBtcShadowClick,
  type CryptoBtcLiveShadowActionResult,
  type CryptoBtcUnderlyingBacktestResult,
  type CryptoBtcBacktestJob,
} from '@/lib/cryptoBtcApi';

export function CryptoBtcDashboardPanel() {
  const [status, setStatus] = useState<CryptoBtcDashboardStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backtestRunning, setBacktestRunning] = useState(false);
  const [liveRunning, setLiveRunning] = useState(false);
  const [backtest, setBacktest] = useState<CryptoBtcUnderlyingBacktestResult | null>(null);
  const [backtestJob, setBacktestJob] = useState<CryptoBtcBacktestJob | null>(null);
  const [liveAction, setLiveAction] = useState<CryptoBtcLiveShadowActionResult | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStatus(await getCryptoBtcDashboardStatus());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Crypto BTC status unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  const runBacktest = useCallback(async () => {
    setBacktestRunning(true);
    setError(null);
    try {
      setBacktest(null);
      let job = await runCryptoBtcUnderlyingBacktest();
      setBacktestJob(job);
      while (job.status === 'RUNNING') {
        await new Promise(resolve => window.setTimeout(resolve, 1_000));
        job = await getCryptoBtcUnderlyingBacktestJob(job.job_id);
        setBacktestJob(job);
      }
      if (job.status === 'FAILED') throw new Error(job.error || 'BTC underlying backtest failed');
      if (!job.result) throw new Error('BTC backtest completed without a result');
      setBacktest(job.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'BTC underlying backtest failed');
    } finally {
      setBacktestRunning(false);
    }
  }, []);

  const generateLiveSetup = useCallback(async () => {
    setLiveRunning(true);
    setError(null);
    try {
      setLiveAction(await generateCryptoBtcLiveShadowSetup());
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'BTC live shadow setup failed');
    } finally {
      setLiveRunning(false);
    }
  }, [refresh]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const collection = status?.collection;
  const proof = status?.prospective_proof;
  const shadow = status?.live_shadow;
  const latest = shadow?.latest ?? null;
  const outcome = latest?.resolution?.outcome ?? null;

  return <Card>
    <CardHeader
      title="Crypto — BTC Options Prospective Proof"
      subtitle="Genuine Delta India Options snapshots + frozen BTC Market Brain decisions + later 4-hour outcomes. Research/shadow only."
      action={<div className="flex items-center gap-2"><Badge variant={status?.status === 'ACTIVE' ? 'green' : 'default'}>{status?.status ?? 'LOADING'}</Badge><Button variant="ghost" onClick={() => void refresh()} disabled={loading}><RefreshCw size={14} className={loading ? 'animate-spin' : ''}/></Button></div>}
    />
    <CardBody className="space-y-4">
      {error && <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs text-amber-700 dark:text-amber-300">{error}</div>}

      <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/20 p-4 space-y-3">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div><p className="text-sm font-semibold">Crypto research actions</p><p className="text-[11px] text-slate-500 mt-1">Generate a server-time BTC shadow setup now, or replay the first collected 24 hours at 15-minute clicks. Neither action places an order.</p></div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" onClick={() => void generateLiveSetup()} disabled={liveRunning || backtestRunning}><Zap size={14} className="inline mr-1"/>{liveRunning ? 'Generating…' : 'Generate Live BTC Setup'}</Button>
            <Button onClick={() => void runBacktest()} disabled={backtestRunning || liveRunning}><Play size={14} className="inline mr-1"/>{backtestRunning ? 'Running 96 clicks…' : 'Run 24h Backtest'}</Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2"><Badge variant="green">SERVER TIME</Badge><Badge variant="green">SHADOW ONLY</Badge><Badge variant="default">NO BROKER ORDER</Badge><Badge variant="default">CAPITAL ₹0</Badge></div>
        {backtestRunning && <BacktestProgress job={backtestJob} />}
      </div>

      {liveAction?.result && <LiveActionResult action={liveAction} />}
      {backtest?.summary && <UnderlyingBacktestResult result={backtest} />}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <CryptoMetric label="Delta snapshots" value={String(collection?.snapshot_count ?? 0)} sub={collection?.latest_snapshot_at ? `Latest ${formatIst(collection.latest_snapshot_at)}` : 'Waiting for first snapshot'} />
        <CryptoMetric label="BTC prospective clicks" value={String(proof?.decision_count ?? 0)} sub={`${proof?.resolved_count ?? 0} resolved · ${proof?.pending_resolution_count ?? 0} pending`} />
        <CryptoMetric label="Option shadow entries" value={String(shadow?.options_entry_count ?? 0)} sub={`${shadow?.no_trade_count ?? 0} no-trade · ${shadow?.click_count ?? 0} total clicks`} />
        <CryptoMetric label="Directional accuracy" value={formatAccuracy(proof?.directional_accuracy)} sub={`${proof?.directional_hit_count ?? 0} hit · ${proof?.directional_miss_count ?? 0} miss`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-sm font-semibold">Live Options data collection</p><p className="text-[11px] text-slate-500 mt-0.5">Delta Exchange India · nearest-expiry ATM slice · public market data</p></div>
            <Badge variant={collection?.latest_snapshot_at ? 'green' : 'default'}>{collection?.latest_snapshot_at ? 'COLLECTING' : 'WAITING'}</Badge>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <CryptoMetric label="Reference BTC" value={formatPrice(collection?.latest?.reference_spot_price)} />
            <CryptoMetric label="Quotes / snapshot" value={String(collection?.latest?.quote_count ?? 0)} />
            <CryptoMetric label="Nearest expiry" value={formatDateOnly(collection?.latest?.nearest_expiry)} />
            <CryptoMetric label="Latest first-seen" value={formatIst(collection?.latest?.first_seen_at)} />
          </div>
          <div className="flex flex-wrap gap-2"><Badge variant="green">POINT-IN-TIME</Badge><Badge variant="green">PUBLIC FEED</Badge><Badge variant="default">CANDIDATE VENUE</Badge><Badge variant="default">NO API KEY</Badge></div>
        </div>

        <LatestCryptoClick latest={latest} />
      </div>

      <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-3 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2"><Activity size={15} className="text-blue-600 mt-0.5"/><div><p className="text-xs font-semibold">Prospective proof state</p><p className="text-[11px] text-slate-500 mt-1">4-hour frozen BTC horizon · outcomes cannot rewrite decisions · UNKNOWN remains NO TRADE · exact observed Delta ask required before an Options shadow entry can exist.</p></div></div>
        <div className="flex gap-2 flex-wrap"><Badge variant="green">RESEARCH ONLY</Badge><Badge variant="green">NO LIVE ORDERS</Badge><Badge variant="green">CAPITAL ₹0</Badge><Badge variant="default">FUTURES: CONTEXT ONLY</Badge></div>
      </div>

      {(proof?.abstention_large_move_missed_count ?? 0) > 0 && <div className="rounded-lg border border-amber-200 dark:border-amber-900 p-3 text-xs"><span className="font-semibold">Missed-move diagnostic:</span> {proof?.abstention_large_move_missed_count} resolved NO TRADE sample(s) were followed by a large BTC move and are flagged for postmortem learning.</div>}

      {outcome?.large_move_missed_during_abstention && <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs">Latest NO TRADE was followed by a large move. AlphaPilot has marked this exact frozen sample for diagnostic review instead of rewriting the original decision.</div>}
    </CardBody>
  </Card>;
}

function BacktestProgress({ job }: { job: CryptoBtcBacktestJob | null }) {
  const completed = job?.completed_clicks ?? 0;
  const total = job?.total_clicks ?? 96;
  const pct = Math.max(0, Math.min(100, job?.progress_pct ?? 0));
  const loadingData = job?.phase === 'LOADING_ARCHIVED_INPUTS' || job?.phase === 'QUEUED';
  return <div className="space-y-1.5" role="status" aria-live="polite">
    <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300"><span>{pretty(job?.phase || 'STARTING')}</span><span>{loadingData ? 'Loading market data…' : `${completed} / ${total} clicks · ${pct.toFixed(1)}%`}</span></div>
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className={`h-full rounded-full bg-blue-600 transition-all duration-500 ${loadingData ? 'animate-pulse' : ''}`} style={{ width: loadingData ? '8%' : `${pct}%` }} />
    </div>
  </div>;
}

function LiveActionResult({ action }: { action: CryptoBtcLiveShadowActionResult }) {
  const result = action.result;
  const option = result?.option_entry;
  const directional = result?.market_direction === 'BULLISH' || result?.market_direction === 'BEARISH';
  return <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
    <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">Generated live BTC shadow setup</p><p className="text-[11px] text-slate-500 mt-0.5">Server decision {formatIst(result?.decision_at)}</p></div><Badge variant={directional ? 'blue' : 'default'}>{result?.market_direction ?? 'UNKNOWN'}</Badge></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2"><CryptoMetric label="BTC at decision" value={formatPrice(result?.proof_bridge?.decision_btc_price)} /><CryptoMetric label="Decision" value={pretty(result?.shadow_status)} /><CryptoMetric label="Reason" value={pretty(result?.reason)} /><CryptoMetric label="Order placed" value="NO" /></div>
    {option ? <div className="rounded-md border border-blue-200 dark:border-blue-900 p-3"><div className="flex gap-2 flex-wrap"><Badge variant="blue">BUY {option.option_type}</Badge><Badge variant="default">{option.symbol}</Badge><Badge variant="green">SHADOW ENTRY</Badge></div><p className="text-xs mt-2">Strike {formatPrice(option.strike_price)} · observed ask {formatPrice(option.entry_ask)}</p></div> : <p className="text-xs text-slate-500">No Options shadow entry was generated. AlphaPilot retained WAIT/NO TRADE because the required direction or exact contract conditions were not satisfied.</p>}
  </div>;
}

function UnderlyingBacktestResult({ result }: { result: CryptoBtcUnderlyingBacktestResult }) {
  const summary = result.summary;
  return <div className="rounded-lg border border-violet-200 dark:border-violet-900 p-4 space-y-3">
    <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">First 24h underlying scorecard</p><p className="text-[11px] text-slate-500 mt-0.5">{formatIst(result.window_start)} → {formatIst(result.window_end_exclusive)} · 15-minute clicks</p></div><Badge variant="purple"><FlaskConical size={12} className="mr-1"/>UNDERLYING ONLY</Badge></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2"><CryptoMetric label="Scheduled clicks" value={String(result.scheduled_clicks ?? 0)} /><CryptoMetric label="Directional setups" value={String(summary?.directional_setups ?? 0)} /><CryptoMetric label="Resolved setups" value={String(summary?.resolved_setups ?? 0)} /><CryptoMetric label="Target / Stop" value={`${summary?.target_hits ?? 0} / ${summary?.stops ?? 0}`} /></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2"><CryptoMetric label="Setup win rate" value={summary?.setup_win_rate_pct == null ? 'NOT SCORED' : `${summary.setup_win_rate_pct.toFixed(1)}%`} /><CryptoMetric label="Total R" value={formatR(summary?.total_r)} /><CryptoMetric label="Average R" value={formatR(summary?.average_r)} /><CryptoMetric label="Options P&L" value="NOT EVALUATED" /></div>
    <p className="text-[11px] text-slate-500">Missing historical lanes remain missing; newer evidence is never backfilled into these clicks. Same-candle ordering is marked ambiguous.</p>
  </div>;
}

function LatestCryptoClick({ latest }: { latest: CryptoBtcShadowClick | null }) {
  if (!latest) return <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4"><p className="text-sm font-semibold">Latest live shadow click</p><p className="text-xs text-slate-500 mt-2">Waiting for the first frozen BTC prospective click.</p></div>;
  const outcome = latest.resolution?.outcome;
  const pending = !latest.resolution && Boolean(latest.outcome_due_at);
  return <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-4 space-y-3">
    <div className="flex items-start justify-between gap-3">
      <div><p className="text-sm font-semibold">Latest live shadow click</p><p className="text-[11px] text-slate-500 mt-0.5">Frozen {formatIst(latest.decision_at)}</p></div>
      <Badge variant={latest.market_direction === 'BULLISH' || latest.market_direction === 'BEARISH' ? 'blue' : 'default'}>{latest.market_direction ?? 'UNKNOWN'}</Badge>
    </div>
    <div className="grid grid-cols-2 gap-2">
      <CryptoMetric label="Decision BTC" value={formatPrice(latest.decision_btc_price)} />
      <CryptoMetric label="Shadow action" value={pretty(latest.shadow_status)} />
      <CryptoMetric label="4h outcome due" value={formatIst(latest.outcome_due_at)} />
      <CryptoMetric label="Result" value={latest.resolution?.classification ? pretty(latest.resolution.classification) : pending ? 'PENDING' : '—'} />
    </div>
    <p className="text-[11px] text-slate-500">Reason: {pretty(latest.reason)}</p>

    {latest.option ? <div className="rounded-md border border-blue-200 dark:border-blue-900 p-3 space-y-2">
      <div className="flex gap-2 flex-wrap"><Badge variant="blue">BUY {latest.option.option_type}</Badge><Badge variant="default">{latest.option.symbol}</Badge></div>
      <div className="grid grid-cols-2 gap-2"><CryptoMetric label="Strike" value={formatPrice(latest.option.strike_price)} /><CryptoMetric label="Shadow entry ask" value={formatPrice(latest.option.entry_ask)} /><CryptoMetric label="Delta" value={formatNumber(latest.option.delta, 3)} /><CryptoMetric label="OI" value={formatNumber(latest.option.open_interest, 2)} /></div>
      <p className="text-[10px] text-slate-500">Hypothetical entry only. No exchange order was submitted.</p>
    </div> : <Badge variant="default">NO OPTION ENTRY</Badge>}

    {latest.resolution && outcome && <div className="rounded-md border border-slate-200 dark:border-slate-800 p-3 space-y-2">
      <div className="flex gap-2 flex-wrap"><Badge variant={latest.resolution.classification === 'DIRECTIONAL_HIT' ? 'green' : latest.resolution.classification === 'DIRECTIONAL_MISS' ? 'red' : 'default'}>{pretty(latest.resolution.classification)}</Badge>{outcome.large_move_after_click && <Badge variant="amber">LARGE MOVE</Badge>}</div>
      <div className="grid grid-cols-2 gap-2"><CryptoMetric label="Terminal BTC" value={formatPrice(outcome.terminal_btc_price)} /><CryptoMetric label="4h return" value={formatPct(outcome.terminal_return_pct)} /><CryptoMetric label="Max up" value={formatPct(outcome.max_up_pct)} /><CryptoMetric label="Max down" value={formatPct(outcome.max_down_pct)} /></div>
    </div>}
  </div>;
}

function CryptoMetric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><p className="text-[10px] text-slate-500">{label}</p><p className="text-sm font-semibold mt-1 break-words">{value}</p>{sub && <p className="text-[10px] text-slate-500 mt-1">{sub}</p>}</div>;
}

function pretty(value?: string | null) { return value ? value.replaceAll('_', ' ') : '—'; }
function formatIst(value?: string | null) { if (!value) return '—'; const d = new Date(value); return Number.isNaN(d.getTime()) ? value : d.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
function formatDateOnly(value?: string | null) { if (!value) return '—'; const d = new Date(`${value}T00:00:00Z`); return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString('en-IN', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' }); }
function formatPrice(value?: number | null) { return value == null ? '—' : `$${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`; }
function formatPct(value?: number | null) { return value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`; }
function formatNumber(value?: number | null, digits = 0) { return value == null ? '—' : value.toLocaleString('en-IN', { maximumFractionDigits: digits }); }
function formatAccuracy(value?: number | null) { return value == null ? 'NOT SCORED YET' : `${(value * 100).toFixed(1)}%`; }
function formatR(value?: number | null) { return value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(2)}R`; }
