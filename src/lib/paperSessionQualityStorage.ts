import type { PaperTrade } from '@/lib/paperTradeLifecycleApi';
import type {
  PaperSessionAttestation,
  PaperSessionAttestationRequest,
  SessionDataIncident,
  SessionHealthSnapshot,
} from '@/lib/paperSessionQualityApi';

const HEALTH_KEY = 'alphapilot:paper-session-health.v1';
const INCIDENT_KEY = 'alphapilot:paper-session-incidents.v1';
const ATTESTATION_KEY = 'alphapilot:paper-session-attestations.v1';
export const PAPER_SESSION_QUALITY_EVENT = 'alphapilot:paper-session-quality-updated';
const MAX_HEALTH = 500;
const MAX_INCIDENTS = 300;
const MAX_ATTESTATIONS = 100;

function available() {
  if (typeof window === 'undefined') return false;
  try {
    return Boolean(window.localStorage);
  } catch {
    return false;
  }
}

function readArray(key: string): unknown[] {
  if (!available()) return [];
  try {
    const raw = window.localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveArray(key: string, values: unknown[]) {
  if (!available()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(values));
    window.dispatchEvent(new CustomEvent(PAPER_SESSION_QUALITY_EVENT));
  } catch {
    // Session evidence storage must never alter deterministic risk or lifecycle results.
  }
}

function validHealth(value: unknown): value is SessionHealthSnapshot {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<SessionHealthSnapshot>;
  return typeof row.captured_at === 'string'
    && typeof row.symbol === 'string'
    && typeof row.expiry === 'string'
    && typeof row.strike === 'number'
    && Number.isFinite(row.strike)
    && (row.option_type === 'CE' || row.option_type === 'PE')
    && Boolean(row.checks)
    && typeof row.checks?.api === 'boolean'
    && typeof row.checks?.quote === 'boolean'
    && typeof row.checks?.candles === 'boolean'
    && typeof row.checks?.options === 'boolean';
}

function validIncident(value: unknown): value is SessionDataIncident {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<SessionDataIncident>;
  return typeof row.captured_at === 'string'
    && typeof row.source === 'string'
    && typeof row.code === 'string';
}

function validAttestation(value: unknown): value is PaperSessionAttestation {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<PaperSessionAttestation>;
  return row.schema_version === 1
    && typeof row.attestation_id === 'string'
    && typeof row.session_date === 'string'
    && (row.status === 'CLEAN_SESSION_ATTESTED' || row.status === 'SESSION_NOT_CLEAN')
    && row.live_execution_enabled === false
    && row.order_endpoint_called === false
    && Array.isArray(row.blockers);
}

export function sessionDateIst(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find(row => row.type === type)?.value ?? '';
  return part('year') + '-' + part('month') + '-' + part('day');
}

export function sessionPhase(value: string | Date): 'EARLY' | 'MID' | 'LATE' | null {
  const date = value instanceof Date ? value : new Date(value);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const part = (type: string) => Number(parts.find(row => row.type === type)?.value ?? 0);
  const minutes = part('hour') * 60 + part('minute');
  if (minutes >= 9 * 60 + 15 && minutes <= 10 * 60 + 30) return 'EARLY';
  if (minutes >= 11 * 60 && minutes <= 13 * 60 + 30) return 'MID';
  if (minutes >= 14 * 60 && minutes <= 15 * 60 + 30) return 'LATE';
  return null;
}

export function afterSessionClose(value = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(value);
  const text = (type: string) => parts.find(row => row.type === type)?.value ?? '';
  const minutes = Number(text('hour')) * 60 + Number(text('minute'));
  return !['Sat', 'Sun'].includes(text('weekday')) && minutes >= 15 * 60 + 35;
}

export function readSessionHealthSnapshots() {
  return readArray(HEALTH_KEY).filter(validHealth).slice(0, MAX_HEALTH);
}

export function appendSessionHealthSnapshot(snapshot: SessionHealthSnapshot) {
  const existing = readSessionHealthSnapshots();
  const duplicate = existing.some(row =>
    row.symbol === snapshot.symbol
    && row.expiry === snapshot.expiry
    && row.strike === snapshot.strike
    && row.option_type === snapshot.option_type
    && sessionDateIst(row.captured_at) === sessionDateIst(snapshot.captured_at)
    && sessionPhase(row.captured_at) === sessionPhase(snapshot.captured_at)
  );
  if (duplicate) return;
  saveArray(HEALTH_KEY, [snapshot, ...existing].slice(0, MAX_HEALTH));
}

export function readSessionDataIncidents() {
  return readArray(INCIDENT_KEY).filter(validIncident).slice(0, MAX_INCIDENTS);
}

export function appendSessionDataIncident(incident: SessionDataIncident) {
  const existing = readSessionDataIncidents();
  const duplicate = existing.some(row =>
    row.source === incident.source
    && row.code === incident.code
    && Math.abs(new Date(row.captured_at).getTime() - new Date(incident.captured_at).getTime()) < 60_000
  );
  if (duplicate) return;
  saveArray(INCIDENT_KEY, [incident, ...existing].slice(0, MAX_INCIDENTS));
}

export function readPaperSessionAttestations() {
  return readArray(ATTESTATION_KEY).filter(validAttestation).slice(0, MAX_ATTESTATIONS);
}

export function savePaperSessionAttestation(attestation: PaperSessionAttestation) {
  const existing = readPaperSessionAttestations();
  saveArray(
    ATTESTATION_KEY,
    [attestation, ...existing.filter(row => row.session_date !== attestation.session_date)].slice(0, MAX_ATTESTATIONS),
  );
}

export function cleanPaperSessionCount(attestations = readPaperSessionAttestations()) {
  return new Set(
    attestations
      .filter(row => row.status === 'CLEAN_SESSION_ATTESTED' && row.clean_session_count_increment === 1)
      .map(row => row.session_date),
  ).size;
}

export function buildPaperSessionRequest(
  trades: PaperTrade[],
  sessionDate = sessionDateIst(new Date()),
): PaperSessionAttestationRequest {
  return {
    session_date: sessionDate,
    evaluated_at: new Date().toISOString(),
    health_snapshots: readSessionHealthSnapshots().filter(row => sessionDateIst(row.captured_at) === sessionDate),
    data_incidents: readSessionDataIncidents().filter(row => sessionDateIst(row.captured_at) === sessionDate),
    paper_trades: trades
      .filter(row => sessionDateIst(row.opened_at) === sessionDate)
      .map(row => ({
        trade_id: row.trade_id,
        symbol: row.symbol,
        expiry: row.expiry,
        strike: row.strike,
        option_type: row.option_type,
        status: row.status,
        paper_only: true,
        live_execution_enabled: false,
        order_endpoint_called: false,
        opened_at: row.opened_at,
        closed_at: row.closed_at,
        mark_sequence: row.mark_sequence,
        last_source_id: row.last_source_id,
      })),
  };
}

export function todaySessionEvidence(trades: PaperTrade[]) {
  const today = sessionDateIst(new Date());
  const health = readSessionHealthSnapshots().filter(row => sessionDateIst(row.captured_at) === today);
  const incidents = readSessionDataIncidents().filter(row => sessionDateIst(row.captured_at) === today);
  const sessionTrades = trades.filter(row => sessionDateIst(row.opened_at) === today);
  const passing = health.filter(row => Object.values(row.checks).every(Boolean));
  return {
    session_date: today,
    health,
    incidents,
    trades: sessionTrades,
    early_passes: passing.filter(row => sessionPhase(row.captured_at) === 'EARLY').length,
    mid_passes: passing.filter(row => sessionPhase(row.captured_at) === 'MID').length,
    late_passes: passing.filter(row => sessionPhase(row.captured_at) === 'LATE').length,
    failed_snapshots: health.filter(row => !Object.values(row.checks).every(Boolean)).length,
    completed_trades: sessionTrades.filter(row => row.status === 'CLOSED').length,
    open_trades: sessionTrades.filter(row => row.status === 'OPEN').length,
  };
}
