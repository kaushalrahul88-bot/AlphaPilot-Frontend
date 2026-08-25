import { API_ERROR_EVENT, FNO_SCAN_EVENT, MTF_SCAN_EVENT, type FnoScanResponse, type MtfScanResponse } from '@/lib/alphaPilotApi';

export const DATA_QUALITY_STORAGE_KEY = 'alphapilot.data-quality.v1';
export const DATA_QUALITY_EVENT = 'alphapilot:data-quality-updated';

export type DataQualityKind = 'API_ERROR' | 'MTF_SYMBOL_ERROR' | 'FNO_MISSING_FIELD' | 'FNO_BLOCKED';
export type DataQualitySeverity = 'INFO' | 'WARN' | 'ERROR';

export type DataQualityRecord = {
  id: string;
  captured_at: string;
  kind: DataQualityKind;
  severity: DataQualitySeverity;
  symbol?: string;
  path?: string;
  message: string;
  details?: string[];
};

export function isDataQualityRecord(value: unknown): value is DataQualityRecord {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<DataQualityRecord>;
  return typeof row.id === 'string'
    && typeof row.captured_at === 'string'
    && (row.kind === 'API_ERROR' || row.kind === 'MTF_SYMBOL_ERROR' || row.kind === 'FNO_MISSING_FIELD' || row.kind === 'FNO_BLOCKED')
    && (row.severity === 'INFO' || row.severity === 'WARN' || row.severity === 'ERROR')
    && typeof row.message === 'string'
    && (row.details === undefined || (Array.isArray(row.details) && row.details.every(detail => typeof detail === 'string')));
}

export function readDataQualityRecords(): DataQualityRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(DATA_QUALITY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isDataQualityRecord) : [];
  } catch { return []; }
}

export function saveDataQualityRecords(records: DataQualityRecord[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DATA_QUALITY_STORAGE_KEY, JSON.stringify(records.slice(0, 300)));
  window.dispatchEvent(new CustomEvent(DATA_QUALITY_EVENT));
}

export function appendDataQualityRecord(record: Omit<DataQualityRecord, 'id' | 'captured_at'> & { captured_at?: string }) {
  const captured_at = record.captured_at ?? new Date().toISOString();
  const nextRecord: DataQualityRecord = { ...record, captured_at, id: `${captured_at}-${record.kind}-${record.symbol ?? record.path ?? Math.random()}` };
  const current = readDataQualityRecords();
  const duplicate = current.some(row => row.kind === nextRecord.kind && row.symbol === nextRecord.symbol && row.path === nextRecord.path && row.message === nextRecord.message && Date.now() - new Date(row.captured_at).getTime() < 60_000);
  if (!duplicate) saveDataQualityRecords([nextRecord, ...current]);
}

export function installDataQualityListeners() {
  if (typeof window === 'undefined') return () => {};

  const onApiError = (event: Event) => {
    const detail = (event as CustomEvent<any>).detail ?? {};
    appendDataQualityRecord({ kind: 'API_ERROR', severity: 'ERROR', path: detail.path, message: detail.message ?? 'API request failed after retries.', captured_at: detail.captured_at });
  };

  const onMtf = (event: Event) => {
    const detail = (event as CustomEvent<any>).detail ?? {};
    const response = detail.response as MtfScanResponse | undefined;
    const rows = [...(response?.setups ?? []), ...(response?.others ?? [])];
    for (const row of rows) {
      if (row?.status === 'ERROR' || row?.error) {
        appendDataQualityRecord({ kind: 'MTF_SYMBOL_ERROR', severity: 'ERROR', symbol: row.symbol, message: row.error ?? 'MTF symbol scan returned ERROR.' });
      }
    }
  };

  const onFno = (event: Event) => {
    const result = (event as CustomEvent<FnoScanResponse>).detail;
    if (!result?.symbol) return;
    const option = result.recommended_option ?? {};
    const missing: string[] = [];
    if (!option.contract_label && !option.strike) missing.push('contract');
    if (!(Number(option.open_interest ?? option.oi) > 0)) missing.push('open interest');
    if (!(Number(option.volume ?? option.traded_volume) > 0)) missing.push('volume');
    if (!(Number(option.iv) > 0)) missing.push('IV');
    if (!(Number(option.amount_required_1_lot) > 0)) missing.push('1-lot capital');
    if (missing.length) appendDataQualityRecord({ kind: 'FNO_MISSING_FIELD', severity: result.execution_ready ? 'WARN' : 'INFO', symbol: result.symbol, message: `Missing or unusable option data: ${missing.join(', ')}`, details: missing });
    if (result.execution_ready === false) {
      const blockers = Array.isArray(result.execution_blockers) ? result.execution_blockers.map(String) : [];
      if (blockers.length) appendDataQualityRecord({ kind: 'FNO_BLOCKED', severity: 'INFO', symbol: result.symbol, message: blockers[0], details: blockers });
    }
  };

  window.addEventListener(API_ERROR_EVENT, onApiError);
  window.addEventListener(MTF_SCAN_EVENT, onMtf);
  window.addEventListener(FNO_SCAN_EVENT, onFno);
  return () => {
    window.removeEventListener(API_ERROR_EVENT, onApiError);
    window.removeEventListener(MTF_SCAN_EVENT, onMtf);
    window.removeEventListener(FNO_SCAN_EVENT, onFno);
  };
}
