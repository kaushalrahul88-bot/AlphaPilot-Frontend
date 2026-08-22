import { useEffect, useMemo, useState } from 'react';
import { Activity, CheckCircle2, Clock3, Target, Trash2, XCircle } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { FNO_SCAN_EVENT, type FnoScanResponse } from '@/lib/alphaPilotApi';

const STORAGE_KEY = 'alphapilot.live-validation.v1';

type ValidationStatus = 'OPEN' | 'TARGET_HIT' | 'STOP_HIT' | 'EXPIRED';

type ValidationRecord = {
  id: string;
  symbol: string;
  action: string;
  captured_at: string;
  alpha: number;
  option_contract?: string;
  option_entry?: number;
  option_stop?: number;
  option_target1?: number;
  option_target2?: number;
  option_rr?: number;
  lot_size?: number;
  capital?: number;
  status: ValidationStatus;
  provider?: string;
};

function readRecords(): ValidationRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRecords(records: ValidationRecord[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, 200)));
}

function optionRR(option: any) {
  const entry = Number(option?.option_entry ?? option?.premium);
  const stop = Number(option?.option_stop_loss);
  const target = Number(option?.option_target1);
  const risk = entry - stop;
  const reward = target - entry;
  return [entry, stop, target, risk, reward].every(Number.isFinite) && risk > 0 && reward > 0 ? reward / risk : undefined;
}

function makeRecord(result: FnoScanResponse): ValidationRecord | null {
  if (result.execution_ready !== true) return null;
  const option = result.recommended_option ?? {};
  const action = String(result.option_action ?? result.signal ?? '').toUpperCase();
  if (action !== 'BUY CE' && action !== 'BUY PE') return null;
  return {
    id: `${result.symbol}-${result.expiry ?? ''}-${option.strike ?? ''}-${option.option_type ?? ''}-${Date.now()}`,
    symbol: result.symbol,
    action,
    captured_at: new Date().toISOString(),
    alpha: Number(result.overall_alpha_score ?? 0),
    option_contract: option.contract_label,
    option_entry: Number.isFinite(Number(option.option_entry ?? option.premium)) ? Number(option.option_entry ?? option.premium) : undefined,
    option_stop: Number.isFinite(Number(option.option_stop_loss)) ? Number(option.option_stop_loss) : undefined,
    option_target1: Number.isFinite(Number(option.option_target1)) ? Number(option.option_target1) : undefined,
    option_target2: Number.isFinite(Number(option.option_target2)) ? Number(option.option_target2) : undefined,
    option_rr: optionRR(option),
    lot_size: Number.isFinite(Number(option.lot_size)) ? Number(option.lot_size) : undefined,
    capital: Number.isFinite(Number(option.amount_required_1_lot)) ? Number(option.amount_required_1_lot) : undefined,
    status: 'OPEN',
    provider: result.provider,
  };
}

export function LiveValidation() {
  const [records, setRecords] = useState<ValidationRecord[]>(() => readRecords());

  useEffect(() => {
    const onScan = (event: Event) => {
      const result = (event as CustomEvent<FnoScanResponse>).detail;
      const record = result ? makeRecord(result) : null;
      if (!record) return;
      setRecords(prev => {
        const duplicate = prev.some(row => row.symbol === record.symbol && row.option_contract === record.option_contract && row.status === 'OPEN' && Date.now() - new Date(row.captured_at).getTime() < 30 * 60 * 1000);
        if (duplicate) return prev;
        const next = [record, ...prev];
        saveRecords(next);
        return next;
      });
    };
    window.addEventListener(FNO_SCAN_EVENT, onScan);
    return () => window.removeEventListener(FNO_SCAN_EVENT, onScan);
  }, []);

  const stats = useMemo(() => {
    const closed = records.filter(r => r.status === 'TARGET_HIT' || r.status === 'STOP_HIT');
    const wins = records.filter(r => r.status === 'TARGET_HIT').length;
    const losses = records.filter(r => r.status === 'STOP_HIT').length;
    return { total: records.length, open: records.filter(r => r.status === 'OPEN').length, wins, losses, winRate: closed.length ? wins / closed.length * 100 : 0 };
  }, [records]);

  const setStatus = (id: string, status: ValidationStatus) => {
    setRecords(prev => {
      const next = prev.map(row => row.id === id ? { ...row, status } : row);
      saveRecords(next);
      return next;
    });
  };

  const clear = () => {
    if (!window.confirm('Clear all live validation records from this browser?')) return;
    window.localStorage.removeItem(STORAGE_KEY);
    setRecords([]);
  };

  return <div className="space-y-5">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div><h1 className="text-xl font-bold">Live Validation</h1><p className="text-sm text-slate-500">Automatically captures every execution-ready BUY CE / BUY PE setup for forward validation.</p></div>
      <Button variant="ghost" onClick={clear}><Trash2 size={15} className="inline mr-1.5"/>Clear</Button>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      <Summary label="Captured" value={String(stats.total)} />
      <Summary label="Open" value={String(stats.open)} />
      <Summary label="Target Hit" value={String(stats.wins)} />
      <Summary label="Stop Hit" value={String(stats.losses)} />
      <Summary label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} />
    </div>

    <Card><CardBody><div className="flex gap-3 items-start"><Activity className="text-blue-500 shrink-0"/><div><p className="text-sm font-semibold">Forward-test evidence only</p><p className="text-xs text-slate-500 mt-1">A record is added only when the backend marks a setup execution-ready. Outcomes are currently marked manually; automatic price-outcome tracking is the next layer.</p></div></div></CardBody></Card>

    {records.length === 0 ? <Card><CardBody className="text-center py-12"><Target size={38} className="mx-auto text-slate-300 mb-3"/><p className="text-sm text-slate-500">No execution-ready live setups captured yet.</p></CardBody></Card> : <div className="space-y-3">{records.map(row => <RecordCard key={row.id} row={row} setStatus={setStatus} />)}</div>}
  </div>;
}

function RecordCard({ row, setStatus }: { row: ValidationRecord; setStatus: (id: string, status: ValidationStatus) => void }) {
  const variant = row.status === 'TARGET_HIT' ? 'green' : row.status === 'STOP_HIT' ? 'red' : row.status === 'OPEN' ? 'blue' : 'default';
  return <Card><CardHeader title={`${row.symbol} · ${row.action}`} subtitle={row.option_contract ?? 'Confirmed option setup'} action={<Badge variant={variant}>{row.status.replace('_', ' ')}</Badge>}/><CardBody className="space-y-4">
    <div className="grid grid-cols-2 md:grid-cols-7 gap-3 text-sm">
      <Metric label="Alpha" value={`${row.alpha.toFixed(1)}/100`} />
      <Metric label="Entry" value={money(row.option_entry)} />
      <Metric label="Stop" value={money(row.option_stop)} />
      <Metric label="Target 1" value={money(row.option_target1)} />
      <Metric label="Target 2" value={money(row.option_target2)} />
      <Metric label="Option R:R" value={row.option_rr ? `${row.option_rr.toFixed(2)}:1` : '—'} />
      <Metric label="1-Lot Capital" value={money(row.capital)} />
    </div>
    <div className="flex flex-wrap justify-between gap-3 items-center">
      <p className="text-xs text-slate-500"><Clock3 size={13} className="inline mr-1"/>{new Date(row.captured_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}{row.provider ? ` · ${row.provider}` : ''}</p>
      {row.status === 'OPEN' && <div className="flex gap-2"><Button variant="default" onClick={() => setStatus(row.id, 'TARGET_HIT')}><CheckCircle2 size={14} className="inline mr-1"/>Target Hit</Button><Button variant="ghost" onClick={() => setStatus(row.id, 'STOP_HIT')}><XCircle size={14} className="inline mr-1"/>Stop Hit</Button></div>}
    </div>
  </CardBody></Card>;
}

function Summary({ label, value }: { label: string; value: string }) { return <Card><CardBody><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p></CardBody></Card>; }
function Metric({ label, value }: { label: string; value: string }) { return <div><p className="text-xs text-slate-500">{label}</p><p className="font-semibold mt-1">{value}</p></div>; }
function money(value?: number) { return Number.isFinite(value) ? `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : '—'; }
