import { useState } from 'react';
import { Activity, CheckCircle2, RefreshCw, Server, ShieldCheck, ShieldX, XCircle } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { getCandles, getHealth, getMarketNews, getOptionChain, getQuote } from '@/lib/alphaPilotApi';

type CheckStatus = 'IDLE' | 'RUNNING' | 'PASS' | 'FAIL';
type CheckRow = { id: string; label: string; status: CheckStatus; latency?: number; detail?: string };

const INITIAL: CheckRow[] = [
  { id: 'api', label: 'Render API /health', status: 'IDLE' },
  { id: 'quote', label: 'Groww live quote · RELIANCE', status: 'IDLE' },
  { id: 'candles', label: 'Historical candles · RELIANCE 5m', status: 'IDLE' },
  { id: 'options', label: 'Option chain · RELIANCE nearest expiry', status: 'IDLE' },
  { id: 'news', label: 'Live market news · RELIANCE', status: 'IDLE' },
];

export function SystemHealth() {
  const [rows, setRows] = useState<CheckRow[]>(INITIAL);
  const [running, setRunning] = useState(false);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);

  const update = (id: string, patch: Partial<CheckRow>) => setRows(prev => prev.map(row => row.id === id ? { ...row, ...patch } : row));

  const runCheck = async (id: string, fn: () => Promise<any>, validate: (value: any) => string) => {
    update(id, { status: 'RUNNING', latency: undefined, detail: undefined });
    const started = performance.now();
    try {
      const value = await fn();
      update(id, { status: 'PASS', latency: Math.round(performance.now() - started), detail: validate(value) });
      return true;
    } catch (error) {
      update(id, { status: 'FAIL', latency: Math.round(performance.now() - started), detail: error instanceof Error ? error.message : 'Unknown error' });
      return false;
    }
  };

  const runAll = async () => {
    if (running) return;
    setRunning(true);
    setRows(INITIAL.map(row => ({ ...row, status: 'IDLE' })));
    await runCheck('api', getHealth, value => `${value.provider ?? 'UNKNOWN'} · API v${value.version ?? '—'}`);
    await runCheck('quote', () => getQuote('RELIANCE'), value => value?.provider ? `${value.provider} quote response received` : 'Quote response received');
    await runCheck('candles', () => getCandles('RELIANCE', '5m'), value => `${Array.isArray(value?.candles) ? value.candles.length : 0} candles received`);
    await runCheck('options', () => getOptionChain('RELIANCE'), value => `${value?.provider ?? 'Provider'} · expiry ${value?.expiry ?? 'resolved'}`);
    await runCheck('news', () => getMarketNews(['RELIANCE'], 2), value => `${value?.items?.RELIANCE?.length ?? 0} recent headlines received`);
    setCheckedAt(new Date().toISOString());
    setRunning(false);
  };

  const passed = rows.filter(row => row.status === 'PASS').length;
  const failed = rows.filter(row => row.status === 'FAIL').length;
  const complete = passed + failed === rows.length;
  const ready = complete && failed === 0;
  const criticalIds = ['api', 'quote', 'candles', 'options'];
  const criticalFailed = rows.filter(row => criticalIds.includes(row.id) && row.status === 'FAIL');
  const gateState = running ? 'CHECKING' : !complete ? 'NOT CHECKED' : criticalFailed.length ? 'DO NOT START LIVE TEST' : ready ? 'READY FOR LIVE SCAN' : 'REVIEW REQUIRED';
  const gateVariant = gateState === 'READY FOR LIVE SCAN' ? 'green' : gateState === 'DO NOT START LIVE TEST' ? 'red' : 'blue';

  return <div className="space-y-5">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">System Health Check</h1>
        <p className="text-sm text-slate-500">Production connectivity checks to run before the first live NSE validation scan.</p>
      </div>
      <Button variant="primary" onClick={() => void runAll()} disabled={running}><RefreshCw size={15} className={`inline mr-1.5 ${running ? 'animate-spin' : ''}`}/>{running ? 'Checking…' : 'Run Full Check'}</Button>
    </div>

    <Card>
      <CardHeader title="Pre-Market Readiness Gate" subtitle="Go/no-go infrastructure gate. It does not override the scanner's execution-quality rules." action={<Badge variant={gateVariant}>{gateState}</Badge>} />
      <CardBody className="space-y-4">
        <div className="flex items-start gap-3">
          {gateState === 'READY FOR LIVE SCAN' ? <ShieldCheck size={22} className="text-emerald-500 shrink-0"/> : gateState === 'DO NOT START LIVE TEST' ? <ShieldX size={22} className="text-red-500 shrink-0"/> : <Activity size={22} className="text-blue-500 shrink-0"/>}
          <div>
            <p className="text-sm font-semibold">{gateState}</p>
            <p className="text-xs text-slate-500 mt-1">{gateState === 'READY FOR LIVE SCAN' ? 'Core provider checks passed. You can proceed to arm the controlled live test when the NSE session is appropriate.' : gateState === 'DO NOT START LIVE TEST' ? `Critical check${criticalFailed.length === 1 ? '' : 's'} failed: ${criticalFailed.map(row => row.label).join(', ')}. Fix these before arming Live Test Mode.` : running ? 'Health checks are running. Wait for all results before making the go/no-go decision.' : 'Run Full Check before the first live scan.'}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {rows.map(row => <GateItem key={row.id} label={shortLabel(row.id)} status={row.status} critical={criticalIds.includes(row.id)} />)}
        </div>
        <p className="text-[11px] text-slate-500">Critical: API, Groww quote, candles and option chain. News is contextual and does not by itself authorize execution. Market-session freshness remains enforced separately by the scanner backend.</p>
      </CardBody>
    </Card>

    <Card>
      <CardHeader title="Monday Readiness" subtitle="Infrastructure health only. This does not mean a trade is execution-ready." action={<Badge variant={ready ? 'green' : failed ? 'red' : 'blue'}>{ready ? 'SYSTEM READY' : failed ? 'ACTION REQUIRED' : 'NOT CHECKED'}</Badge>} />
      <CardBody>
        <div className="grid grid-cols-3 gap-3 text-sm">
          <Metric label="Passed" value={`${passed}/${rows.length}`} />
          <Metric label="Failed" value={String(failed)} />
          <Metric label="Last Check" value={checkedAt ? new Date(checkedAt).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) : '—'} />
        </div>
      </CardBody>
    </Card>

    <div className="space-y-3">
      {rows.map(row => <Card key={row.id}><CardBody>
        <div className="flex items-start justify-between gap-3">
          <div className="flex gap-3 items-start min-w-0">
            <div className="pt-0.5">{row.status === 'PASS' ? <CheckCircle2 size={18} className="text-emerald-500"/> : row.status === 'FAIL' ? <XCircle size={18} className="text-red-500"/> : row.status === 'RUNNING' ? <RefreshCw size={18} className="text-blue-500 animate-spin"/> : <Server size={18} className="text-slate-400"/>}</div>
            <div className="min-w-0"><p className="text-sm font-semibold text-slate-900 dark:text-white">{row.label}</p>{row.detail && <p className="text-xs text-slate-500 mt-1 break-words">{row.detail}</p>}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0"><Badge variant={row.status === 'PASS' ? 'green' : row.status === 'FAIL' ? 'red' : row.status === 'RUNNING' ? 'blue' : 'default'}>{row.status}</Badge>{Number.isFinite(row.latency) && <span className="text-xs text-slate-500">{row.latency} ms</span>}</div>
        </div>
      </CardBody></Card>)}
    </div>

    <Card><CardBody><div className="flex gap-3"><Activity size={18} className="text-blue-500 shrink-0"/><p className="text-xs text-slate-500">Run this after deployment and again before the first live scan. A closed market can still return valid quote/candle/option responses with stale prices; trade freshness remains controlled separately by the scanner execution gates.</p></div></CardBody></Card>
  </div>;
}

function GateItem({ label, status, critical }: { label: string; status: CheckStatus; critical: boolean }) { return <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2"><div className="flex items-center justify-between gap-2"><span className="text-xs font-medium">{label}</span><Badge variant={status === 'PASS' ? 'green' : status === 'FAIL' ? 'red' : status === 'RUNNING' ? 'blue' : 'default'}>{status}</Badge></div><p className="text-[10px] text-slate-500 mt-1">{critical ? 'Critical' : 'Context'}</p></div> }
function shortLabel(id: string) { return ({ api: 'Render API', quote: 'Groww Quote', candles: 'Candles', options: 'Option Chain', news: 'Market News' } as Record<string,string>)[id] ?? id; }
function Metric({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-slate-500">{label}</p><p className="font-semibold mt-1">{value}</p></div>; }
