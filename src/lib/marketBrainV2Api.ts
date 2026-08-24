import { ALPHAPILOT_API_BASE } from '@/lib/alphaPilotApi';
import { fetchGlobalIntelligence, type GlobalIntelligenceResponse } from '@/lib/globalIntelligenceApi';

export type BreadthRow={symbol:string;change_pct:number;above_vwap:boolean;volume_ratio:number;trend:string;status:string};
export type MarketBrainV2Result={
  generated_at:string;
  research_only:true;
  production_rules_changed:false;
  breadth:{advancers:number;decliners:number;flat:number;above_vwap:number;total:number;score:number;state:string;rows:BreadthRow[]};
  index_context:{nifty?:BreadthRow;banknifty?:BreadthRow};
  flow:{state:string;score:number;strong_volume_names:string[]};
  cross_asset:{gift_nifty:{status:string;bias:string;change_pct?:number;source?:string};unavailable:string[]};
  event_context:{state:string;high_impact_count:number;items:{headline:string;topic:string;impact:string;source:string}[]};
  composite:{state:string;score:number;confidence:number};
  limitations:string[];
};

const SYMBOLS=['NIFTY','BANKNIFTY','RELIANCE','TCS','INFY','HDFCBANK','ICICIBANK','SBIN'];
function n(v:any,d=0){const x=Number(v);return Number.isFinite(x)?x:d}
function parseCandles(raw:any):any[]{return Array.isArray(raw?.candles)?raw.candles:[]}
function summarize(symbol:string,candles:any[]):BreadthRow|null{
  const c=candles.filter(x=>Array.isArray(x)&&x.length>=6&&n(x[4])>0); if(c.length<3)return null;
  const last=c[c.length-1],prev=c[c.length-2],lastClose=n(last[4]),prevClose=n(prev[4]);
  const change=prevClose?((lastClose/prevClose)-1)*100:0;
  const lastDate=String(last[0]).slice(0,10),session=c.filter(x=>String(x[0]).slice(0,10)===lastDate);
  const vv=session.reduce((s,x)=>s+n(x[5]),0),pv=session.reduce((s,x)=>s+(((n(x[2])+n(x[3])+n(x[4]))/3)*n(x[5])),0),vwap=vv?pv/vv:lastClose;
  const vols=c.slice(-21,-1).map(x=>n(x[5])).filter(x=>x>0),avg=vols.length?vols.reduce((a,b)=>a+b,0)/vols.length:0,vr=avg?n(last[5])/avg:1;
  const lookback=c.length>5?n(c[c.length-6][4]):prevClose,trend=lastClose>lookback?'UP':lastClose<lookback?'DOWN':'FLAT';
  return {symbol,change_pct:Number(change.toFixed(2)),above_vwap:lastClose>=vwap,volume_ratio:Number(vr.toFixed(2)),trend,status:'AVAILABLE'};
}
async function getCandles(symbol:string){const r=await fetch(`${ALPHAPILOT_API_BASE}/v1/candles/${encodeURIComponent(symbol)}?timeframe=15m`);if(!r.ok)throw new Error(`${symbol} candles ${r.status}`);return parseCandles(await r.json())}
async function getExternal(){const r=await fetch(`${ALPHAPILOT_API_BASE}/v1/context/external/RELIANCE`);if(!r.ok)throw new Error(`external context ${r.status}`);return r.json()}
function eventSnapshot(gi:GlobalIntelligenceResponse){const rows=[...(gi.high_impact??[])];for(const items of Object.values(gi.topics??{}))for(const x of items){const t=x.headline.toLowerCase();if(/ahead|await|speech|meeting|decision|cpi|pce|inflation data|jobs|payroll|rbi|fed|ecb|boj|opec/.test(t))rows.push(x)}const seen=new Set<string>();const unique=rows.filter(x=>{const k=x.headline.toLowerCase();if(seen.has(k))return false;seen.add(k);return true}).slice(0,8);const high=unique.filter(x=>x.impact==='HIGH').length;return{state:high>=2?'ELEVATED_EVENT_RISK':unique.length>=3?'ACTIVE_EVENT_RISK':'LOW_EVENT_RISK',high_impact_count:high,items:unique.map(x=>({headline:x.headline,topic:x.topic,impact:x.impact,source:x.source}))}}
export async function fetchMarketBrainV2():Promise<MarketBrainV2Result>{
  const settled=await Promise.allSettled(SYMBOLS.map(async s=>summarize(s,await getCandles(s))));
  const rows:BreadthRow[]=settled.map((x,i)=>x.status==='fulfilled'&&x.value?x.value:{symbol:SYMBOLS[i],change_pct:0,above_vwap:false,volume_ratio:0,trend:'UNKNOWN',status:'UNAVAILABLE'});
  const stocks=rows.filter(x=>!['NIFTY','BANKNIFTY'].includes(x.symbol)&&x.status==='AVAILABLE'),adv=stocks.filter(x=>x.change_pct>.05).length,dec=stocks.filter(x=>x.change_pct<-.05).length,flat=stocks.length-adv-dec,above=stocks.filter(x=>x.above_vwap).length;
  const breadthScore=stocks.length?((adv-dec)/stocks.length*50)+((above/stocks.length)-.5)*50:0;const breadthState=breadthScore>=20?'BROAD_RISK_ON':breadthScore<=-20?'BROAD_RISK_OFF':'MIXED';
  const strong=stocks.filter(x=>x.volume_ratio>=1.5).map(x=>x.symbol),flowScore=stocks.length?stocks.reduce((s,x)=>s+(x.change_pct>0?1:-1)*Math.min(x.volume_ratio,2),0)/stocks.length*25:0,flowState=flowScore>=15?'BUYING_PRESSURE':flowScore<=-15?'SELLING_PRESSURE':'BALANCED';
  let gift:any={status:'UNAVAILABLE',bias:'UNKNOWN'};try{const ext=await getExternal();gift=ext?.gift_nifty??gift}catch{}
  let gi:GlobalIntelligenceResponse|null=null;try{gi=await fetchGlobalIntelligence(4)}catch{}
  const event=gi?eventSnapshot(gi):{state:'UNAVAILABLE',high_impact_count:0,items:[]};
  const nifty=rows.find(x=>x.symbol==='NIFTY'&&x.status==='AVAILABLE'),bank=rows.find(x=>x.symbol==='BANKNIFTY'&&x.status==='AVAILABLE');
  const indexScore=(nifty?(nifty.change_pct>0?12:-12):0)+(bank?(bank.change_pct>0?8:-8):0)+(nifty?.above_vwap?8:-4)+(bank?.above_vwap?5:-3);
  const giftScore=gift?.bias==='BULLISH'?10:gift?.bias==='BEARISH'?-10:0,newsScore=gi?.risk_state==='RISK_ON'?8:gi?.risk_state==='RISK_OFF'?-8:0,eventPenalty=event.state==='ELEVATED_EVENT_RISK'?8:0;
  const score=Math.max(-100,Math.min(100,Math.round(breadthScore*.35+flowScore*.25+indexScore+giftScore+newsScore)));
  const state=score>=25?'SUPPORTIVE_LONG_CONTEXT':score<=-25?'SUPPORTIVE_SHORT_CONTEXT':'MIXED_CONTEXT';
  const confidence=Math.max(0,Math.min(100,Math.round(55+Math.min(Math.abs(score),30)-eventPenalty-(stocks.length<5?15:0))));
  return {generated_at:new Date().toISOString(),research_only:true,production_rules_changed:false,breadth:{advancers:adv,decliners:dec,flat,above_vwap:above,total:stocks.length,score:Number(breadthScore.toFixed(1)),state:breadthState,rows:stocks},index_context:{nifty,banknifty:bank},flow:{state:flowState,score:Number(flowScore.toFixed(1)),strong_volume_names:strong},cross_asset:{gift_nifty:{status:gift?.status??'UNAVAILABLE',bias:gift?.bias??'UNKNOWN',change_pct:gift?.change_pct,source:gift?.source},unavailable:['INDIA_VIX','USDINR','DXY','US_10Y','BRENT','NASDAQ_FUTURES']},event_context:event,composite:{state,score,confidence},limitations:['v2 uses liquid mapped NSE names as a breadth proxy, not the full exchange breadth yet.','GIFT NIFTY is live public-web context; other cross-assets are explicitly unavailable until reliable feeds are connected.','All outputs are research context only and cannot authorize, veto, or modify production trades.']};
}
