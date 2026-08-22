import type { FnoScanResponse } from '@/lib/alphaPilotApi';

export const LIVE_VALIDATION_STORAGE_KEY = 'alphapilot.live-validation.v2';
export const LIVE_VALIDATION_EVENT = 'alphapilot:live-validation-updated';

export type ValidationStatus = 'OPEN' | 'TARGET1_HIT' | 'TARGET2_HIT' | 'STOP_HIT' | 'EXPIRED';

export type ValidationRecord = {
  id: string;
  symbol: string;
  action: string;
  captured_at: string;
  alpha: number;
  expiry?: string;
  strike?: number;
  option_type?: 'CE' | 'PE';
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
  last_option_ltp?: number;
  last_checked_at?: string;
  resolved_at?: string;
  resolution_source?: 'AUTO_OBSERVED' | 'MANUAL';
};

export function readValidationRecords(): ValidationRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LIVE_VALIDATION_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function saveValidationRecords(records: ValidationRecord[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(LIVE_VALIDATION_STORAGE_KEY, JSON.stringify(records.slice(0, 250)));
  window.dispatchEvent(new CustomEvent(LIVE_VALIDATION_EVENT));
}

function optionRR(option: any) {
  const entry = Number(option?.option_entry ?? option?.premium);
  const stop = Number(option?.option_stop_loss);
  const target = Number(option?.option_target1);
  const risk = entry - stop;
  const reward = target - entry;
  return [entry, stop, target, risk, reward].every(Number.isFinite) && risk > 0 && reward > 0 ? reward / risk : undefined;
}

export function makeValidationRecord(result: FnoScanResponse): ValidationRecord | null {
  if (result.execution_ready !== true) return null;
  const option = result.recommended_option ?? {};
  const action = String(result.option_action ?? result.signal ?? '').toUpperCase();
  if (action !== 'BUY CE' && action !== 'BUY PE') return null;
  const optionType = String(option.option_type ?? (action === 'BUY CE' ? 'CE' : 'PE')).toUpperCase();
  const strike = Number(option.strike);
  return {
    id: `${result.symbol}-${result.expiry ?? ''}-${Number.isFinite(strike) ? strike : ''}-${optionType}-${Date.now()}`,
    symbol: result.symbol,
    action,
    captured_at: new Date().toISOString(),
    alpha: Number(result.overall_alpha_score ?? 0),
    expiry: result.expiry ? String(result.expiry) : undefined,
    strike: Number.isFinite(strike) ? strike : undefined,
    option_type: optionType === 'CE' || optionType === 'PE' ? optionType : undefined,
    option_contract: option.contract_label,
    option_entry: finite(option.option_entry ?? option.premium),
    option_stop: finite(option.option_stop_loss),
    option_target1: finite(option.option_target1),
    option_target2: finite(option.option_target2),
    option_rr: optionRR(option),
    lot_size: finite(option.lot_size),
    capital: finite(option.amount_required_1_lot),
    status: 'OPEN',
    provider: result.provider,
  };
}

export function findOptionLtp(chain: any, record: ValidationRecord): number | undefined {
  if (!Number.isFinite(record.strike) || !record.option_type) return undefined;
  const payload = chain?.data?.payload ?? chain?.data ?? chain?.payload ?? chain;
  const strikes = payload?.strikes;
  if (!strikes || typeof strikes !== 'object') return undefined;
  const exactKey = Object.keys(strikes).find(key => Number(key) === Number(record.strike));
  if (!exactKey) return undefined;
  const leg = strikes[exactKey]?.[record.option_type];
  return finite(leg?.ltp ?? leg?.last_price ?? leg?.last_traded_price);
}

export function applyObservedLtp(record: ValidationRecord, ltp: number): ValidationRecord {
  const checked = new Date().toISOString();
  const base: ValidationRecord = { ...record, last_option_ltp: ltp, last_checked_at: checked };
  if (record.status !== 'OPEN') return base;
  if (Number.isFinite(record.option_target2) && ltp >= Number(record.option_target2)) {
    return { ...base, status: 'TARGET2_HIT', resolved_at: checked, resolution_source: 'AUTO_OBSERVED' };
  }
  if (Number.isFinite(record.option_target1) && ltp >= Number(record.option_target1)) {
    return { ...base, status: 'TARGET1_HIT', resolved_at: checked, resolution_source: 'AUTO_OBSERVED' };
  }
  if (Number.isFinite(record.option_stop) && ltp <= Number(record.option_stop)) {
    return { ...base, status: 'STOP_HIT', resolved_at: checked, resolution_source: 'AUTO_OBSERVED' };
  }
  return base;
}

export function markValidationStatus(record: ValidationRecord, status: ValidationStatus): ValidationRecord {
  return { ...record, status, resolved_at: status === 'OPEN' ? undefined : new Date().toISOString(), resolution_source: status === 'OPEN' ? undefined : 'MANUAL' };
}

function finite(value: unknown): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}
