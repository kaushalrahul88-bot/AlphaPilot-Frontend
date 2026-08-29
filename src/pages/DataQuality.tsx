import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Database, Download, Info, Trash2, XCircle } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { DATA_QUALITY_EVENT, DATA_QUALITY_STORAGE_KEY, readDataQualityRecords, type DataQualityRecord } from '@/lib/dataQuality';
import { exportDataQualityCsv, exportDataQualityJson, exportFullBackupJson } from '@/lib/exportData';

export function DataQuality() {
  const [records, setRecords] = useState<DataQualityRecord[]>(() => readDataQualityRecords());

  useEffect(() => {
    const refresh = () => setRecords(readDataQualityRecords());
    window.addEventListener(DATA_QUALITY_EVENT, refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener(DATA_QUALITY_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const stats = useMemo(() => ({
    total: records.length,
    errors: records.filter(r => r.severity === 'ERROR').length,
    warnings: records.filter(r => r.severity === 'WARN').length,
    api: records.filter(r => r.kind === 'API_ERROR').length,
    mtf: records.filter(r => r.kind === 'MTF_SYMBOL_ERROR').length,
    option: records.filter(r => r.kind === 'FNO_MISSING_FIELD').length,
  }), [records]);

  const clear = () => {
    if (!window.confirm('Clear the browser-local Data Quality log?')) return;
    window.localStorage.removeItem(DATA_QUALITY_STORAGE_KEY);
    setRecords([]);
  };

  return <div className="space-y-5">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div><h1 className="text-xl font-bold">Data Quality & Error Log</h1><p className="text-sm text-slate-500">Persistent evidence of API failures, failed scanner symbols and unusable option fields.</p></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="default" onClick={exportDataQualityCsv}><Download size={14} className="inline mr-1"/>CSV</Button>
        <Button variant="default" onClick={exportDataQualityJson}><Download size={14} className="inline mr-1"/>JSON</Button>
        <Button variant="default" onClick={exportFullBackupJson}><Download size={14} className="inline mr-1"/>Full Backup</Button>
        <Button variant="ghost" onClick={clear}><Trash2 size={15} className="inline mr-1.5"/>Clear log</Button>
      </div>
    </div>

    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
      <Summary label="Records" value={stats.total} />
      <Summary label="Errors" value={stats.errors} />
      <Summary label="Warnings" value={stats.warnings} />
      <Summary label="API Failures" value={stats.api} />
      <Summary label="MTF Errors" value={stats.mtf} />
      <Summary label="Option Data" value={stats.option} />
    </div>

    <Card><CardBody><div className="flex gap-3 items-start"><Database className="text-blue-500 shrink-0"/><div><p className="text-sm font-semibold">Diagnostic evidence, not trade performance</p><p className="text-xs text-slate-500 mt-1">INFO entries can be normal blockers such as closed-market option data. ERROR entries indicate connectivity or scanner failures that can invalidate a live-session test. Export before clearing browser-local records.</p></div></div></CardBody></Card>

    {records.length === 0 ? <Card><CardBody className="text-center py-12"><Database size={38} className="mx-auto text-slate-300 mb-3"/><p className="text-sm text-slate-500">No data-quality issues recorded yet.</p></CardBody></Card> : <div className="space-y-3">{records.slice(0, 100).map(row => <Record key={row.id} row={row}/>)}</div>}
  </div>;
}

function Record({ row }: { row: DataQualityRecord }) {
  const Icon = row.severity === 'ERROR' ? XCircle : row.severity === 'WARN' ? AlertTriangle : Info;
  const variant = row.severity === 'ERROR' ? 'red' : row.severity === 'WARN' ? 'amber' : 'default';
  return <Card><CardHeader title={`${row.symbol ? `${row.symbol} · ` : ''}${row.kind.replaceAll('_', ' ')}`} subtitle={new Date(row.captured_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} action={<Badge variant={variant}><Icon size={12} className="inline mr-1"/>{row.severity}</Badge>}/><CardBody>
    <p className="text-sm text-slate-700 dark:text-slate-300">{row.message}</p>
    {row.path && <p className="text-xs text-slate-500 mt-2">Endpoint: {row.path}</p>}
    {row.details?.length ? <p className="text-xs text-slate-500 mt-2">Details: {row.details.join(' · ')}</p> : null}
  </CardBody></Card>;
}

function Summary({ label, value }: { label: string; value: number }) { return <Card><CardBody><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p></CardBody></Card>; }
