import { useMemo } from 'react';
import { Card, CardBody, CardHeader } from '@/components/ui';
import type { BacktestResponse } from '@/lib/alphaPilotApi';

type Trade = BacktestResponse['trades'][number];
type PeriodResult = { label:string; startDate:string; endDate:string; allDay:BacktestResponse; before1030:BacktestResponse; before1200:BacktestResponse };

type Variant = {
  key: string;
  label: string;
  filter: (trade: Trade, weakSymbols: Set<string>) => boolean;
};

type Metrics = {
  trades:number;
  wins:number;
  losses:number;
  winRate:number;
  totalR:number;
  avgR:number;
  maxDD:number;
  t2:number;
  t1:number;
  sl:number;
  eod:number;
};

function minutesFromTimestamp(ts:string){ const d=new Date(ts); return d.getHours()*60+d.getMinutes(); }
function maxDrawdown(trades:Trade[]){ let equity=0,peak=0,dd=0; for(const t of [...trades].sort((a,b)=>a.timestamp.localeCompare(b.timestamp))){ equity+=t.r_multiple; peak=Math.max(peak,equity); dd=Math.max(dd,peak-equity); } return dd; }
function metrics(trades:Trade[]):Metrics{
  const wins=trades.filter(t=>t.r_multiple>0).length;
  const losses=trades.filter(t=>t.r_multiple<0).length;
  const totalR=trades.reduce((s,t)=>s+t.r_multiple,0);
  return {
    trades:trades.length,
    wins,
    losses,
    winRate:trades.length?wins/trades.length*100:0,
    totalR,
    avgR:trades.length?totalR/trades.length:0,
    maxDD:maxDrawdown(trades),
    t2:trades.filter(t=>t.outcome==='T2').length,
    t1:trades.filter(t=>t.outcome==='T1').length,
    sl:trades.filter(t=>t.outcome==='SL').length,
    eod:trades.filter(t=>t.outcome==='EOD').length,
  };
}
function fmtR(v:number){ return `${v>0?'+':''}${v.toFixed(2)}R`; }
function tone(v:number){ return v>0?'text-emerald-600':v<0?'text-red-600':''; }

const VARIANTS:Variant[]=[
  { key:'baseline', label:'Baseline BUY CE', filter:()=>true },
  { key:'midday', label:'BUY CE only 10:30–12:00', filter:(t)=>{const m=minutesFromTimestamp(t.timestamp);return m>=630&&m<720;} },
  { key:'excludeWeak', label:'BUY CE excluding 0/3 symbols', filter:(t,weak)=>!weak.has(t.symbol) },
  { key:'combined', label:'BUY CE 10:30–12:00 + exclude 0/3', filter:(t,weak)=>{const m=minutesFromTimestamp(t.timestamp);return m>=630&&m<720&&!weak.has(t.symbol);} },
];

export function StrategyExperiment({results}:{results:PeriodResult[]}){
  const data=useMemo(()=>{
    const ceByPeriod=results.map(period=>({ period, trades:period.allDay.trades.filter(t=>t.action==='BUY CE') }));
    const symbols=[...new Set(ceByPeriod.flatMap(x=>x.trades.map(t=>t.symbol)))];
    const weakSymbols=new Set(symbols.filter(symbol=>{
      const profitablePeriods=ceByPeriod.filter(({trades})=>{
        const st=trades.filter(t=>t.symbol===symbol);
        return st.length>0&&st.reduce((s,t)=>s+t.r_multiple,0)>0;
      }).length;
      return profitablePeriods===0;
    }));

    const combined=VARIANTS.map(variant=>{
      const trades=ceByPeriod.flatMap(x=>x.trades.filter(t=>variant.filter(t,weakSymbols)));
      return {variant,...metrics(trades)};
    });

    const byPeriod=results.flatMap((period,index)=>VARIANTS.map(variant=>{
      const trades=ceByPeriod[index].trades.filter(t=>variant.filter(t,weakSymbols));
      return {period,variant,...metrics(trades)};
    }));

    return {combined,byPeriod,weakSymbols:[...weakSymbols].sort()};
  },[results]);

  return <Card>
    <CardHeader title="Backtest Strategy Experiment" subtitle="Compare BUY CE hypotheses using the already-saved multi-period trades. This does not change live scanner rules or rerun the backend."/>
    <CardBody className="space-y-5">
      <div className="rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/20 p-3 text-xs text-amber-900 dark:text-amber-200">
        <b>Backtest-only experiment.</b> The 0/3 symbol filter is derived from these same completed periods, so treat any improvement as hypothesis generation until it survives independent out-of-sample periods.
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Combined comparison</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500"><tr><th className="text-left p-2">Variant</th><th className="text-right p-2">Trades</th><th className="text-right p-2">W/L</th><th className="text-right p-2">Win %</th><th className="text-right p-2">Total R</th><th className="text-right p-2">Avg R</th><th className="text-right p-2">Max DD</th><th className="text-right p-2">T2</th><th className="text-right p-2">T1</th><th className="text-right p-2">SL</th><th className="text-right p-2">EOD</th></tr></thead>
            <tbody>{data.combined.map(row=><tr key={row.variant.key} className="border-t border-slate-200 dark:border-slate-800"><td className="p-2 font-semibold">{row.variant.label}</td><td className="p-2 text-right">{row.trades}</td><td className="p-2 text-right">{row.wins}/{row.losses}</td><td className="p-2 text-right">{row.winRate.toFixed(1)}%</td><td className={`p-2 text-right font-semibold ${tone(row.totalR)}`}>{fmtR(row.totalR)}</td><td className="p-2 text-right">{fmtR(row.avgR)}</td><td className="p-2 text-right">{row.maxDD.toFixed(2)}R</td><td className="p-2 text-right">{row.t2}</td><td className="p-2 text-right">{row.t1}</td><td className="p-2 text-right">{row.sl}</td><td className="p-2 text-right">{row.eod}</td></tr>)}</tbody>
          </table>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold mb-2">Period-by-period robustness</h3>
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 max-h-[32rem]">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-900 text-slate-500 sticky top-0"><tr><th className="text-left p-2">Period</th><th className="text-left p-2">Variant</th><th className="text-right p-2">Trades</th><th className="text-right p-2">Win %</th><th className="text-right p-2">Total R</th><th className="text-right p-2">Avg R</th><th className="text-right p-2">Max DD</th></tr></thead>
            <tbody>{data.byPeriod.map((row,i)=><tr key={`${row.period.label}-${row.variant.key}-${i}`} className="border-t border-slate-200 dark:border-slate-800"><td className="p-2 font-semibold whitespace-nowrap">{row.period.label}<span className="block text-[10px] font-normal text-slate-500">{row.period.startDate} → {row.period.endDate}</span></td><td className="p-2">{row.variant.label}</td><td className="p-2 text-right">{row.trades}</td><td className="p-2 text-right">{row.winRate.toFixed(1)}%</td><td className={`p-2 text-right font-semibold ${tone(row.totalR)}`}>{fmtR(row.totalR)}</td><td className="p-2 text-right">{fmtR(row.avgR)}</td><td className="p-2 text-right">{row.maxDD.toFixed(2)}R</td></tr>)}</tbody>
          </table>
        </div>
      </div>

      <div className="text-xs text-slate-500"><b>0/3-profitable-period symbols excluded in this experiment:</b> {data.weakSymbols.length?data.weakSymbols.join(', '):'None'}.</div>
    </CardBody>
  </Card>;
}
