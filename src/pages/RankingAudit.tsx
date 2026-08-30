import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, CardBody, CardHeader } from '@/components/ui';
import { FNO_SCAN_EVENT, MTF_SCAN_EVENT, type FnoScanResponse } from '@/lib/alphaPilotApi';
import { actionOf, alphaStrength, directionalAlpha, optionRiskReward, rankQualifiedResults, rankScore } from '@/lib/executionGate';

type ResultMap = Record<string, FnoScanResponse>;

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

  const allQualified = useMemo(() => rankQualifiedResults(Object.values(results)), [results]);
  const ranked = useMemo(() => allQualified.slice(0, 3), [allQualified]);

  if (Object.keys(results).length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="BEST TRADE · Ranking Audit"
        subtitle="Directional Alpha runs from bearish (0) through neutral (50) to bullish (100). Ranking uses direction-agnostic strength after the shared execution gate passes."
        action={<Badge variant={allQualified.length ? 'green' : 'blue'}>{allQualified.length ? `${allQualified.length} QUALIFIED` : 'NO QUALIFIED TRADE'}</Badge>}
      />
      <CardBody className="space-y-3">
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
          <b>Alpha scale:</b> BUY CE qualifies at Directional Alpha ≥ 65. BUY PE qualifies at Directional Alpha ≤ 35. For ranking, a bearish Alpha of 27 becomes 73 bearish strength (100 − 27), so strong bearish setups are comparable with strong bullish setups.
        </div>
        {ranked.length === 0 ? (
          <p className="text-sm text-slate-500">No confirmed candidate passed the shared directional-Alpha, underlying R:R and backend execution-quality gates in this scan.</p>
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
                        <div className="flex items-center gap-2 flex-wrap"><b>{result.symbol}</b><Badge variant="green">{actionOf(result)}</Badge>{index === 0 && <Badge variant="blue">BEST</Badge>}</div>
                        <p className="text-xs text-slate-500 mt-1">{option.contract_label ?? 'Execution-qualified option contract'}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-6 gap-4 text-right">
                      <AuditMetric label="Directional Alpha" value={`${directionalAlpha(result).toFixed(1)}/100`} />
                      <AuditMetric label="Directional Strength" value={`${alphaStrength(result).toFixed(1)}/100`} />
                      <AuditMetric label="Rank score" value={rankScore(result).toFixed(1)} />
                      <AuditMetric label="Option R:R" value={`${optionRiskReward(result).toFixed(2)}:1`} />
                      <AuditMetric label="OI / Volume" value={`${Number(option.open_interest ?? 0).toLocaleString('en-IN')} / ${Number(option.volume ?? 0).toLocaleString('en-IN')}`} />
                      <AuditMetric label="1-Lot Capital" value={Number.isFinite(capital) && capital > 0 ? `₹${capital.toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : '—'} />
                    </div>
                  </div>
                </div>
              );
            })}
            {ranked.length > 1 && (
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900/60 px-4 py-3 text-xs text-slate-600 dark:text-slate-400">
                <b>Why #1 ranks first:</b> {ranked[0].symbol} has the highest direction-agnostic Alpha strength among candidates that passed the exact same shared execution gate. Option R:R, OI and volume are displayed for context but do not create a second winner.
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
