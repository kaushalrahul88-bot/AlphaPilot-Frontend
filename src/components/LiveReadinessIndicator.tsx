import { useEffect, useState } from 'react';
import { Badge, Card, CardBody, CardHeader } from '@/components/ui';
import { FNO_SCAN_EVENT, type FnoScanResponse } from '@/lib/alphaPilotApi';

export function LiveReadinessIndicator() {
  const [result, setResult] = useState<FnoScanResponse | null>(null);

  useEffect(() => {
    const onScan = (event: Event) => {
      const detail = (event as CustomEvent<FnoScanResponse>).detail;
      if (detail?.symbol) setResult(detail);
    };
    window.addEventListener(FNO_SCAN_EVENT, onScan);
    return () => window.removeEventListener(FNO_SCAN_EVENT, onScan);
  }, []);

  if (!result) {
    return (
      <Card>
        <CardHeader title="Live Readiness" subtitle="Run a live scan to validate market session, data freshness and all execution-quality gates." action={<Badge variant="blue">AWAITING SCAN</Badge>} />
      </Card>
    );
  }

  const session = result.market_session ?? {};
  const sessionOpen = session.execution_allowed === true || session.is_open === true;
  const quality = result.execution_quality && typeof result.execution_quality === 'object' ? result.execution_quality : null;
  const passed = Number(quality?.checks_passed ?? 0);
  const applicable = Number(quality?.checks_applicable ?? quality?.checks_total ?? 0);
  const total = Number(quality?.checks_total ?? 9);
  const completeQuality = Boolean(quality) && total === 9 && applicable === 9 && passed === 9 && quality?.ready === true && result.execution_ready === true;

  const state = !sessionOpen ? 'CLOSED' : completeQuality ? 'READY FOR RANKING' : 'DATA NOT READY';
  const variant = completeQuality ? 'green' : sessionOpen ? 'red' : 'blue';

  return (
    <Card>
      <CardHeader
        title="Live Readiness"
        subtitle="BEST TRADE can be ranked only during an executable NSE session after all 9 backend quality checks pass."
        action={<Badge variant={variant}>{state}</Badge>}
      />
      <CardBody>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <ReadinessMetric label="Last Symbol" value={result.symbol ?? '—'} />
          <ReadinessMetric label="Session" value={String(session.phase ?? session.status ?? 'UNKNOWN')} />
          <ReadinessMetric label="Quality" value={quality ? `${passed}/${applicable} applicable` : 'Unavailable'} />
          <ReadinessMetric label="Execution" value={result.execution_ready === true ? 'READY' : 'BLOCKED'} />
        </div>
        <p className="text-xs text-slate-500 mt-3">
          {completeQuality
            ? 'Live environment is fully validated for ranking. AlphaPilot may show BEST TRADE only for a candidate that also passes its technical and Alpha thresholds.'
            : !sessionOpen
              ? 'Market is not in an executable session. Live freshness and full execution readiness will be evaluated when NSE is open.'
              : `Live session detected, but the backend has not achieved a complete 9/9 quality pass yet${quality ? ` (${passed}/${applicable})` : ''}.`}
        </p>
      </CardBody>
    </Card>
  );
}

function ReadinessMetric({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-slate-500">{label}</p><p className="font-semibold mt-1">{value}</p></div>;
}
