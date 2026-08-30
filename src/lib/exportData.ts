import { readValidationRecords } from '@/lib/liveValidation';
import { readDataQualityRecords } from '@/lib/dataQuality';
import { exportEvidenceBackupJson } from '@/lib/evidenceBackup';

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return '';
  const text = Array.isArray(value) ? value.join(' | ') : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const headers = Array.from(new Set(rows.flatMap(row => Object.keys(row))));
  return [headers.join(','), ...rows.map(row => headers.map(h => csvEscape(row[h])).join(','))].join('\n');
}

export function exportValidationJson() {
  const records = readValidationRecords();
  download(`alphapilot-live-validation-${stamp()}.json`, JSON.stringify({ exported_at: new Date().toISOString(), records }, null, 2), 'application/json;charset=utf-8');
}

export function exportValidationCsv() {
  const records = readValidationRecords().map(row => ({ ...row }));
  download(`alphapilot-live-validation-${stamp()}.csv`, toCsv(records), 'text/csv;charset=utf-8');
}

export function exportDataQualityJson() {
  const records = readDataQualityRecords();
  download(`alphapilot-data-quality-${stamp()}.json`, JSON.stringify({ exported_at: new Date().toISOString(), records }, null, 2), 'application/json;charset=utf-8');
}

export function exportDataQualityCsv() {
  const records = readDataQualityRecords().map(row => ({ ...row, details: row.details?.join(' | ') ?? '' }));
  download(`alphapilot-data-quality-${stamp()}.csv`, toCsv(records), 'text/csv;charset=utf-8');
}

export async function exportFullBackupJson() {
  return exportEvidenceBackupJson();
}
