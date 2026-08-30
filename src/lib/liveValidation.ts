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
  premium_risk_percent?: number;
  option_target1_percent?: number;
  option_target2_percent?: number;
  risk_model?: string;
  plan_migrated_at?: string;
  legacy_option_stop?: number;
  legacy_option_target1?: number;
  legacy_option_target2?: number;
  legacy_option_rr?: number;
  lot_size?: number;
  capital?: number;
  status: ValidationStatus;
  provider?: string;
  last_option_ltp?: number;
  last_checked_at?: string;
  observed_max_ltp?: number;
  observed_min_ltp?: number;
  mfe_r?: number;
  mae_r?: number;
  resolved_at?: string;
  resolution_source?: 'AUTO_OBSERVED' | 'MANUAL';
};

export function isValidationRecord(value: unknown): value is ValidationRecord {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<ValidationRecord>;
  return typeof row.id === 'string'
    && typeof row.symbol === 'string'
    && typeof row.action === 'string'
    && typeof row.captured_at === 'string'
    && typeof row.alpha === 'number'
    && Number.isFinite(row.alpha)
    && (row.status === 'OPEN' || row.status === 'TARGET1_HIT' || row.status === 'TARGET2_HIT' || row.status === 'STOP_HIT' || row.status === 'EXPIRED');
}

function premiumRiskPercent(entry: number) {
  if (entry < 10) return 30;
  if (entry < 30) return 25;
  return 20;
}

function migrateOpenLegacyPlan(record: ValidationRecord): ValidationRecord {
  if (record.status !== 'OPEN' || record.risk_model === 'PREMIUM_PERCENT_INTRADAY') return record;
  const entry = Number(record.option_entry);
  if (!Number.isFinite(entry) || entry <= 0) return record;

  const riskPercent = premiumRiskPercent(entry);
  const risk = entry * riskPercent / 100;
  const rr = 1.5;
  const stop = Math.max(0.05, entry - risk);
  const target1 = entry + risk * rr;
  const target2 = entry + risk * 2;

  return {
    ...record,
    legacy_option_stop: record.option_stop,
    legacy_option_target1: record.option_target1,
    legacy_option_target2: record.option_target2,
    legacy_option_rr: record.option_rr,
    option_stop: Number(stop.toFixed(2)),
    option_target1: Number(target1.toFixed(2)),
    option_target2: Number(target2.toFixed(2)),
    option_rr: rr,
    premium_risk_percent: riskPercent,
    option_target1_percent: Number((riskPercent * rr).toFixed(2)),
    option_target2_percent: Number((riskPercent * 2).toFixed(2)),
    risk_model: 'PREMIUM_PERCENT_INTRADAY',
    plan_migrated_at: new Date().toISOString(),
    observed_max_ltp: Number.isFinite(Number(record.observed_max_ltp)) ? record.observed_max_ltp : entry,
    observed_min_ltp: Number.isFinite(Number(record.observed_min_ltp)) ? record.observed_min_ltp : entry,
    mfe_r: 0,
    mae_r: 0,
  };
}

export function readValidationRecords(): ValidationRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LIVE_VALIDATION_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const records = parsed.filter(isValidationRecord).map(row => migrateOpenLegacyPlan(row));
    const changed = records.some((row: ValidationRecord, index: number) => row !== parsed[index]);
    if (changed) {
      window.localStorage.setItem(LIVE_VALIDATION_STORAGE_KEY, JSON.stringify(records.slice(0, 250)));
    }
    return records;
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
  const entry = finite(option.option_entry ?? option.premium);
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
    option_entry: entry,
    option_stop: finite(option.option_stop_loss),
    option_target1: finite(option.option_target1),
    option_target2: finite(option.option_target2),
    option_rr: optionRR(option),
    premium_risk_percent: finite(option.premium_risk_percent),
    option_target1_percent: finite(option.option_target1_percent),
    option_target2_percent: finite(option.option_target2_percent),
    risk_model: option.risk_model ? String(option.risk_model) : undefined,
    lot_size: finite(option.lot_size),
    capital: finite(option.amount_required_1_lot),
    status: 'OPEN',
    provider: result.provider,
    observed_max_ltp: entry,
    observed_min_ltp: entry,
    mfe_r: 0,
    mae_r: 0,
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

function withObservedExcursions(record: ValidationRecord, ltp: number): ValidationRecord {
  const entry = Number(record.option_entry);
  const stop = Number(record.option_stop);
  const previousMax = Number(record.observed_max_ltp);
  const previousMin = Number(record.observed_min_ltp);
  const observedMax = Number.isFinite(previousMax) ? Math.max(previousMax, ltp) : ltp;
  const observedMin = Number.isFinite(previousMin) ? Math.min(previousMin, ltp) : ltp;
  const risk = entry - stop;
  const validRisk = Number.isFinite(entry) && Number.isFinite(stop) && risk > 0;
  const mfe = validRisk ? Math.max(0, (observedMax - entry) / risk) : undefined;
  const mae = validRisk ? Math.max(0, (entry - observedMin) / risk) : undefined;
  return {
    ...record,
    observed_max_ltp: observedMax,
    observed_min_ltp: observedMin,
    mfe_r: mfe != null ? Number(mfe.toFixed(3)) : record.mfe_r,
    mae_r: mae != null ? Number(mae.toFixed(3)) : record.mae_r,
  };
}

export function applyObservedLtp(record: ValidationRecord, ltp: number): ValidationRecord {
  const checked = new Date().toISOString();
  const excursion = withObservedExcursions(record, ltp);
  const base: ValidationRecord = { ...excursion, last_option_ltp: ltp, last_checked_at: checked };
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
