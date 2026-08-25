import { useRef, useState, type ChangeEvent } from 'react';
import { ArchiveRestore, CheckCircle2, Download, FileCheck2, ShieldCheck } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { exportEvidenceBackupJson, inspectEvidenceBackupJson, restoreEvidenceBackup, type EvidenceBackupPreview, type EvidenceDatasetCounts, type EvidenceRestoreResult } from '@/lib/evidenceBackup';

const labels: Record<keyof EvidenceDatasetCounts, string> = {
  live_validation: 'Live validation',
  data_quality: 'Data quality',
  paper_trades: 'Paper trades',
  session_health: 'Session health',
  session_incidents: 'Data incidents',
  session_attestations: 'Session attestations',
  risk_decisions: 'Risk decisions',
};

export function EvidenceBackupPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<EvidenceBackupPreview | null>(null);
  const [restored, setRestored] = useState<EvidenceRestoreResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function exportBackup() {
    setBusy(true);
    setError(null);
    try {
      await exportEvidenceBackupJson();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Evidence backup export failed.');
    } finally {
      setBusy(false);
    }
  }

  async function selectFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError('Backup file exceeds the 10 MB safety limit.');
      return;
    }
    setBusy(true);
    setError(null);
    setPreview(null);
    setRestored(null);
    try {
      setPreview(await inspectEvidenceBackupJson(await file.text()));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Evidence backup validation failed.');
    } finally {
      setBusy(false);
    }
  }

  function restore() {
    if (!preview) return;
    setError(null);
    try {
      setRestored(restoreEvidenceBackup(preview.backup));
      setPreview(null);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Evidence restore failed.');
    }
  }

  return <Card>
    <CardHeader title="Evidence Backup & Restore v2" subtitle="Portable, checksummed backup for browser-local validation and paper evidence." action={<Badge variant="blue">NON-DESTRUCTIVE</Badge>} />
    <CardBody className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-700 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-300">
        <ShieldCheck size={16} className="shrink-0" />
        <p>Exports live validation, data quality, exact paper trades, contract health, data incidents, clean-session attestations, and risk decisions. Restore validates every record and its SHA-256 checksum, then merges by evidence identity. It never clears newer browser records and cannot enable live execution.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => void exportBackup()} disabled={busy}><Download size={14} className="inline mr-1" />{busy ? 'Working…' : 'Export evidence backup'}</Button>
        <Button variant="default" onClick={() => inputRef.current?.click()} disabled={busy}><ArchiveRestore size={14} className="inline mr-1" />Validate backup file</Button>
        <input ref={inputRef} type="file" accept="application/json,.json" onChange={event => void selectFile(event)} className="hidden" />
      </div>
      {error && <div className="rounded-lg border border-red-200 p-3 text-sm text-red-600">{error}</div>}
      {preview && <div className="space-y-3 rounded-lg border border-emerald-200 p-3 dark:border-emerald-900">
        <div className="flex items-start gap-2"><FileCheck2 size={18} className="shrink-0 text-emerald-500" /><div><p className="text-sm font-semibold">Checksum and record validation passed</p><p className="text-xs text-slate-500">Exported {new Date(preview.exported_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST. Review the counts before merging.</p></div></div>
        <Counts counts={preview.counts} />
        <Button variant="primary" onClick={restore}><ArchiveRestore size={14} className="inline mr-1" />Merge validated evidence</Button>
      </div>}
      {restored && <div className="space-y-3 rounded-lg border border-emerald-200 p-3 dark:border-emerald-900">
        <div className="flex items-start gap-2"><CheckCircle2 size={18} className="shrink-0 text-emerald-500" /><div><p className="text-sm font-semibold">Evidence restore complete</p><p className="text-xs text-slate-500">Validated merge added {Object.values(restored.imported).reduce((sum, value) => sum + value, 0)} records. Existing and newer records were preserved.</p></div></div>
        <Counts counts={restored.totals} />
      </div>}
    </CardBody>
  </Card>;
}

function Counts({ counts }: { counts: EvidenceDatasetCounts }) {
  return <div className="grid grid-cols-2 md:grid-cols-4 gap-2">{Object.entries(counts).map(([key, value]) => <div key={key} className="rounded-lg border p-2"><p className="text-[11px] text-slate-500">{labels[key as keyof EvidenceDatasetCounts]}</p><p className="font-semibold">{value}</p></div>)}</div>;
}
