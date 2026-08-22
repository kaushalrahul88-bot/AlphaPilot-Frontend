import { useEffect, useMemo, useState } from 'react';
import { Badge, Card, CardBody, CardHeader } from '@/components/ui';
import { API_ERROR_EVENT, FNO_SCAN_EVENT, MTF_SCAN_EVENT, type FnoScanResponse } from '@/lib/alphaPilotApi';

type ApiError = { path?: string; message?: string; captured_at?: string };
type MtfEvent = { response?: { provider?: string; _client_latency_ms?: number }; symbols?: string[] };

export function ProviderDiagnostics() {
  const [lastFno, setLastFno] = useState<FnoScanResponse | null>(null);
  const [lastMtf, setLastMtf] = useState<MtfEvent | null>(null);
  const [latencies, setLatencies] = useState<number[]>([]);
  const [errors, setErrors] = useState<ApiError[]>([]);

  useEffect(() => {
    const addLatency = (value: unknown) => {
      const n = Number(value);
      if (!Number.isFinite(n) || n < 0) return;
      setLatencies(prev => [n, ...prev].slice(0, 20));
    };
    const onFno = (event: Event) => {
      const result = (event as CustomEvent<FnoScanResponse>).detail;
      if (!result?.symbol) return;
      setLastFno(result);
      addLatency(result._client_latency_ms);
    };
    const onMtf = (event: Event) => {
      const detail = (event as CustomEvent<MtfEvent>).detail;
      setLastMtf(detail ?? null);
      addLatency(detail?.response?._client_latency_ms);
    };
    const onError = (event: Event) => {
      const detail = (event as CustomEvent<ApiError>).detail ?? {};
      setErrors(prev => [detail, ...prev].slice(0, 10));
    };
    window.addEventListener(FNO_SCAN_EVENT, onFno);
    window.addEventListener(MTF_SCAN_EVENT, onMtf);
    window.addEventListener(API_ERROR_EVENT, onError);
    return () => {
      window.removeEventListener(FNO_SCAN_EVENT, onFno);
      window.removeEventListener(MTF_SCAN_EVENT, onMtf);
      window.removeEventListener(API_ERROR_EVENT, onError);
    };
  }, []);

  const averageLatency = useMemo(() => latencies.length ? latencies.reduce((sum, n) => sum + n, 0) / latencies.length : null, [latencies]);
  const option = lastFno?.recommended_option ?? {};
  const oiOk = positive(option.open_interest);
  const volumeOk = positive(option.volume);
  const ivOk = positive(option.iv);
  const capitalOk = positive(option.amount_required_1_lot);
  const contractOk = Boolean(option.contract_label || (option.strike && option.option_type));
  const fieldPasses = [contractOk, oiOk, volumeOk, ivOk, capitalOk].filter(Boolean).length;
  const provider = String(lastFno?.provider ?? lastMtf?.response?.provider ?? 'Awaiting scan');
  const latestLatency = latencies[0] ?? null;
  const healthy = errors.length === 0 && (lastFno ? fieldPasses >= 4 : true);

  return (
    <Card>
      <CardHeader
        title="Provider Diagnostics"
        subtitle="Confirms whether scanner data is arriving from the backend/provider before strategy gates are evaluated."
        action={<Badge variant={!lastFno && !lastMtf ? 'blue' : healthy ? 'green' : 'red'}>{!lastFno && !lastMtf ? 'AWAITING SCAN' : healthy ? 'HEALTHY' : 'CHECK DATA'}</Badge>}
      />
      <CardBody className="space-y-3">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Diag label="Provider" value={provider} />
          <Diag label="Last F&O Symbol" value={lastFno?.symbol ?? '—'} />
          <Diag label="Latest Latency" value={latestLatency == null ? '—' : `${Math.round(latestLatency)} ms`} />
          <Diag label="Avg Latency" value={averageLatency == null ? '—' : `${Math.round(averageLatency)} ms`} />
          <Diag label="API Errors" value={String(errors.length)} />
        </div>
        {lastFno && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <Field label="Option Contract" pass={contractOk} value={contractOk ? 'Present' : 'Missing'} />
            <Field label="Open Interest" pass={oiOk} value={displayNumber(option.open_interest)} />
            <Field label="Volume" pass={volumeOk} value={displayNumber(option.volume)} />
            <Field label="IV" pass={ivOk} value={ivOk ? `${Number(option.iv).toFixed(2)}%` : 'Unavailable'} />
            <Field label="1-Lot Capital" pass={capitalOk} value={capitalOk ? `₹${Number(option.amount_required_1_lot).toLocaleString('en-IN', { maximumFractionDigits: 0 })}` : 'Unavailable'} />
          </div>
        )}
        {lastFno && fieldPasses < 5 && (
          <p className="text-xs text-amber-600">Option feed completeness: {fieldPasses}/5 fields available. Missing provider fields can block execution even when the technical setup is strong.</p>
        )}
        {errors[0]?.message && (
          <div className="rounded-lg border border-red-200 dark:border-red-900 bg-red-50/60 dark:bg-red-950/20 p-3 text-xs text-red-700 dark:text-red-300">
            <b>Latest API error:</b> {errors[0].path ?? 'request'} · {errors[0].message}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function positive(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

function displayNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n.toLocaleString('en-IN') : 'Unavailable';
}

function Diag({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2"><p className="text-[10px] text-slate-500">{label}</p><p className="text-xs font-semibold mt-1 break-words">{value}</p></div>;
}

function Field({ label, pass, value }: { label: string; pass: boolean; value: string }) {
  return <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-between gap-2"><div><p className="text-[10px] text-slate-500">{label}</p><p className="text-xs font-semibold mt-1">{value}</p></div><Badge variant={pass ? 'green' : 'red'}>{pass ? 'OK' : 'MISSING'}</Badge></div>;
}
