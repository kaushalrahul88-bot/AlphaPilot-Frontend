import { isDataQualityRecord, readDataQualityRecords, saveDataQualityRecords, type DataQualityRecord } from '@/lib/dataQuality';
import { isValidationRecord, readValidationRecords, saveValidationRecords, type ValidationRecord } from '@/lib/liveValidation';
import { isPaperSessionAttestation, isSessionDataIncident, isSessionHealthSnapshot, appendSessionDataIncident, appendSessionHealthSnapshot, readPaperSessionAttestations, readSessionDataIncidents, readSessionHealthSnapshots, savePaperSessionAttestation } from '@/lib/paperSessionQualityStorage';
import type { PaperSessionAttestation, SessionDataIncident, SessionHealthSnapshot } from '@/lib/paperSessionQualityApi';
import { isPaperTrade, readPaperTrades, savePaperTrades } from '@/lib/paperTradeLifecycleStorage';
import type { PaperTrade } from '@/lib/paperTradeLifecycleApi';
import { isRiskDecisionLedgerRecord, readRiskDecisionLedger, saveRiskDecisionLedger, type RiskDecisionLedgerRecord } from '@/lib/riskDecisionLedger';

export const EVIDENCE_BACKUP_SCHEMA = 'alphapilot-evidence-backup-v2';

export type EvidenceDatasets = {
  live_validation: ValidationRecord[];
  data_quality: DataQualityRecord[];
  paper_trades: PaperTrade[];
  session_health: SessionHealthSnapshot[];
  session_incidents: SessionDataIncident[];
  session_attestations: PaperSessionAttestation[];
  risk_decisions: RiskDecisionLedgerRecord[];
};

export type EvidenceDatasetCounts = Record<keyof EvidenceDatasets, number>;

export type EvidenceBackup = {
  schema: typeof EVIDENCE_BACKUP_SCHEMA;
  schema_version: 2;
  exported_at: string;
  live_execution_enabled: false;
  order_endpoint_called: false;
  datasets: EvidenceDatasets;
  counts: EvidenceDatasetCounts;
  integrity: {
    algorithm: 'SHA-256';
    datasets_sha256: string;
  };
};

export type EvidenceBackupPreview = {
  backup: EvidenceBackup;
  counts: EvidenceDatasetCounts;
  exported_at: string;
  integrity_verified: true;
};

export type EvidenceRestoreResult = {
  imported: EvidenceDatasetCounts;
  totals: EvidenceDatasetCounts;
  mode: 'VALIDATED_MERGE';
};

const datasetKeys: (keyof EvidenceDatasets)[] = [
  'live_validation',
  'data_quality',
  'paper_trades',
  'session_health',
  'session_incidents',
  'session_attestations',
  'risk_decisions',
];

function counts(datasets: EvidenceDatasets): EvidenceDatasetCounts {
  return Object.fromEntries(datasetKeys.map(key => [key, datasets[key].length])) as EvidenceDatasetCounts;
}

function datasetsNow(): EvidenceDatasets {
  return {
    live_validation: readValidationRecords(),
    data_quality: readDataQualityRecords(),
    paper_trades: readPaperTrades(),
    session_health: readSessionHealthSnapshots(),
    session_incidents: readSessionDataIncidents(),
    session_attestations: readPaperSessionAttestations(),
    risk_decisions: readRiskDecisionLedger(),
  };
}

async function sha256(value: unknown) {
  if (!globalThis.crypto?.subtle) throw new Error('Secure checksum support is unavailable in this browser.');
  const encoded = new TextEncoder().encode(JSON.stringify(value));
  const digest = await globalThis.crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

function download(name: string, content: string) {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function createEvidenceBackup(): Promise<EvidenceBackup> {
  const datasets = datasetsNow();
  return {
    schema: EVIDENCE_BACKUP_SCHEMA,
    schema_version: 2,
    exported_at: new Date().toISOString(),
    live_execution_enabled: false,
    order_endpoint_called: false,
    datasets,
    counts: counts(datasets),
    integrity: { algorithm: 'SHA-256', datasets_sha256: await sha256(datasets) },
  };
}

export async function exportEvidenceBackupJson() {
  const backup = await createEvidenceBackup();
  const stamp = backup.exported_at.replace(/[:.]/g, '-');
  download(`alphapilot-evidence-backup-${stamp}.json`, JSON.stringify(backup, null, 2));
  return backup;
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Backup must be a JSON object.');
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return value;
}

function validatedDatasets(value: unknown): EvidenceDatasets {
  const source = object(value);
  const validate = <T>(key: keyof EvidenceDatasets, predicate: (row: unknown) => row is T): T[] => {
    const rows = array(source[key], key);
    if (!rows.every(predicate)) throw new Error(`${key} contains an invalid or unsupported record.`);
    return rows;
  };
  return {
    live_validation: validate('live_validation', isValidationRecord),
    data_quality: validate('data_quality', isDataQualityRecord),
    paper_trades: validate('paper_trades', isPaperTrade),
    session_health: validate('session_health', isSessionHealthSnapshot),
    session_incidents: validate('session_incidents', isSessionDataIncident),
    session_attestations: validate('session_attestations', isPaperSessionAttestation),
    risk_decisions: validate('risk_decisions', isRiskDecisionLedgerRecord),
  };
}

export async function inspectEvidenceBackupJson(raw: string): Promise<EvidenceBackupPreview> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('The selected file is not valid JSON.');
  }
  const envelope = object(parsed);
  if (envelope.schema !== EVIDENCE_BACKUP_SCHEMA || envelope.schema_version !== 2) {
    throw new Error('Unsupported backup schema. Select an AlphaPilot Evidence Backup v2 file.');
  }
  if (envelope.live_execution_enabled !== false || envelope.order_endpoint_called !== false) {
    throw new Error('Backup safety flags are invalid.');
  }
  if (typeof envelope.exported_at !== 'string' || !Number.isFinite(new Date(envelope.exported_at).getTime())) {
    throw new Error('Backup export timestamp is invalid.');
  }
  const datasets = validatedDatasets(envelope.datasets);
  const integrity = object(envelope.integrity);
  if (integrity.algorithm !== 'SHA-256' || typeof integrity.datasets_sha256 !== 'string') {
    throw new Error('Backup checksum metadata is missing.');
  }
  const actual = await sha256(datasets);
  if (actual !== integrity.datasets_sha256) throw new Error('Backup checksum failed. The evidence file may be incomplete or modified.');
  const expectedCounts = counts(datasets);
  const suppliedCounts = object(envelope.counts);
  if (datasetKeys.some(key => suppliedCounts[key] !== expectedCounts[key])) throw new Error('Backup record counts do not match its datasets.');
  const backup = { ...envelope, datasets, counts: expectedCounts } as EvidenceBackup;
  return { backup, counts: expectedCounts, exported_at: backup.exported_at, integrity_verified: true };
}

function mergeBy<T>(current: T[], incoming: T[], key: (row: T) => string, newer?: (left: T, right: T) => T) {
  const merged = new Map<string, T>();
  for (const row of [...current, ...incoming]) {
    const id = key(row);
    const existing = merged.get(id);
    merged.set(id, existing && newer ? newer(existing, row) : row);
  }
  return [...merged.values()];
}

function latest<T>(field: (row: T) => string) {
  return (left: T, right: T) => field(right).localeCompare(field(left)) >= 0 ? right : left;
}

export function restoreEvidenceBackup(backup: EvidenceBackup): EvidenceRestoreResult {
  const incoming = backup.datasets;
  const before = datasetsNow();
  const liveValidation = mergeBy(before.live_validation, incoming.live_validation, row => row.id, latest(row => row.last_checked_at ?? row.resolved_at ?? row.captured_at));
  const dataQuality = mergeBy(before.data_quality, incoming.data_quality, row => row.id, latest(row => row.captured_at));
  const paperTrades = mergeBy(before.paper_trades, incoming.paper_trades, row => row.trade_id, latest(row => row.last_observed_at));
  const health = mergeBy(before.session_health, incoming.session_health, row => [row.captured_at, row.symbol, row.expiry, row.strike, row.option_type].join('|'));
  const incidents = mergeBy(before.session_incidents, incoming.session_incidents, row => [row.captured_at, row.source, row.code].join('|'));
  const attestations = mergeBy(before.session_attestations, incoming.session_attestations, row => row.session_date, latest(row => row.evaluated_at));
  const decisions = mergeBy(before.risk_decisions, incoming.risk_decisions, row => row.id, latest(row => row.captured_at));

  saveValidationRecords(liveValidation.sort((a, b) => b.captured_at.localeCompare(a.captured_at)));
  saveDataQualityRecords(dataQuality.sort((a, b) => b.captured_at.localeCompare(a.captured_at)));
  savePaperTrades(paperTrades);
  for (const row of health) appendSessionHealthSnapshot(row);
  for (const row of incidents) appendSessionDataIncident(row);
  for (const row of attestations.sort((a, b) => a.evaluated_at.localeCompare(b.evaluated_at))) savePaperSessionAttestation(row);
  saveRiskDecisionLedger(decisions.sort((a, b) => b.captured_at.localeCompare(a.captured_at)));

  const after = datasetsNow();
  const totalCounts = counts(after);
  const beforeCounts = counts(before);
  return {
    imported: Object.fromEntries(datasetKeys.map(key => [key, Math.max(0, totalCounts[key] - beforeCounts[key])])) as EvidenceDatasetCounts,
    totals: totalCounts,
    mode: 'VALIDATED_MERGE',
  };
}
