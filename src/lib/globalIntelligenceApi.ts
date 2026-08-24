import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';
export type IntelligenceItem={headline:string;source:string;published_at?:string|null;url?:string|null;sentiment:string;topic:string;impact:string};
export type GlobalIntelligenceResponse={mode:string;research_only:boolean;production_rules_changed:boolean;generated_at:string;risk_state:string;topics:Record<string,IntelligenceItem[]>;high_impact:IntelligenceItem[];method_note:string};
export async function fetchGlobalIntelligence(limit=5):Promise<GlobalIntelligenceResponse>{const r=await fetch(`${ALPHAPILOT_API_BASE}/v1/market/global-intelligence?limit=${limit}`);if(!r.ok)throw new Error(`Global Intelligence API ${r.status}`);return r.json()}
