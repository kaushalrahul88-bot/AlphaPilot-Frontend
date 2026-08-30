import { useMemo, useState } from 'react';
import { Activity, Download, Play, RotateCcw } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';
import {
  clearMarketBrainV6Ledger,
  exportMarketBrainV6Ledger,
  newMarketBrainV6Ledger,
  readMarketBrainV6Ledger,
  saveMarketBrainV6Ledger,
  type MarketBrainV6Decision,
  type MarketBrainV6Ledger,
} from '@/lib/marketBrainV6ResearchStorage';

type Summary = { trades:number; avg_r:number; win_rate:number; total_r:number };
type Effect = { label:string; direction:string; feature:string; value:string; trades:number; avg_r:number; win_rate:number; baseline_trades:number; baseline_avg_r:number; baseline_win_rate:number; delta_avg_r:number; delta_win_rate_pp:number; state:'BOOST'|'DRAG'|'MIXED'|'LOW_SAMPLE' };
type V6 = { overall:Summary; baseline_by_direction:Record<string,Summary>; effects:Effect[]; hypotheses_tested:number; eligible_hypotheses:number; boosts:number; drags:number; matched_trades:number; match_rate_pct:number; excluded_without_prior_same_day_context:number; prior_observation_rule:string; fixed_effect_rules:{min_group_trades:number;delta_avg_r:number;delta_win_rate_pp:number}; feature_rules:Record<string,string> };
type Result = { setup_trades:number; eligible_setup_trades:number; v6_dynamic_context:V6 };
type Block = { id:string; start:string; end:string };
type ReplicatedEffect = { label:string; state:'BOOST'|'DRAG'; blocks:string; trades:number; avgR:number };

const BLOCKS: Block[] = [
  { id:'S-0A', start:'2026-05-25', end:'2026-06-05' },
  { id:'S-0B', start:'2026-06-08', end:'2026-06-19' },
  { id:'S-0C', start:'2026-06-22', end:'2026-07-03' },
  { id:'S-1', start:'2026-07-06', end:'2026-07-17' },
  { id:'S-2', start:'2026-07-20', end:'2026-07-31' },
  { id:'S-3', start:'2026-08-03', end:'2026-08-10' },
];
const BLOCK_IDS = BLOCKS.map(block => block.id);
const REQUIRED_REPLICATION_BLOCKS = 3;

function isResult(value: unknown): value is Result {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<Result>;
  return Number.isFinite(result.setup_trades)
    && Number.isFinite(result.v6_dynamic_context?.matched_trades)
    && Array.isArray(result.v6_dynamic_context?.effects);
}

async function runBlock(block: Block): Promise<Result> {
  const response = await fetch(`${ALPHAPILOT_API_BASE}/v1/research/market-brain-v6-dynamic-context`, {
    method:'POST',
    headers:{ 'Content-Type':'application/json' },
    body:JSON.stringify({ start_date:block.start, end_date:block.end }),
  });
  if (!response.ok) {
    let detail = '';
    try {
      const payload = await response.json();
      detail = payload?.detail ? `: ${payload.detail}` : '';
    } catch {
      // ignore malformed upstream error bodies
    }
    throw new Error(`${block.id} API ${response.status}${detail}`);
  }
  return response.json();
}

function replicatedEffects(results: Record<string, Result>): ReplicatedEffect[] {
  const groups = new Map<string, { boosts:{ block:string; effect:Effect }[]; drags:{ block:string; effect:Effect }[] }>();
  for (const block of BLOCKS) {
    const effects = results[block.id]?.v6_dynamic_context.effects || [];
    for (const effect of effects) {
      if (effect.state !== 'BOOST' && effect.state !== 'DRAG') continue;
      const group = groups.get(effect.label) || { boosts:[], drags:[] };
      group[effect.state === 'BOOST' ? 'boosts' : 'drags'].push({ block:block.id, effect });
      groups.set(effect.label, group);
    }
  }
  const replicated: ReplicatedEffect[] = [];
  for (const [label, group] of groups) {
    const state = group.boosts.length >= REQUIRED_REPLICATION_BLOCKS && group.drags.length === 0
      ? 'BOOST'
      : group.drags.length >= REQUIRED_REPLICATION_BLOCKS && group.boosts.length === 0
        ? 'DRAG'
        : null;
    if (!state) continue;
    const observations = state === 'BOOST' ? group.boosts : group.drags;
    const trades = observations.reduce((sum, item) => sum + item.effect.trades, 0);
    const weighted = observations.reduce((sum, item) => sum + item.effect.avg_r * item.effect.trades, 0);
    replicated.push({ label, state, blocks:observations.map(item => item.block).join(', '), trades, avgR:trades ? weighted / trades : 0 });
  }
  return replicated.sort((a, b) => b.trades - a.trades);
}

function resultMap(ledger: MarketBrainV6Ledger<Result>): Record<string, Result> {
  return Object.fromEntries(Object.entries(ledger.blocks).map(([id, record]) => [id, record.result]));
}

function decision(results: Record<string, Result>, replicated: ReplicatedEffect[]): MarketBrainV6Decision {
  if (Object.keys(results).length < BLOCKS.length) return 'INCOMPLETE';
  return replicated.length ? 'REPLICATED_DYNAMIC_CONTEXT_CANDIDATE' : 'NO_REPLICATED_DYNAMIC_CONTEXT_EFFECT';
}

function fmtR(value: number) {
  return `${value >= 0 ? '+' : ''}${Number(value || 0).toFixed(3)}R`;
}

export function MarketBrainDynamicContextResearch() {
  const [ledger, setLedger] = useState<MarketBrainV6Ledger<Result>>(() => readMarketBrainV6Ledger(BLOCK_IDS, isResult));
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState<string | null>(ledger.last_error);
  const results = useMemo(() => resultMap(ledger), [ledger]);
  const replicated = useMemo(() => replicatedEffects(results), [results]);

  async function run() {
    if (running || Object.keys(results).length === BLOCKS.length) return;
    setRunning(true);
    setError(null);
    let working = { ...ledger, last_error:null, updated_at:new Date().toISOString() };
    saveMarketBrainV6Ledger(working);
    try {
      for (const block of BLOCKS) {
        if (working.blocks[block.id]) continue;
        setProgress(`Running ${block.id} · ${block.start} → ${block.end}`);
        const result = await runBlock(block);
        if (!result.v6_dynamic_context) throw new Error(`${block.id} backend has not deployed Market Brain v6 yet.`);
        const completedAt = new Date().toISOString();
        working = {
          ...working,
          updated_at:completedAt,
          blocks:{
            ...working.blocks,
            [block.id]:{ block_id:block.id, start_date:block.start, end_date:block.end, completed_at:completedAt, result },
          },
        };
        setLedger(working);
        saveMarketBrainV6Ledger(working);
        await new Promise(resolve => setTimeout(resolve, 700));
      }
      const finishedResults = resultMap(working);
      const finalDecision = decision(finishedResults, replicatedEffects(finishedResults));
      const completedAt = new Date().toISOString();
      working = { ...working, updated_at:completedAt, completed_at:completedAt, decision:finalDecision, last_error:null };
      setLedger(working);
      saveMarketBrainV6Ledger(working);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Market Brain v6 failed.';
      const failed = { ...working, updated_at:new Date().toISOString(), last_error:message };
      setError(message);
      setLedger(failed);
      saveMarketBrainV6Ledger(failed);
    } finally {
      setProgress('');
      setRunning(false);
    }
  }

  function reset() {
    if (running) return;
    clearMarketBrainV6Ledger();
    const fresh = newMarketBrainV6Ledger<Result>(BLOCK_IDS);
    setLedger(fresh);
    setError(null);
    setProgress('');
  }

  const completed = Object.keys(results).length;
  const totalMatched = Object.values(results).reduce((sum, result) => sum + result.v6_dynamic_context.matched_trades, 0);
  const tested = Object.values(results).reduce((sum, result) => sum + result.v6_dynamic_context.hypotheses_tested, 0);
  const eligible = Object.values(results).reduce((sum, result) => sum + result.v6_dynamic_context.eligible_hypotheses, 0);
  const currentDecision = decision(results, replicated);
  const runLabel = running ? 'Running v6…' : completed ? `Resume v6 · ${completed}/${BLOCKS.length}` : 'Run Market Brain v6';
  const firstV6 = results[BLOCKS.find(block => results[block.id])?.id || '']?.v6_dynamic_context;

  return <Card><CardHeader title="Market Brain v6 — Dynamic Context Replication" subtitle="Setup-time breadth, flow, leadership and index alignment changes. Frozen six-block protocol; production remains unchanged." action={<Activity size={18} className="text-cyan-500"/>}/><CardBody className="space-y-4">
    <div className="flex gap-2 flex-wrap"><Badge variant="blue">MARKET BRAIN v6</Badge><Badge variant="default">6 FIXED BLOCKS</Badge><Badge variant="default">PRIOR 15-MIN CONTEXT</Badge><Badge variant="default">SAME-DAY ONLY</Badge><Badge variant="default">3-BLOCK REPLICATION</Badge><Badge variant="default">RESUMABLE LEDGER</Badge><Badge variant="default">NO RETUNING</Badge><Badge variant="default">PRODUCTION UNCHANGED</Badge></div>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-xs text-slate-500 max-w-4xl">Frozen features: breadth impulse and persistence, flow impulse and persistence, leadership broadening/narrowing, and current NIFTY/BANKNIFTY phase alignment. Each effect is compared only with the same-direction setup baseline.</p><div className="flex flex-wrap gap-2"><Button variant="primary" onClick={() => void run()} disabled={running || completed === BLOCKS.length}><Play size={14} className="inline mr-1"/>{completed === BLOCKS.length ? 'v6 Complete' : runLabel}</Button><Button variant="default" onClick={() => exportMarketBrainV6Ledger(ledger)} disabled={!completed}><Download size={14} className="inline mr-1"/>Export Ledger</Button><Button variant="default" onClick={reset} disabled={running || !completed}><RotateCcw size={14} className="inline mr-1"/>Reset Run</Button></div></div>
    <div className="rounded-lg border p-3 text-xs"><div className="flex flex-wrap items-center justify-between gap-2"><span><strong>Checkpoint:</strong> {completed}/{BLOCKS.length} blocks saved</span><Badge variant={completed === BLOCKS.length ? 'green' : completed ? 'blue' : 'default'}>{completed === BLOCKS.length ? 'COMPLETE' : completed ? 'RESUMABLE' : 'NOT STARTED'}</Badge></div><p className="text-[11px] text-slate-500 mt-1">Protocol {ledger.protocol_revision} · created {new Date(ledger.created_at).toLocaleString('en-IN')} · updated {new Date(ledger.updated_at).toLocaleString('en-IN')}</p></div>
    {progress && <div className="rounded-lg border p-3 text-xs">{progress}</div>}{error && <div className="rounded-lg border border-red-200 p-3 text-sm text-red-600">{error} Completed blocks remain saved; press Resume after the API is available.</div>}
    <div className="overflow-x-auto rounded-lg border"><table className="w-full text-xs"><thead className="bg-slate-50 dark:bg-slate-900"><tr><th className="p-2 text-left">Block</th><th>Dates</th><th>Setups</th><th>Eligible</th><th>Dynamic matched</th><th>Match</th><th>Avg R</th><th>Win</th><th>Hypotheses</th><th>Eligible H</th><th>Boosts</th><th>Drags</th><th>Status</th></tr></thead><tbody>{BLOCKS.map(block => { const result = results[block.id], v6 = result?.v6_dynamic_context; return <tr key={block.id} className="border-t"><td className="p-2 font-semibold">{block.id}</td><td>{block.start} → {block.end}</td><td className="text-center">{result?.setup_trades ?? '—'}</td><td className="text-center">{result?.eligible_setup_trades ?? '—'}</td><td className="text-center">{v6?.matched_trades ?? '—'}</td><td className="text-center">{v6?.match_rate_pct != null ? `${v6.match_rate_pct.toFixed(1)}%` : '—'}</td><td className="text-center">{v6 ? fmtR(v6.overall.avg_r) : '—'}</td><td className="text-center">{v6 ? `${v6.overall.win_rate.toFixed(1)}%` : '—'}</td><td className="text-center">{v6?.hypotheses_tested ?? '—'}</td><td className="text-center">{v6?.eligible_hypotheses ?? '—'}</td><td className="text-center">{v6?.boosts ?? '—'}</td><td className="text-center">{v6?.drags ?? '—'}</td><td className="text-center"><Badge variant={result ? 'green' : 'default'}>{result ? 'SAVED' : 'PENDING'}</Badge></td></tr> })}</tbody></table></div>
    {completed > 0 && <div className="grid grid-cols-2 md:grid-cols-6 gap-3"><Stat label="Completed blocks" value={`${completed}/${BLOCKS.length}`}/><Stat label="Dynamic matched" value={String(totalMatched)}/><Stat label="Hypotheses tested" value={String(tested)}/><Stat label="Eligible hypotheses" value={String(eligible)}/><Stat label="Replicated effects" value={String(replicated.length)}/><div className="rounded-lg border p-3"><p className="text-xs text-slate-500">Decision</p><Badge variant={replicated.length ? 'blue' : 'default'}>{currentDecision}</Badge></div></div>}
    {replicated.length > 0 && <div className="overflow-x-auto rounded-lg border"><table className="w-full text-xs"><thead><tr><th className="p-2 text-left">Replicated dynamic effect</th><th>Effect</th><th>Blocks</th><th>Trades</th><th>Weighted Avg R</th></tr></thead><tbody>{replicated.map(effect => <tr key={`${effect.label}-${effect.state}`} className="border-t"><td className="p-2 font-medium">{effect.label}</td><td className="text-center"><Badge variant={effect.state === 'BOOST' ? 'green' : 'red'}>{effect.state}</Badge></td><td className="text-center">{effect.blocks}</td><td className="text-center">{effect.trades}</td><td className="text-center font-semibold">{fmtR(effect.avgR)}</td></tr>)}</tbody></table></div>}
    {completed > 0 && <div className="space-y-2"><p className="text-sm font-semibold">Qualifying block effects</p>{BLOCKS.map(block => { const v6 = results[block.id]?.v6_dynamic_context; if (!v6) return null; const rows = v6.effects.filter(effect => effect.state === 'BOOST' || effect.state === 'DRAG'); return <div key={block.id}><p className="text-xs font-semibold mb-1">{block.id}</p>{rows.length ? <div className="overflow-x-auto rounded-lg border"><table className="w-full text-xs"><thead><tr><th className="p-2 text-left">Dynamic context</th><th>Trades</th><th>Baseline N</th><th>Avg R</th><th>Δ Avg R</th><th>Win</th><th>Δ Win</th><th>Effect</th></tr></thead><tbody>{rows.map(effect => <tr key={effect.label} className="border-t"><td className="p-2 font-medium">{effect.label}</td><td className="text-center">{effect.trades}</td><td className="text-center">{effect.baseline_trades}</td><td className="text-center">{fmtR(effect.avg_r)}</td><td className="text-center">{fmtR(effect.delta_avg_r)}</td><td className="text-center">{effect.win_rate.toFixed(1)}%</td><td className="text-center">{effect.delta_win_rate_pp >= 0 ? '+' : ''}{effect.delta_win_rate_pp.toFixed(1)}pp</td><td className="text-center"><Badge variant={effect.state === 'BOOST' ? 'green' : 'red'}>{effect.state}</Badge></td></tr>)}</tbody></table></div> : <p className="text-xs text-slate-500">No fixed BOOST/DRAG dynamic-context effect in this block.</p>}</div> })}</div>}
    {firstV6 && <div><p className="text-sm font-semibold mb-2">Frozen dynamic feature definitions</p><div className="grid grid-cols-1 md:grid-cols-3 gap-3">{Object.entries(firstV6.feature_rules).map(([key, value]) => <div className="rounded-lg border p-3" key={key}><p className="text-xs font-semibold">{key}</p><p className="text-[11px] text-slate-500 mt-1">{value}</p></div>)}</div></div>}
    <p className="text-[11px] text-slate-500">A setup is dynamically matched only when context exists exactly 15 minutes earlier on the same IST trading day. The ledger survives refreshes on this device and exports as JSON. Even a replicated effect remains only a frozen candidate for untouched validation.</p>
  </CardBody></Card>;
}

function Stat({ label, value }: { label:string; value:string }) {
  return <div className="rounded-lg border p-3"><p className="text-xs text-slate-500">{label}</p><p className="text-lg font-bold">{value}</p></div>;
}
