import { useEffect, useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { Card, CardBody, CardHeader } from '@/components/ui';
import { DirectionDiagnostics } from '@/components/DirectionDiagnostics';
import { listMultiValidations, type StoredMultiValidation } from '@/lib/backtestStorage';
import type { BacktestResponse } from '@/lib/alphaPilotApi';

type PeriodResult = {
  label: string;
  startDate: string;
  endDate: string;
  allDay: BacktestResponse;
  before1030: BacktestResponse;
  before1200: BacktestResponse;
};

type SavedValidation = StoredMultiValidation<PeriodResult>;

export function DirectionDiagnosticsPage() {
  const [history, setHistory] = useState<SavedValidation[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const saved = await listMultiValidations<PeriodResult>();
        const usable = saved.filter(item => item.results.length > 0);
        setHistory(usable);
        if (usable[0]) setSelectedId(usable[0].id);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load saved multi-period validations.');
      }
    })();
  }, []);

  const selected = useMemo(() => history.find(item => item.id === selectedId) ?? history[0] ?? null, [history, selectedId]);

  return <div className="space-y-5">
    <div><h1 className="text-xl font-bold flex items-center gap-2"><BarChart3 size={20}/>Direction Diagnostics</h1><p className="text-sm text-slate-500 mt-1">Diagnose BUY CE and BUY PE performance from saved Multi-Period Validation trades without rerunning the backend or changing live scanner rules.</p></div>

    {history.length > 0 && <Card><CardHeader title="Saved validation" subtitle="Choose which completed or partial multi-period run to diagnose."/><CardBody>
      <label className="text-xs font-medium">Validation<select className="block mt-1 w-full max-w-3xl rounded-lg border border-slate-200 dark:border-slate-800 bg-transparent px-3 py-2.5 text-sm" value={selected?.id ?? ''} onChange={e => setSelectedId(e.target.value)}>{history.map(item => <option key={item.id} value={item.id}>{item.universeMode === 'FNO44' ? 'Full 44-stock F&O universe' : item.symbolsText} · {item.startDate} → {item.endDate} · {item.results.length}/3 periods · {item.status}</option>)}</select></label>
      {selected && <p className="text-xs text-slate-500 mt-2">R:R {selected.minRR} · saved {new Date(selected.createdAt).toLocaleString('en-IN')} · diagnostics use the stored all-day trades for each completed period.</p>}
    </CardBody></Card>}

    {error && <Card><CardBody><p className="text-sm font-semibold text-red-600">Diagnostics history error</p><p className="text-xs text-slate-500 mt-1">{error}</p></CardBody></Card>}

    {!error && history.length === 0 && <Card><CardHeader title="No saved validation yet"/><CardBody><p className="text-sm text-slate-500">Run a Multi-Period Validation from Backtest first. Once at least one period is checkpoint-saved, its BUY CE / BUY PE diagnostics will be available here.</p></CardBody></Card>}

    {selected && <DirectionDiagnostics results={selected.results}/>} 
  </div>;
}
