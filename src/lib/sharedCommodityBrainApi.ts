import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';

export interface SharedBrainThesisSummary {
  direction?: string;
  confidence?: string;
  thesis_state?: string;
  supporting_families?: string[];
  opposing_families?: string[];
}

export interface SharedCommodityBrainDashboardStatus {
  mode: string;
  status: string;
  research_only?: boolean;
  read_only?: boolean;
  trade_instrument?: string;
  shared_core?: {
    minimum_independent_confirmations?: number;
    weighted_score_used?: boolean;
    memory_role?: string;
    memory_counts_as_independent_confirmation?: boolean;
  };
  copper?: {
    product?: string;
    stream_id?: string;
    contract_version?: string;
    status?: string;
    prospective_evaluations?: number;
    directional_evaluations?: number;
    abstentions?: number;
    by_direction?: Record<string, number>;
    by_confidence?: Record<string, number>;
    latest?: ({ board_as_of?: string } & SharedBrainThesisSummary) | null;
    first_seen_immutable?: boolean;
    historical_backfill_used?: boolean;
    same_pit_board_as_direction_v2?: boolean;
    sealed_current_mind_phase1_visible?: boolean;
    sealed_current_mind_effect?: string;
    decision_effect?: string;
    execution_effect?: string;
    capital_committed?: number;
    promotion_eligible?: boolean;
  };
  crude_oil_mini?: {
    product?: string;
    shared_mode?: string;
    parity_mode?: string;
    status?: string;
    prospective_episodes?: number;
    shared_parity_episodes?: number;
    latest_parity_click?: string | null;
    latest_parity?: {
      mode?: string;
      status?: string;
      legacy?: SharedBrainThesisSummary;
      shared?: SharedBrainThesisSummary;
      direction_agreement?: boolean | null;
      confidence_agreement?: boolean | null;
      full_thesis_agreement?: boolean | null;
      divergence_reason?: string;
      memory_policy?: {
        legacy_memory_counted?: boolean | null;
        shared_memory_role?: string;
        shared_memory_counts_as_independent_confirmation?: boolean;
      };
    } | null;
    same_pit_family_snapshot_as_legacy?: boolean;
    decision_effect?: string;
    execution_effect?: string;
    capital_committed?: number;
    promotion_eligible?: boolean;
  };
  safety?: {
    copper_phase1_sealed_outputs_exposed?: boolean;
    outcomes_or_pnl_exposed?: boolean;
    collector_credentials_exposed?: boolean;
    live_execution_enabled?: boolean;
    broker_order_placement_enabled?: boolean;
    capital_committed?: number;
  };
}

export async function getSharedCommodityBrainStatus(): Promise<SharedCommodityBrainDashboardStatus> {
  const response = await fetch(`${ALPHAPILOT_API_BASE}/v1/dashboard/shared-commodity-brain/status`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`Shared Commodity Brain API ${response.status}: ${await response.text().catch(() => response.statusText)}`);
  }
  return response.json() as Promise<SharedCommodityBrainDashboardStatus>;
}
