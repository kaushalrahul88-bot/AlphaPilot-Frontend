import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';

export type QuoteHeartbeat={symbol:string;status:'LIVE_QUOTE_OK'|'UNAVAILABLE';ltp?:number;change_pct?:number;observed_at:string;detail?:string};

function findNumber(obj:any,keys:string[]):number|undefined{
  if(!obj||typeof obj!=='object')return undefined;
  for(const k of keys){const v=obj[k];const n=Number(v);if(Number.isFinite(n))return n}
  for(const v of Object.values(obj)){if(v&&typeof v==='object'){const hit=findNumber(v,keys);if(hit!==undefined)return hit}}
  return undefined;
}

export async function fetchQuoteHeartbeat(symbol:string):Promise<QuoteHeartbeat>{
  try{
    const r=await fetch(`${ALPHAPILOT_API_BASE}/v1/quote/${encodeURIComponent(symbol)}`);
    if(!r.ok)return {symbol,status:'UNAVAILABLE',observed_at:new Date().toISOString(),detail:`HTTP ${r.status}`};
    const raw=await r.json();
    const ltp=findNumber(raw,['ltp','last_price','lastPrice','last_traded_price','close']);
    const changePct=findNumber(raw,['change_percent','change_percentage','change_pct','percent_change','day_change_percentage']);
    return {symbol,status:ltp!==undefined?'LIVE_QUOTE_OK':'UNAVAILABLE',ltp,change_pct:changePct,observed_at:new Date().toISOString(),detail:ltp===undefined?'Quote response had no recognized LTP field':undefined};
  }catch(e){return {symbol,status:'UNAVAILABLE',observed_at:new Date().toISOString(),detail:e instanceof Error?e.message:'quote heartbeat failed'} }
}
