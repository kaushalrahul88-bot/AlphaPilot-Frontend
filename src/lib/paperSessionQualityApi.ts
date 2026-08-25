import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';

export type SessionHealthSnapshot = {
  captured_at: string;
  symbol: string;
  expiry: string;
  strike: number;
  option_type: 'CE' | 'PE';
  checks: {
    api: boolean;
    quote: boolean;
    candles: boolean;
    options: boolean;
  };
};

export type SessionDataIncident = {
  captured_at: string;
  source: string;
  code: string;
};

export type SessionPaperTradeEvidence = {
  trade_id: string;
  symbol: string;
  expiry: string;
  strike: number;
  option_type: 'CE' | 'PE';
  status: 'OPEN' | 'CLOSED';
  paper_only: true;
  live_execution_enabled: false;
  order_endpoint_called: false;
  opened_at: string;
  closed_at: string | null;
  mark_sequence: number;
  last_source_id: string;
};

export type PaperSessionAttestationRequest = {
  session_date: string;
  evaluated_at: string;
  health_snapshots: SessionHealthSnapshot[];
  data_incidents: SessionDataIncident[];
  paper_trades: SessionPaperTradeEvidence[];
};

export type PaperSessionAttestation = {
  schema_version: 1;
  protocol_revision: string;
  attestation_id: string;
  session_date: string;
  evaluated_at: string;
  status: 'CLEAN_SESSION_ATTESTED' | 'SESSION_NOT_CLEAN';
  clean_session_count_increment: 0 | 1;
  eligible_for_controlled_live_evidence: boolean;
  live_execution_enabled: false;
  order_endpoint_called: false;
  blockers: string[];
  coverage: {
    passing_snapshots: number;
    failed_snapshots: number;
    early_passes: number;
    mid_passes: number;
    late_passes: number;
    coverage_minutes: number;
    minimum_coverage_minutes: number;
  };
  evidence: {
    data_incidents: number;
    session_paper_trades: number;
    completed_paper_trades: number;
  };
  scope: string;
};

export async function attestPaperSession(input: PaperSessionAttestationRequest): Promise<PaperSessionAttestation> {
  const response = await fetch(ALPHAPILOT_API_BASE + '/v1/paper-sessions/attest', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error('Paper session attestation ' + response.status + ': ' + (detail || response.statusText));
  }
  return response.json() as Promise<PaperSessionAttestation>;
}
