import { useMemo, useState } from 'react';
import { BrainCircuit, Download, LockKeyhole, Play, RotateCcw } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';
import {
  clearMarketBrainV7Ledger,
  exportMarketBrainV7Ledger,
  newMarketBrainV7Ledger,
  readMarketBrainV7Ledger,
  saveMarketBrainV7Ledger,
  type MarketBrainV7Decision,
  type MarketBrainV7Ledger,
} from '@/lib/marketBrainV7ResearchStorage';

type Role = 'DEVELOPMENT' | 'HOLDOUT';
type Block = { id:string; start:string; end:string; role:Role };
type Observation = {
  observation_id:string;
  block_id:string;
  role:Role;
  symbol:string;
  timestamp:string;
  direction:'LONG'|'SHORT';
  r_multiple:number;
  win:0|1;
  features:Record<string,number>;
};
type Summary = { trades:number; avg_r:number; win_rate:number; total_r:number };
type BlockResult = {
  block_id:string;
  role:Role;
  start_date:string;
  end_date:string;
  setup_trades:number;
  eligible_setup_trades:number;
  matched_observations:number;
  match_rate_pct:number;
  overall:Summary;
  feature_names:string[];
  observations:Observation[];
  context_errors:{symbol:string;error:string}[];
  backtest_errors:{symbol:string;error:string}[];
};
type ProbabilityMetrics = {
  baseline_probability:number;
  model_brier:number;
  baseline_brier:number;
  brier_improvement_pct:number;
  model_log_loss:number;
  baseline_log_loss:number;
  log_loss_improvement_pct:number;
  roc_auc:number|null;
};
type ProbabilityBand = {
  band:'LOW'|'MID'|'HIGH';
  trades:number;
  avg_probability:number;
  win_rate:number;
  avg_r:number;
  total_r:number;
};
type Evaluation = {
  decision:MarketBrainV7Decision;
  development:{observations:number;wins:number;win_rate:number;period:string};
  holdout:{observations:number;wins:number;non_wins:number;win_rate:number;period:string};
  model:{
    type:string;
    feature_names:string[];
    iterations:number;
    learning_rate:number;
    l2:number;
    intercept:number;
    standardized_coefficients:Record<string,number>;
    training_means:Record<string,number>;
    training_scales:Record<string,number>;
  };
  probability_metrics:ProbabilityMetrics;
  probability_bands:ProbabilityBand[];
  economic_spreads:{high_minus_low_win_rate_pp:number;high_minus_low_avg_r:number};
  acceptance_gates:Record<string,boolean>;
  fixed_acceptance_rules:Record<string,number>;
  predictions:unknown[];
};

const BLOCKS: Block[] = [
  { id:'S-0A', start:'2026-05-25', end:'2026-06-05', role:'DEVELOPMENT' },
  { id:'S-0B', start:'2026-06-08', end:'2026-06-19', role:'DEVELOPMENT' },
  { id:'S-0C', start:'2026-06-22', end:'2026-07-03', role:'DEVELOPMENT' },
  { id:'S-1', start:'2026-07-06', end:'2026-07-17', role:'DEVELOPMENT' },
  { id:'S-2', start:'2026-07-20', end:'2026-07-31', role:'DEVELOPMENT' },
  { id:'S-3', start:'2026-08-03', end:'2026-08-10', role:'DEVELOPMENT' },
  { id:'H-1', start:'2026-08-11', end:'2026-08-21', role:'HOLDOUT' },
];
const BLOCK_IDS = BLOCKS.map(block => block.id);

const OFFICIAL_RESULT = {
  decision:'NO_VALIDATED_CONTINUOUS_REGIME_QUALITY_EDGE',
  developmentObservations:247,
  holdoutObservations:48,
  holdoutWinRate:37.5,
  holdoutAvgR:-0.132,
  holdoutTotalR:-6.34,
  probabilityMetrics:{
    modelBrier:0.253218,
    baselineBrier:0.251555,
    brierImprovementPct:-0.66,
    modelLogLoss:0.699604,
    baselineLogLoss:0.696258,
    logLossImprovementPct:-0.48,
    rocAuc:0.505556,
  },
  bands:[
    { band:'LOW', trades:16, avgProbability:0.4728, winRate:31.2, avgR:-0.221, totalR:-3.54 },
    { band:'MID', trades:16, avgProbability:0.5062, winRate:43.8, avgR:-0.094, totalR:-1.51 },
    { band:'HIGH', trades:16, avgProbability:0.5522, winRate:37.5, avgR:-0.081, totalR:-1.29 },
  ],
  economicSpreads:{ winRatePp:6.3, avgR:0.140 },
  gates:{
    sample_gate:true,
    brier_improvement_at_least_10pct:false,
    log_loss_improvement_at_least_5pct:false,
    auc_at_least_0_60:false,
    high_minus_low_win_rate_at_least_10pp:false,
    high_minus_low_avg_r_at_least_0_20:false,
    high_avg_r_at_least_0_10:false,
  },
  coefficients:{
    breadth_alignment:-0.00914699,
    flow_alignment:-0.02834857,
    nifty_vwap_alignment:0,
    bank_vwap_alignment:0,
    nifty_trend_alignment:-0.1026228,
    bank_trend_alignment:0.16038051,
    volatility_expansion:0.0889277,
  },
} as const;

function isBlockResult(value: unknown): value is BlockResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<BlockResult>;
  return typeof result.block_id === 'string'
    && Number.isFinite(result.matched_observations)
    && Array.isArray(result.observations)
    && Array.isArray(result.feature_names);
}

function isEvaluation(value: unknown): value is Evaluation {
  if (!value || typeof value !== 'object') return false;
  const evaluation = value as Partial<Evaluation>;
  return typeof evaluation.decision === 'string'
    && Boolean(evaluation.probability_metrics)
    && Array.isArray(evaluation.probability_bands)
    && Boolean(evaluation.acceptance_gates);
}

async function responseDetail(response: Response) {
  try {
    const payload = await response.json();
    return payload?.detail ? `: ${payload.detail}` : '';
  } catch {
    return '';
  }
}

async function runObservationBlock(block: Block): Promise<BlockResult> {
  const response = await fetch(`${ALPHAPILOT_API_BASE}/v1/research/market-brain-v7-observations`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({
      start_date:block.start,
      end_date:block.end,
      role:block.role,
    }),
  });
  if (!response.ok) {
    throw new Error(`${block.id} API ${response.status}${await responseDetail(response)}`);
  }
  return response.json();
}

async function runEvaluation(
  development: Observation[],
  holdout: Observation[],
): Promise<Evaluation> {
  const response = await fetch(`${ALPHAPILOT_API_BASE}/v1/research/market-brain-v7-evaluate`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ development, holdout }),
  });
  if (!response.ok) {
    throw new Error(`v7 evaluation API ${response.status}${await responseDetail(response)}`);
  }
  return response.json();
}

function resultMap(ledger: MarketBrainV7Ledger<BlockResult, Evaluation>) {
  return Object.fromEntries(
    Object.entries(ledger.blocks).map(([id, record]) => [id, record.result]),
  ) as Record<string, BlockResult>;
}

function fmtR(value: number) {
  return `${value >= 0 ? '+' : ''}${Number(value || 0).toFixed(3)}R`;
}

function fmtPct(value: number) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function readableGate(name: string) {
  return name
    .replaceAll('_', ' ')
    .replace('0 60', '0.60')
    .replace('0 20', '0.20')
    .replace('0 10', '0.10');
}

export function MarketBrainContinuousRegimeResearch() {
  const [ledger, setLedger] = useState<MarketBrainV7Ledger<BlockResult, Evaluation>>(
    () => readMarketBrainV7Ledger(BLOCK_IDS, isBlockResult, isEvaluation),
  );
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string|null>(ledger.last_error);
  const results = useMemo(() => resultMap(ledger), [ledger]);
  const completed = Object.keys(results).length;
  const evaluation = ledger.evaluation;

  async function run() {
    if (running || evaluation) return;
    setRunning(true);
    setError(null);
    let working: MarketBrainV7Ledger<BlockResult, Evaluation> = {
      ...ledger,
      last_error:null,
      updated_at:new Date().toISOString(),
    };
    saveMarketBrainV7Ledger(working);
    try {
      for (const block of BLOCKS) {
        if (working.blocks[block.id]) continue;
        setProgress(`Collecting ${block.id} · ${block.role} · ${block.start} → ${block.end}`);
        const result = await runObservationBlock(block);
        if (result.block_id !== block.id || result.role !== block.role) {
          throw new Error(`${block.id} returned a protocol identity mismatch.`);
        }
        const completedAt = new Date().toISOString();
        working = {
          ...working,
          updated_at:completedAt,
          blocks:{
            ...working.blocks,
            [block.id]:{
              block_id:block.id,
              role:block.role,
              start_date:block.start,
              end_date:block.end,
              completed_at:completedAt,
              result,
            },
          },
        };
        setLedger(working);
        saveMarketBrainV7Ledger(working);
        await new Promise(resolve => setTimeout(resolve, 700));
      }

      const finished = resultMap(working);
      const development = BLOCKS
        .filter(block => block.role === 'DEVELOPMENT')
        .flatMap(block => finished[block.id]?.observations || []);
      const holdout = finished['H-1']?.observations || [];
      setProgress(`Fitting on ${development.length} development observations and scoring locked H-1 once`);
      const finalEvaluation = await runEvaluation(development, holdout);
      const completedAt = new Date().toISOString();
      working = {
        ...working,
        updated_at:completedAt,
        completed_at:completedAt,
        decision:finalEvaluation.decision,
        evaluation:finalEvaluation,
        last_error:null,
      };
      setLedger(working);
      saveMarketBrainV7Ledger(working);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Market Brain v7 failed.';
      const failed = {
        ...working,
        updated_at:new Date().toISOString(),
        last_error:message,
      };
      setError(message);
      setLedger(failed);
      saveMarketBrainV7Ledger(failed);
    } finally {
      setProgress('');
      setRunning(false);
    }
  }

  function reset() {
    if (running) return;
    clearMarketBrainV7Ledger();
    const fresh = newMarketBrainV7Ledger<BlockResult, Evaluation>(BLOCK_IDS);
    setLedger(fresh);
    setError(null);
    setProgress('');
  }

  const developmentMatches = BLOCKS
    .filter(block => block.role === 'DEVELOPMENT')
    .reduce((sum, block) => sum + (results[block.id]?.matched_observations || 0), 0);
  const holdoutMatches = results['H-1']?.matched_observations || 0;
  const dataErrors = Object.values(results).reduce(
    (sum, result) => sum + result.context_errors.length + result.backtest_errors.length,
    0,
  );
  return <Card><CardHeader title="Market Brain v7 — Continuous Regime Quality" subtitle="The locked 11–21 August holdout is complete. The continuous model did not validate; production remains unchanged." action={<BrainCircuit size={18} className="text-indigo-500"/>}/><CardBody className="space-y-4">
    <div className="flex gap-2 flex-wrap"><Badge variant="blue">MARKET BRAIN v7</Badge><Badge variant="red">FROZEN CLOSED</Badge><Badge variant="default">7 CONTINUOUS FEATURES</Badge><Badge variant="default">L2 LOGISTIC</Badge><Badge variant="default">CALIBRATION FIRST</Badge><Badge variant="default">LOCKED H-1</Badge><Badge variant="default">RESUMABLE LEDGER</Badge><Badge variant="default">NO RETUNING</Badge><Badge variant="default">PRODUCTION UNCHANGED</Badge></div>

    <div className="flex flex-wrap items-center justify-between gap-3"><div className="max-w-4xl space-y-1"><p className="text-xs text-slate-500">Development ends 10 August. H-1 covers 11–21 August and is scored once after all development observations are saved. Acceptance requires better Brier score, log loss, AUC and economic ordering—not merely a positive pooled result.</p><p className="text-[11px] text-slate-500 flex items-center gap-1"><LockKeyhole size={12}/>The backend rejects any observation outside its frozen development or holdout dates.</p></div><div className="flex flex-wrap gap-2"><Button variant="primary" onClick={() => void run()} disabled><Play size={14} className="inline mr-1"/>v7 Closed</Button><Button variant="default" onClick={() => exportMarketBrainV7Ledger(ledger)} disabled={!completed}><Download size={14} className="inline mr-1"/>Export Ledger</Button><Button variant="default" onClick={reset} disabled={running || !completed}><RotateCcw size={14} className="inline mr-1"/>Reset Run</Button></div></div>

    <div className="rounded-lg border border-indigo-200 p-3 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><span><strong>Official checkpoint:</strong> 247 development observations fitted · 48 locked H-1 observations scored once</span><Badge variant="green">EVIDENCE SAVED</Badge></div><p className="text-[11px] text-slate-500 mt-1">Protocol v7-frozen-2026-08-25 · decision {OFFICIAL_RESULT.decision} · GitHub Actions run 32829764385</p></div>

    {progress && <div className="rounded-lg border p-3 text-xs">{progress}</div>}
    {error && <div className="rounded-lg border border-red-200 p-3 text-sm text-red-600">{error} Saved blocks remain intact; Resume will skip them and retry the unfinished step.</div>}

    {completed > 0 && <div className="overflow-x-auto rounded-lg border"><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-900"><tr><th className="p-2 text-left">Block</th><th>Role</th><th>Dates</th><th>Setups</th><th>Eligible</th><th>Matched</th><th>Match</th><th>Avg R</th><th>Win</th><th>Errors</th><th>Status</th></tr></thead><tbody>{BLOCKS.map(block => { const result = results[block.id]; const errors = result ? result.context_errors.length + result.backtest_errors.length : 0; return <tr key={block.id} className="border-t"><td className="p-2 font-semibold">{block.id}</td><td className="text-center"><Badge variant={block.role === 'HOLDOUT' ? 'blue' : 'default'}>{block.role}</Badge></td><td className="text-center">{block.start} → {block.end}</td><td className="text-center">{result?.setup_trades ?? '—'}</td><td className="text-center">{result?.eligible_setup_trades ?? '—'}</td><td className="text-center">{result?.matched_observations ?? '—'}</td><td className="text-center">{result ? fmtPct(result.match_rate_pct) : '—'}</td><td className="text-center">{result ? fmtR(result.overall.avg_r) : '—'}</td><td className="text-center">{result ? fmtPct(result.overall.win_rate) : '—'}</td><td className="text-center">{result ? errors : '—'}</td><td className="text-center"><Badge variant={result ? 'green' : 'default'}>{result ? 'SAVED' : 'PENDING'}</Badge></td></tr>})}</tbody></table></div>}

    {completed > 0 && <div className="grid grid-cols-2 md:grid-cols-5 gap-3"><Stat label="Development matches" value={String(developmentMatches)}/><Stat label="Holdout matches" value={String(holdoutMatches)}/><Stat label="Data errors" value={String(dataErrors)}/><Stat label="Evaluation" value={evaluation ? 'SCORED' : 'PENDING'}/><div className="rounded-lg border p-3"><p className="text-xs text-slate-500">Decision</p><Badge variant={evaluation?.decision === 'VALIDATED_CONTINUOUS_REGIME_QUALITY_CANDIDATE' ? 'green' : 'default'}>{evaluation?.decision || 'INCOMPLETE'}</Badge></div></div>}


    <div className="rounded-lg border border-red-200 p-4 space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-sm font-semibold">Official frozen decision</p><p className="text-xs text-slate-500">The sample gate passed, but every predictive and economic gate failed.</p></div><Badge variant="red">{OFFICIAL_RESULT.decision}</Badge></div><div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Stat label="Development observations" value={String(OFFICIAL_RESULT.developmentObservations)}/><Stat label="H-1 observations" value={String(OFFICIAL_RESULT.holdoutObservations)}/><Stat label="H-1 win rate" value={fmtPct(OFFICIAL_RESULT.holdoutWinRate)}/><Stat label="H-1 total R" value={fmtR(OFFICIAL_RESULT.holdoutTotalR)}/></div></div>

    <div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Metric label="Brier improvement" value={fmtPct(OFFICIAL_RESULT.probabilityMetrics.brierImprovementPct)} detail={`${OFFICIAL_RESULT.probabilityMetrics.modelBrier.toFixed(4)} vs ${OFFICIAL_RESULT.probabilityMetrics.baselineBrier.toFixed(4)}`}/><Metric label="Log-loss improvement" value={fmtPct(OFFICIAL_RESULT.probabilityMetrics.logLossImprovementPct)} detail={`${OFFICIAL_RESULT.probabilityMetrics.modelLogLoss.toFixed(4)} vs ${OFFICIAL_RESULT.probabilityMetrics.baselineLogLoss.toFixed(4)}`}/><Metric label="Holdout ROC AUC" value={OFFICIAL_RESULT.probabilityMetrics.rocAuc.toFixed(3)} detail="Frozen gate ≥ 0.60"/><Metric label="HIGH − LOW Avg R" value={fmtR(OFFICIAL_RESULT.economicSpreads.avgR)} detail={`+${OFFICIAL_RESULT.economicSpreads.winRatePp.toFixed(1)}pp win spread`}/></div>

    <div className="overflow-x-auto rounded-lg border"><table className="w-full text-xs"><thead><tr><th className="p-2 text-left">Official probability band</th><th>Trades</th><th>Avg probability</th><th>Actual win</th><th>Avg R</th><th>Total R</th></tr></thead><tbody>{OFFICIAL_RESULT.bands.map(band => <tr key={band.band} className="border-t"><td className="p-2 font-semibold">{band.band}</td><td className="text-center">{band.trades}</td><td className="text-center">{fmtPct(band.avgProbability * 100)}</td><td className="text-center">{fmtPct(band.winRate)}</td><td className="text-center">{fmtR(band.avgR)}</td><td className="text-center">{fmtR(band.totalR)}</td></tr>)}</tbody></table></div>

    <div><p className="text-sm font-semibold mb-2">Official acceptance gates</p><div className="grid grid-cols-1 md:grid-cols-2 gap-2">{Object.entries(OFFICIAL_RESULT.gates).map(([name, passed]) => <div className="rounded-lg border p-3 flex items-center justify-between gap-3" key={name}><span className="text-xs capitalize">{readableGate(name)}</span><Badge variant={passed ? 'green' : 'red'}>{passed ? 'PASS' : 'FAIL'}</Badge></div>)}</div></div>

    <div><p className="text-sm font-semibold mb-2">Frozen standardized coefficients</p><div className="grid grid-cols-1 md:grid-cols-3 gap-2">{Object.entries(OFFICIAL_RESULT.coefficients).map(([name, coefficient]) => <div className="rounded-lg border p-3" key={name}><p className="text-xs text-slate-500">{name}</p><p className="font-semibold">{coefficient >= 0 ? '+' : ''}{coefficient.toFixed(4)}</p></div>)}</div></div>

    {evaluation && <><div className="grid grid-cols-2 md:grid-cols-4 gap-3"><Metric label="Brier improvement" value={fmtPct(evaluation.probability_metrics.brier_improvement_pct)} detail={`${evaluation.probability_metrics.model_brier.toFixed(4)} vs ${evaluation.probability_metrics.baseline_brier.toFixed(4)}`}/><Metric label="Log-loss improvement" value={fmtPct(evaluation.probability_metrics.log_loss_improvement_pct)} detail={`${evaluation.probability_metrics.model_log_loss.toFixed(4)} vs ${evaluation.probability_metrics.baseline_log_loss.toFixed(4)}`}/><Metric label="Holdout ROC AUC" value={evaluation.probability_metrics.roc_auc?.toFixed(3) ?? 'N/A'} detail="Frozen gate ≥ 0.60"/><Metric label="HIGH − LOW Avg R" value={fmtR(evaluation.economic_spreads.high_minus_low_avg_r)} detail={`${evaluation.economic_spreads.high_minus_low_win_rate_pp >= 0 ? '+' : ''}${evaluation.economic_spreads.high_minus_low_win_rate_pp.toFixed(1)}pp win spread`}/></div>

    <div className="overflow-x-auto rounded-lg border"><table className="w-full text-xs"><thead><tr><th className="p-2 text-left">Probability band</th><th>Trades</th><th>Avg probability</th><th>Actual win</th><th>Avg R</th><th>Total R</th></tr></thead><tbody>{evaluation.probability_bands.map(band => <tr key={band.band} className="border-t"><td className="p-2 font-semibold">{band.band}</td><td className="text-center">{band.trades}</td><td className="text-center">{fmtPct(band.avg_probability * 100)}</td><td className="text-center">{fmtPct(band.win_rate)}</td><td className="text-center">{fmtR(band.avg_r)}</td><td className="text-center">{fmtR(band.total_r)}</td></tr>)}</tbody></table></div>

    <div><p className="text-sm font-semibold mb-2">Frozen acceptance gates</p><div className="grid grid-cols-1 md:grid-cols-2 gap-2">{Object.entries(evaluation.acceptance_gates).map(([name, passed]) => <div className="rounded-lg border p-3 flex items-center justify-between gap-3" key={name}><span className="text-xs capitalize">{readableGate(name)}</span><Badge variant={passed ? 'green' : 'red'}>{passed ? 'PASS' : 'FAIL'}</Badge></div>)}</div></div>

    <div><p className="text-sm font-semibold mb-2">Standardized coefficients</p><div className="grid grid-cols-1 md:grid-cols-3 gap-2">{Object.entries(evaluation.model.standardized_coefficients).map(([name, coefficient]) => <div className="rounded-lg border p-3" key={name}><p className="text-xs text-slate-500">{name}</p><p className="font-semibold">{coefficient >= 0 ? '+' : ''}{coefficient.toFixed(4)}</p></div>)}</div></div></>}

    <p className="text-[11px] text-slate-500">The official v7 run is closed and cannot be restarted from the dashboard. Its evidence contains the raw observations, development-only standardization, fitted coefficients, locked holdout predictions, probability bands and all gate outcomes. No v7 output can alter live trading.</p>
  </CardBody></Card>;
}

function Stat({ label, value }: { label:string; value:string }) {
  return <div className="rounded-lg border p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-lg font-bold">{value}</p></div>;
}

function Metric({ label, value, detail }: { label:string; value:string; detail:string }) {
  return <div className="rounded-lg border p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-lg font-bold">{value}</p><p className="text-[11px] text-slate-500 mt-1">{detail}</p></div>;
}
