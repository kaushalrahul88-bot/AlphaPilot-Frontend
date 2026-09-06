import { useEffect, useMemo, useState } from 'react';
import { Activity, RefreshCw, ShieldCheck } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader } from '@/components/ui';
import { scanFno, type FnoScanResponse } from '@/lib/alphaPilotApi';
import type { DashboardInstrument } from '@/lib/dashboardUniverse';

const TIMEFRAMES = ['5m', '15m', '1h'] as const;

export function FnoInstrumentDashboardPanel({ instrument }: { instrument: DashboardInstrument }) {
  const [result, setResult] = useState<FnoScanResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setResult(null);
    setError(null);
  }, [instrument.symbol]);

  const runScan = async () => {
    setLoading(true);
    setError(null);
    try {
      setResult(await scanFno(instrument.symbol, 1.5, [...TIMEFRAMES]));
    } catch (scanError) {
      setError(scanError instanceof Error ? scanError.message : 'F&O live scan failed');
    } finally {
      setLoading(false);
    }
  };

  const session = asRecord(result?.market_session);
  const technical = asRecord(result?.technical);
  const fno = asRecord(result?.fno);
  const quality = asRecord(result?.execution_quality);
  const recommended = asRecord(result?.recommended_option);
  const timeframes = asRecord(technical.timeframes);
  const blockers = Array.isArray(quality.blockers) ? quality.blockers.map(String) : [];
  const marketOpen = session.is_open === true;
  const liveAction = String(result?.signal || result?.status || 'NOT SCANNED');
  const direction = String(technical.direction || recommended.direction || '—');
  const reasons = useMemo(() => {
    const rows = Array.isArray(fno.reasons) ? fno.reasons.map(String) : [];
    if (result?.warning) rows.push(String(result.warning));
    return rows;
  }, [fno.reasons, result?.warning]);
  const warnings = Array.isArray(fno.warnings) ? fno.warnings.map(String) : [];

  return <div className="space-y-4">
    <Card>
      <CardHeader
        title={`F&O — ${instrument.name}`}
        subtitle="Instrument-specific Groww-backed AlphaPilot scan. The dashboard never places an order; BUY CE / BUY PE is a research setup only."
        action={<div className="flex gap-2 flex-wrap"><Badge variant="green">LIVE SCAN CONNECTED</Badge><Badge variant="default">{instrument.symbol}</Badge></div>}
      />
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Point-in-time F&O Market Brain</p>
            <p className="text-xs text-slate-500 mt-1">Uses 5m / 15m / 1h underlying structure plus the current NSE option chain, OI/volume/IV context and AlphaPilot execution-quality gates.</p>
          </div>
          <Button variant="primary" onClick={() => void runScan()} disabled={loading}>
            <RefreshCw size={15} className={`inline mr-1.5 ${loading ? 'animate-spin' : ''}`}/>{loading ? 'Scanning…' : result ? 'Refresh Live Scan' : 'Run Live Scan'}
          </Button>
        </div>

        {error && <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-300">{error}</div>}

        {!result ? <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-6 text-center">
          <Activity size={28} className="mx-auto text-slate-400"/>
          <p className="text-sm font-semibold mt-2 text-slate-900 dark:text-white">No scan has been run for {instrument.symbol}</p>
          <p className="text-xs text-slate-500 mt-1">AlphaPilot will not fill this panel with frontend seed/mock prices. Run a scan to request genuine backend market data.</p>
        </div> : <>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Metric label="Action" value={liveAction} />
            <Metric label="Direction" value={direction} />
            <Metric label="Alpha score" value={score(result.overall_alpha_score)} />
            <Metric label="F&O score" value={score(result.fno_score)} />
            <Metric label="Market session" value={marketOpen ? 'OPEN' : String(session.status || 'CLOSED')} />
          </div>

          {!marketOpen && <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-300">
            <b>NSE is closed.</b> No new live candles are arriving. AlphaPilot may show the latest completed-session evidence, but the dashboard must not treat it as a fresh executable setup.
          </div>}

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <Card className="shadow-none">
              <CardHeader title="Underlying + Options positioning" subtitle={result.expiry ? `Nearest/selected expiry · ${result.expiry}` : 'Current option-chain context'} />
              <CardBody className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Metric label="Underlying" value={number(fno.underlying_ltp, 2)} />
                <Metric label="PCR OI" value={number(fno.pcr_oi, 3)} />
                <Metric label="ATM strike" value={number(fno.atm_strike, 0)} />
                <Metric label="ATM IV" value={percent(fno.atm_iv)} />
                <Metric label="Put support" value={number(fno.put_support_strike, 0)} />
                <Metric label="Call resistance" value={number(fno.call_resistance_strike, 0)} />
              </CardBody>
            </Card>

            <Card className="shadow-none">
              <CardHeader title="Setup geometry" subtitle="Displayed only from the backend response; unavailable fields stay blank rather than being inferred." />
              <CardBody className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <Metric label="Entry" value={number(firstValue(technical.entry, recommended.entry), 2)} />
                <Metric label="Stop" value={number(firstValue(technical.stop_loss, recommended.stop_loss), 2)} />
                <Metric label="Target 1" value={number(firstValue(technical.target1, recommended.target1), 2)} />
                <Metric label="Target 2" value={number(firstValue(technical.target2, recommended.target2), 2)} />
                <Metric label="Risk : reward" value={ratio(firstValue(technical.risk_reward, recommended.risk_reward))} />
                <Metric label="Execution gate" value={quality.ready === true ? 'READY' : 'BLOCKED / N.A.'} />
              </CardBody>
            </Card>
          </div>

          <Card className="shadow-none">
            <CardHeader title="Data freshness" subtitle="Latest completed candles used by the live scanner." action={<Badge variant={marketOpen ? 'green' : 'default'}>{marketOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}</Badge>} />
            <CardBody className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {TIMEFRAMES.map((tf) => {
                const row = asRecord(timeframes[tf]);
                return <Metric key={tf} label={`${tf} latest candle`} value={formatTime(row.latest_candle_at)} />;
              })}
            </CardBody>
          </Card>

          {(blockers.length > 0 || reasons.length > 0 || warnings.length > 0) && <Card className="shadow-none">
            <CardHeader title="Why AlphaPilot reached this state" subtitle="Backend evidence notes and hard execution blockers." />
            <CardBody className="space-y-3 text-xs">
              {reasons.length > 0 && <NoteGroup label="Evidence" rows={reasons} />}
              {warnings.length > 0 && <NoteGroup label="Warnings" rows={warnings} />}
              {blockers.length > 0 && <NoteGroup label="Execution blockers" rows={blockers} />}
            </CardBody>
          </Card>}
        </>}

        <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 p-3 flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-2"><ShieldCheck size={16} className="text-blue-600 mt-0.5"/><div><p className="text-xs font-semibold">Dashboard safety boundary</p><p className="text-[11px] text-slate-500 mt-1">Read/scan only · no broker order · no automatic capital · Options expression only. Market data comes from the backend provider, not the frontend mock market-data module.</p></div></div>
          <div className="flex gap-2 flex-wrap"><Badge variant="green">NO LIVE ORDER</Badge><Badge variant="green">CAPITAL ₹0</Badge></div>
        </div>
      </CardBody>
    </Card>
  </div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3"><p className="text-[11px] text-slate-500">{label}</p><p className="text-sm font-semibold mt-1 text-slate-900 dark:text-white break-words">{value}</p></div>;
}

function NoteGroup({ label, rows }: { label: string; rows: string[] }) {
  return <div><p className="font-semibold text-slate-700 dark:text-slate-300">{label}</p><div className="mt-1 space-y-1 text-slate-500">{rows.map((row, index) => <p key={`${label}-${index}-${row}`}>• {row}</p>)}</div></div>;
}

function asRecord(value: unknown): Record<string, any> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {};
}

function firstValue(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null && value !== '');
}

function score(value: unknown): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed.toFixed(1)} / 100` : '—';
}

function number(value: unknown, digits: number): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString('en-IN', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '—';
}

function percent(value: unknown): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? `${parsed.toFixed(2)}%` : '—';
}

function ratio(value: unknown): string {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? `${parsed.toFixed(2)} : 1` : '—';
}

function formatTime(value: unknown): string {
  if (typeof value !== 'string' || !value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
}
