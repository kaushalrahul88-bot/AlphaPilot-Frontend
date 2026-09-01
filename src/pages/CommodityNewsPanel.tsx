import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ExternalLink, Newspaper, RefreshCw } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { getCommodityNews, type CommodityNewsResponse, type CommoditySymbol } from '@/lib/commodityApi';

export function CommodityNewsPanel({ symbol, scanKey }: { symbol: CommoditySymbol; scanKey?: string | number | null }) {
  const [open,setOpen]=useState(false);
  const [loading,setLoading]=useState(false);
  const [data,setData]=useState<CommodityNewsResponse|null>(null);
  const [error,setError]=useState<string|null>(null);

  const load=async()=>{
    setLoading(true);setError(null);
    try{setData(await getCommodityNews(symbol,4));}
    catch(err){setError(err instanceof Error?err.message:'Commodity news failed.');}
    finally{setLoading(false);}
  };

  useEffect(()=>{if(scanKey!=null)void load();},[scanKey]);

  const validItems=useMemo(()=>(data?.items??[]).filter(item=>!item.error),[data]);
  const feedErrors=useMemo(()=>(data?.items??[]).filter(item=>Boolean(item.error)),[data]);

  return <Card><CardHeader title={`${symbol} · News & Event Context`} subtitle="Recent commodity-specific headlines and event tags. Context only; never overrides execution gates." action={<div className="flex items-center gap-2"><Badge variant="blue">{validItems.length} HEADLINES</Badge><Button size="sm" variant="ghost" onClick={()=>setOpen(v=>!v)}>{open?<ChevronUp size={14} className="inline mr-1"/>:<ChevronDown size={14} className="inline mr-1"/>}{open?'Collapse':'Expand'}</Button></div>}/>{open&&<CardBody className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2"><div className="flex flex-wrap gap-1">{(data?.event_tags??[]).length?(data?.event_tags??[]).map(tag=><Badge key={tag} variant="amber">{tag}</Badge>):<span className="text-xs text-slate-500">No tagged event theme yet.</span>}</div><Button size="sm" variant="ghost" onClick={()=>void load()} disabled={loading}>{loading?<RefreshCw size={13} className="inline mr-1 animate-spin"/>:<Newspaper size={13} className="inline mr-1"/>}{loading?'Refreshing…':'Refresh News'}</Button></div>{error&&<div className="rounded-lg border border-red-200 dark:border-red-900 p-3 text-xs text-red-600">{error}</div>}{feedErrors.map((item,index)=><div key={`feed-error-${index}`} className="rounded-lg border border-amber-200 dark:border-amber-900 p-3 text-xs text-amber-600"><AlertTriangle size={14} className="inline mr-1"/>Commodity news feed is temporarily unavailable. This is a context-data error, not a neutral market headline{item.error?`: ${item.error}`:'.'}</div>)}{!error&&!validItems.length&&!feedErrors.length&&!loading&&<p className="text-xs text-slate-500">Run a commodity scan or refresh news to load context.</p>}{validItems.map((item,index)=><div key={`${item.headline}-${index}`} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-sm font-semibold text-slate-900 dark:text-white">{item.headline}</p><p className="text-xs text-slate-500 mt-1">{item.source} · {formatTime(item.published_at)}</p><div className="flex flex-wrap gap-1 mt-2"><Badge variant={item.sentiment==='BULLISH'?'green':item.sentiment==='BEARISH'?'red':'default'}>{item.sentiment}</Badge>{(item.event_tags??[]).map(tag=><Badge key={tag} variant="amber">{tag}</Badge>)}</div></div>{item.url&&<a href={item.url} target="_blank" rel="noreferrer" className="text-slate-400 hover:text-blue-500 shrink-0"><ExternalLink size={15}/></a>}</div></div>)}</CardBody>}</Card>;
}

function formatTime(value?:string|null){if(!value)return'—';const d=new Date(value);return Number.isNaN(d.getTime())?value:d.toLocaleString('en-IN',{timeZone:'Asia/Kolkata',hour12:true});}
