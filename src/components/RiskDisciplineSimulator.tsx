import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ShieldCheck, ShieldX } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, Input, Select, StatCard } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { evaluateRiskDiscipline, type RiskDisciplineMode, type RiskDisciplineRequest, type RiskDisciplineResult } from '@/lib/riskDisciplineApi';
import { appendRiskDecisionRecord } from '@/lib/riskDecisionLedger';
import { openPaperTrade } from '@/lib/paperTradeLifecycleApi';
import {
  PAPER_TRADE_LIFECYCLE_EVENT,
  paperTradeEvidence,
  paperTradeRiskInputs,
  readPaperTrades,
  upsertPaperTrade,
} from '@/lib/paperTradeLifecycleStorage';
import type { RiskLimits } from '@/lib/types';

type GateKey = 'account_state_verified' | 'executable_nse_session' | 'fresh_intraday_candles' | 'universe_scan_complete' | 'fno_confirmation_complete' | 'quality_checks_complete' | 'liquidity_passed';

const GATES: { key: GateKey; label: string }[] = [
  { key: 'account_state_verified', label: 'Account reconciled; no untracked positions' },
  { key: 'executable_nse_session', label: 'Executable NSE session' },
  { key: 'fresh_intraday_candles', label: 'Fresh intraday candles' },
  { key: 'universe_scan_complete', label: '44/44 universe scan' },
  { key: 'fno_confirmation_complete', label: 'All expected F&O confirmations' },
  { key: 'quality_checks_complete', label: '9/9 quality checks' },
  { key: 'liquidity_passed', label: 'Liquidity gate' },
];

const INITIAL_GATES: Record<GateKey, boolean> = {
  account_state_verified: false,
  executable_nse_session: false,
  fresh_intraday_candles: false,
  universe_scan_complete: false,
  fno_confirmation_complete: false,
  quality_checks_complete: false,
  liquidity_passed: false,
};

function number(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function label(code: string) {
  return code.replace(/^ARMING_/, '').replace(/_/g, ' ').toLowerCase().replace(/^./, value => value.toUpperCase());
}

export function RiskDisciplineSimulator({ riskLimits, tradingCapital }: { riskLimits: RiskLimits; tradingCapital: number }) {
  const [mode, setMode] = useState<RiskDisciplineMode>('PAPER');
  const [symbol, setSymbol] = useState('RELIANCE');
  const [optionType, setOptionType] = useState<'CE' | 'PE'>('CE');
  const [correlationGroup, setCorrelationGroup] = useState('NIFTY_LARGE_CAP');
  const [expiry, setExpiry] = useState('');
  const [strike, setStrike] = useState('');
  const [entry, setEntry] = useState('100');
  const [stop, setStop] = useState('80');
  const [target, setTarget] = useState('132');
  const [lotSize, setLotSize] = useState('25');
  const [costs, setCosts] = useState('50');
  const [gates, setGates] = useState<Record<GateKey, boolean>>(INITIAL_GATES);
  const [manualApproval, setManualApproval] = useState(false);
  const [trades, setTrades] = useState(readPaperTrades);
  const [running, setRunning] = useState(false);
  const [opening, setOpening] = useState(false);
  const [result, setResult] = useState<RiskDisciplineResult | null>(null);
  const [lastPayload, setLastPayload] = useState<RiskDisciplineRequest | null>(null);
  const [openedTradeId, setOpenedTradeId] = useState<string | null>(null);
  const [openNotice, setOpenNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reload = () => setTrades(readPaperTrades());
    window.addEventListener(PAPER_TRADE_LIFECYCLE_EVENT, reload);
    window.addEventListener('storage', reload);
    return () => {
      window.removeEventListener(PAPER_TRADE_LIFECYCLE_EVENT, reload);
      window.removeEventListener('storage', reload);
    };
  }, []);

  const lifecycleInputs = useMemo(() => paperTradeRiskInputs(trades), [trades]);
  const lifecycleEvidence = useMemo(() => paperTradeEvidence(trades), [trades]);

  async function evaluate() {
    setRunning(true);
    setResult(null);
    setLastPayload(null);
    setOpenedTradeId(null);
    setOpenNotice(null);
    setError(null);
    try {
      const payload: RiskDisciplineRequest = {
        mode,
        capital_rupees: tradingCapital,
        proposed_trade: {
          symbol: symbol.trim().toUpperCase(),
          option_type: optionType,
          correlation_group: correlationGroup.trim().toUpperCase(),
          entry_price: number(entry),
          stop_price: number(stop),
          target_price: number(target),
          lot_size: Math.max(1, Math.floor(number(lotSize))),
          estimated_cost_rupees: Math.max(0, number(costs)),
        },
        operational_gates: gates,
        open_positions: lifecycleInputs.open_positions,
        closed_trades: lifecycleInputs.closed_trades,
        controlled_live_evidence: {
          ...lifecycleEvidence,
          manual_approval_recorded: manualApproval,
        },
        policy: {
          max_risk_per_trade_pct: Math.min(1, Math.max(0.01, riskLimits.maxRiskPerTradePct)),
          max_daily_loss_pct: Math.min(3, Math.max(0.01, riskLimits.maxDailyLossPct)),
          max_weekly_loss_pct: Math.min(6, Math.max(0.01, riskLimits.maxWeeklyLossPct)),
          max_open_risk_pct: Math.min(6, Math.max(0.01, riskLimits.maxOpenRiskPct)),
        },
        evaluated_at: new Date().toISOString(),
      };
      const response = await evaluateRiskDiscipline(payload);
      appendRiskDecisionRecord(payload, response);
      setLastPayload(payload);
      setResult(response);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Risk decision failed.');
    } finally {
      setRunning(false);
    }
  }

  async function openApprovedPaperTrade() {
    if (!lastPayload || result?.final_action !== 'PAPER_TRADE_ONLY') return;
    if (!expiry || number(strike) <= 0) {
      setError('Exact expiry and strike are required before opening a paper lifecycle position.');
      return;
    }
    setOpening(true);
    setError(null);
    setOpenNotice(null);
    try {
      const response = await openPaperTrade(lastPayload, {
        symbol: lastPayload.proposed_trade.symbol,
        expiry,
        strike: number(strike),
        option_type: lastPayload.proposed_trade.option_type,
        lot_size: lastPayload.proposed_trade.lot_size,
      });
      if (response.status !== 'OPENED_PAPER' || !response.paper_trade) {
        setResult(response.risk_decision);
        setError(response.blockers.map(label).join(' · ') || 'Paper lifecycle opening was blocked.');
        return;
      }
      upsertPaperTrade(response.paper_trade);
      const refreshedPayload: RiskDisciplineRequest = {
        ...lastPayload,
        proposed_trade: {
          ...lastPayload.proposed_trade,
          entry_price: response.paper_trade.entry_price,
        },
        evaluated_at: response.paper_trade.opened_at,
      };
      appendRiskDecisionRecord(refreshedPayload, response.risk_decision);
      setResult(response.risk_decision);
      setOpenedTradeId(response.paper_trade.trade_id);
      setOpenNotice('Paper position opened from live Groww option LTP. No broker order was sent.');
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Paper lifecycle opening failed.');
    } finally {
      setOpening(false);
    }
  }

  function markTechnicalGates() {
    setGates(current => ({
      account_state_verified: current.account_state_verified,
      executable_nse_session: true,
      fresh_intraday_candles: true,
      universe_scan_complete: true,
      fno_confirmation_complete: true,
      quality_checks_complete: true,
      liquidity_passed: true,
    }));
  }

  return <Card>
    <CardHeader title="Portfolio Risk & Discipline Engine v1" subtitle="Deterministic paper/control preview. It cannot place an order." action={<Badge variant="purple">VALIDATION ONLY</Badge>} />
    <CardBody className="space-y-5">
      <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-3 text-xs text-blue-700 dark:text-blue-300">
        Risk history now comes only from lifecycle paper trades. Existing demo/manual portfolio and journal rows are not submitted. Keep account reconciliation blocked unless you have verified there are no untracked broker positions.
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Select label="Decision mode" value={mode} onChange={value => setMode(value as RiskDisciplineMode)} options={[{ value: 'PAPER', label: 'Paper trade decision' }, { value: 'CONTROLLED_LIVE_PREVIEW', label: 'Controlled-live readiness preview' }]} />
        <Input label="Underlying symbol" value={symbol} onChange={setSymbol} />
        <Select label="Option" value={optionType} onChange={value => setOptionType(value as 'CE' | 'PE')} options={[{ value: 'CE', label: 'BUY CE' }, { value: 'PE', label: 'BUY PE' }]} />
        <Input label="Exact expiry" type="date" value={expiry} onChange={setExpiry} />
        <Input label="Exact strike" type="number" value={strike} onChange={setStrike} placeholder="e.g. 3000" />
        <Input label="Correlation group" value={correlationGroup} onChange={setCorrelationGroup} />
        <Input label="Premium entry estimate (₹)" type="number" value={entry} onChange={setEntry} />
        <Input label="Premium stop (₹)" type="number" value={stop} onChange={setStop} />
        <Input label="Premium target (₹)" type="number" value={target} onChange={setTarget} />
        <Input label="Lot size" type="number" value={lotSize} onChange={setLotSize} />
        <Input label="Estimated round-trip costs (₹)" type="number" value={costs} onChange={setCosts} />
      </div>
      <p className="text-[11px] text-slate-500">The entry estimate is used for the first decision. Opening fetches the exact Groww premium and re-runs every hard gate at that observed price within a two-minute decision window.</p>

      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">Operational gates</p>
          <button className="text-xs text-blue-600" onClick={markTechnicalGates}>Mark technical gates passed for simulation</button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          {GATES.map(row => <label key={row.key} className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-800 p-2.5 text-xs">
            <input type="checkbox" checked={gates[row.key]} onChange={event => setGates(current => ({ ...current, [row.key]: event.target.checked }))} />
            <span>{row.label}</span>
          </label>)}
        </div>
      </div>

      {mode === 'CONTROLLED_LIVE_PREVIEW' && <div className="space-y-3 rounded-lg border border-amber-200 dark:border-amber-900 p-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <StatCard label="Verified paper trades" value={String(lifecycleEvidence.paper_trades)} />
          <StatCard label="Clean sessions" value="0" subvalue="Not attested in v1" accent="red" />
          <StatCard label="Expectancy" value={lifecycleEvidence.expectancy_r.toFixed(3) + 'R'} />
          <StatCard label="Profit factor" value={lifecycleEvidence.profit_factor.toFixed(2)} />
          <StatCard label="Max drawdown" value={lifecycleEvidence.max_drawdown_r.toFixed(2) + 'R'} />
        </div>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={manualApproval} onChange={event => setManualApproval(event.target.checked)} />Manual approval recorded (preview evidence only)</label>
        <p className="text-[11px] text-amber-700 dark:text-amber-300">Controlled-live cannot become eligible because clean sessions are deliberately not inferred from trade outcomes.</p>
      </div>}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-slate-500">Capital {formatCurrency(tradingCapital, true)} · {lifecycleInputs.open_positions.length} verified paper opens · {lifecycleInputs.closed_trades.length} verified paper closes</p>
        <Button variant="primary" onClick={() => void evaluate()} disabled={running || tradingCapital <= 0}>{running ? 'Evaluating…' : 'Evaluate hard gates'}</Button>
      </div>

      {error && <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900 p-3 text-sm text-red-600"><AlertTriangle size={17} className="shrink-0" />{error}</div>}
      {openNotice && <div className="flex items-start gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900 p-3 text-sm text-emerald-600"><CheckCircle2 size={17} className="shrink-0" />{openNotice}</div>}

      {result && <div className="space-y-4 border-t border-slate-200 dark:border-slate-800 pt-4">
        <div className={'rounded-lg border p-4 ' + (result.final_action === 'PAPER_TRADE_ONLY' ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20' : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20')}>
          <div className="flex items-start gap-3">
            {result.final_action === 'PAPER_TRADE_ONLY' ? <ShieldCheck className="text-emerald-500 shrink-0" /> : <ShieldX className="text-red-500 shrink-0" />}
            <div className="flex-1">
              <p className="font-bold">{result.final_action.replace(/_/g, ' ')}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">Live execution enabled: NO · Controlled-live evidence eligible: {result.controlled_live_preview_eligible ? 'YES (preview only)' : 'NO'}</p>
            </div>
            {result.final_action === 'PAPER_TRADE_ONLY' && mode === 'PAPER' && <Button variant="primary" onClick={() => void openApprovedPaperTrade()} disabled={opening || Boolean(openedTradeId)}>{openedTradeId ? 'Paper position opened' : opening ? 'Opening…' : 'Open exact paper position'}</Button>}
          </div>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Available trade risk" value={formatCurrency(result.budgets.available_trade_risk_rupees, true)} accent="amber" />
          <StatCard label="Maximum quantity" value={String(result.position_sizing.max_quantity)} subvalue={String(result.position_sizing.max_lots) + ' whole lots'} accent="blue" />
          <StatCard label="Potential loss" value={formatCurrency(result.position_sizing.potential_loss_rupees, true)} accent="red" />
          <StatCard label="Net R:R" value={result.position_sizing.net_risk_reward.toFixed(2) + ':1'} accent={result.position_sizing.net_risk_reward >= 1.5 ? 'green' : 'red'} />
          <StatCard label="Today's P&L" value={formatCurrency(result.risk_state.daily_pnl_rupees, true)} accent={result.risk_state.daily_pnl_rupees < 0 ? 'red' : 'green'} />
          <StatCard label="Open risk" value={formatCurrency(result.risk_state.open_risk_rupees, true)} subvalue={result.risk_state.open_risk_pct.toFixed(2) + '% of capital'} />
          <StatCard label="Loss streak" value={String(result.risk_state.consecutive_losses)} accent={result.risk_state.consecutive_losses >= 3 ? 'red' : 'default'} />
          <StatCard label="Closed-trade drawdown" value={result.risk_state.max_drawdown_pct.toFixed(2) + '%'} accent={result.risk_state.max_drawdown_pct >= 8 ? 'red' : 'default'} />
        </div>
        {result.blockers.length ? <div className="rounded-lg border border-red-200 dark:border-red-900 p-3">
          <p className="text-xs font-semibold text-red-600 mb-2">Hard blockers</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">{result.blockers.map(code => <p key={code} className="text-xs text-slate-600 dark:text-slate-400">• {label(code)}</p>)}</div>
        </div> : <div className="flex items-center gap-2 rounded-lg border border-emerald-200 dark:border-emerald-900 p-3 text-xs text-emerald-600"><CheckCircle2 size={16} />All v1 gates passed for a paper trade only.</div>}
        {result.mode === 'CONTROLLED_LIVE_PREVIEW' && <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
          <p className="text-xs font-semibold mb-2">Controlled-live evidence checks</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">{result.arming_checks.map(check => <div key={check.code} className="flex items-center justify-between gap-3 text-xs">
            <span className="text-slate-600 dark:text-slate-400">{label(check.code)}</span>
            <Badge variant={check.passed ? 'green' : 'red'}>{check.passed ? 'PASS' : 'NEEDS ' + check.required}</Badge>
          </div>)}</div>
        </div>}
        <p className="text-[11px] text-slate-500">Evaluated {new Date(result.evaluated_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST · {result.protocol_revision} · deterministic output only</p>
      </div>}
    </CardBody>
  </Card>;
}
