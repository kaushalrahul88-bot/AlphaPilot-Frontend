import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, CardBody, CardHeader } from '@/components/ui';
import { FNO_SCAN_EVENT, MTF_SCAN_EVENT, type FnoScanResponse } from '@/lib/alphaPilotApi';

type ResultMap = Record<string, FnoScanResponse>;

function directionStrength(result: FnoScanResponse) {
  const alpha = Number(result.overall_alpha_score ?? 50);
  const direction = String(result.technical?.direction ?? result.recommended_option?.direction ?? '').toUpperCase();
  return direction === 'SHORT' ? 100 - alpha : alpha;
}

function optionRR(result: FnoScanResponse) {
  const direct = Number(result.recommended_option?.option_risk_reward);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const option = result.recommended_option ?? {};
  const entry = Number(option.option_entry ?? option.premium);
  const stop = Number(option.option_stop_loss);
  const target = Number(option.option_target1);
  const risk = entry - stop;
  const reward = target - entry;
  return [entry, stop, target, risk, reward].every(Number.isFinite) && risk > 0 && reward > 0 ? reward / risk : 0;
}

function liquidityScore(result: FnoScanResponse) {
  const option = result.recommended_option ?? {};
  const oi = Math.max(0, Number(option.open_interest ?? 0));
  const volume = Math.max(0, Number(option.volume ?? 0));
  return Math.log10(1 + oi) + Math.log10(1 + volume);
}

function rankScore(result: FnoScanResponse) {
  return directionStrength(result) * 0.72 + Math.min(optionRR(result), 4) * 5 + liquidityScore(result) * 2;
}

function action(result: FnoScanResponse) {
  const direction = String(result.technical?.direction ?? result.recommended_option?.direction ?? '').toUpperCase();
  return direction === 'SHORT' ? 'BUY PE' : 'BUY CE';
}

export function RankingAudit() {
  const [results, setResults] = useState<ResultMap>({});

  useEffect(() => {
    const onMtfScan = () => setResults({});
    const onScan = (event: Event) => {
      const result = (event as CustomEvent<FnoScanResponse>).detail;
      if (!result?.symbol) return;
      setResults(prev => ({ ...prev, [result.symbol]: result }));
    };
    window.addEventListener(MTF_SCAN_EVENT, onMtfScan);
    window.addEventListener(FNO_SCAN_EVENT, onScan);
    return () => {
      window.removeEventListener(MTF_SCAN_EVENT, onMtfScan);
      window.removeEventListener(FNO_SCAN_EVENT, onScan);
    };
  }, []);

  const ranked = useMemo(() => Object.values(results)
    .filter(result => result.execution_ready === true && result.execution_quality?.ready === true)
    .sort((a, b) => rankScore(b) - rankScore(a))
    .slice(0, 3), [results]);

  if (Object.keys(results).length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="BEST TRADE · Ranking Audit"
        subtitle="Explainable comparison of fully execution-ready F&O confirmations from the current universe scan only."
        action={<Badge variant={ranked.length ? 'green' : 'blue'}>{ranked.length ? `${ranked.length} QUALIFIED` : 'NO QUALIFIED TRADE'}</Badge>}
      />
      <CardBody className="space-y-3">
        {ranked.length === 0 ? (
          <p className="text-sm text-slate-500">No confirmed candidate has passed the complete backend execution-quality gate in this scan. Watchlist and blocked scans are intentionally excluded from BEST TRADE ranking.</p>
        ) : (
          <>
            {ranked.map((result, index) => {
              const option = result.recommended_option ?? {};
              const capital = Number(option.amount_required_1_lot);
              return (
                <div key={result.symbol} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold">{index + 1}</div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap"><b>{result.symbol}</b><Badge variant="green">{action(result)}</Badge>{index === 0 && <Badge variant="blue">BEST</Badge>}</div>
                        <p className="text-xs text-slate-500 mt-1">{option.contract_label ?? 'Execution-qualified option contract'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 text-right">
                      <AuditMetric label="Rank score" value={rankScore(result).toFixed(1)} />
                      <AuditMetric label="Alpha strength" value={`${directionStrength(result).toFixed(1)}/100`} />
                      <AuditMetric label="Option R:R" value={`${optionRR(result).toFixed(2)}:1`} />
                      <AuditMetric label="OI / Volume" value={`${Number(option.open_interest ?? 0).toLocaleString('en-IN')} / ${Number(option.volume ?? 0).toLocaleString('en-IN')}`} />
                      <AuditMetric label="1-Lot Capital" value={Number.isFinite(capital) && capital > 0 ? `₹${capital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'} />
                    </div>
                  </div>
                </div>
              );
            })}
            {ranked.length > 1 && (
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                <b>Why #1 ranks first:</b> {ranked[0].symbol} has the strongest composite among execution-ready candidates. Ranking weights directional Alpha most heavily, then uses option R:R and live OI/volume as tie-breakers. Capital required is displayed for affordability context but does not reward a trade merely for being cheaper.
              </div>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}

function AuditMetric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] text-slate-500">{label}</p><p className="text-xs font-semibold mt-0.5 whitespace-nowrap">{value}</p></div>;
}
