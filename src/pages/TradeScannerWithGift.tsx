import { useEffect, useState } from 'react';
import { Badge, Button, Card, CardBody, CardHeader, Input } from '@/components/ui';
import type { PageKey } from '@/components/Sidebar';
import { TradeScannerLive } from '@/pages/TradeScannerLive';
import { LiveScanValidationLog } from '@/pages/LiveScanValidationLog';
import { LiveReadiness } from '@/pages/LiveReadiness';
import { ProviderDiagnostics } from '@/pages/ProviderDiagnostics';
import { RankingAudit } from '@/pages/RankingAudit';
import { UniverseSessionLog } from '@/pages/UniverseSessionLog';
import { TradeSetupNews } from '@/pages/TradeSetupNews';
import { FNO_SCAN_EVENT, MANUAL_GIFT_STORAGE_KEY, readStoredManualGift, type FnoScanResponse, type ManualGiftInput } from '@/lib/alphaPilotApi';

const LIVE_TIMEFRAMES = ['5m', '15m', '1h'];
type ScannerMode = 'find' | 'single';

export function TradeScannerWithGift({ onNavigate }: { onNavigate: (p: PageKey) => void }) {
  const [ltp, setLtp] = useState('');
  const [changePct, setChangePct] = useState('');
  const [saved, setSaved] = useState<ManualGiftInput | null>(null);
  const [message, setMessage] = useState('');
  const [lastScan, setLastScan] = useState<FnoScanResponse | null>(null);
  const [scannerMode, setScannerMode] = useState<ScannerMode>('find');

  useEffect(() => {
    const current = readStoredManualGift();
    if (current) {
      setSaved(current);
      setLtp(String(current.ltp));
      setChangePct(String(current.change_pct));
    }

    const onScan = (event: Event) => {
      const detail = (event as CustomEvent<FnoScanResponse>).detail;
      if (detail?.symbol) setLastScan(detail);
    };
    window.addEventListener(FNO_SCAN_EVENT, onScan);
    return () => window.removeEventListener(FNO_SCAN_EVENT, onScan);
  }, []);

  const saveManualGift = () => {
    const parsedLtp = Number(ltp);
    const parsedChange = Number(changePct);
    if (!Number.isFinite(parsedLtp) || parsedLtp <= 0 || !Number.isFinite(parsedChange)) {
      setMessage('Enter a valid GIFT NIFTY level and change %.');
      return;
    }

    const value: ManualGiftInput = {
      ltp: parsedLtp,
      change_pct: parsedChange,
      entered_at: new Date().toISOString(),
    };

    window.localStorage.setItem(MANUAL_GIFT_STORAGE_KEY, JSON.stringify(value));
    setSaved(value);
    setMessage('Saved. It will be used only when automatic GIFT NIFTY is unavailable.');
  };

  const clearManualGift = () => {
    window.localStorage.removeItem(MANUAL_GIFT_STORAGE_KEY);
    setSaved(null);
    setLtp('');
    setChangePct('');
    setMessage('Manual GIFT NIFTY cleared.');
  };

  const handleScannerClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const button = target.closest('button');
    const label = button?.textContent?.trim();
    if (label === 'Find Trade') setScannerMode('find');
    if (label === 'Single Symbol') setScannerMode('single');
  };

  const ageMinutes = saved?.entered_at
    ? Math.max(0, Math.floor((Date.now() - new Date(saved.entered_at).getTime()) / 60000))
    : null;

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader
          title="GIFT NIFTY Context"
          subtitle="Automatic feed is preferred. Use this manual fallback only when the live source is unavailable."
          action={saved ? <Badge variant="blue">MANUAL</Badge> : undefined}
        />
        <CardBody>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
            <Input label="GIFT NIFTY Level" type="number" value={ltp} onChange={setLtp} />
            <Input label="Change %" type="number" value={changePct} onChange={setChangePct} />
            <Button variant="primary" onClick={saveManualGift}>Use Manual GIFT</Button>
            <Button variant="ghost" onClick={clearManualGift}>Clear</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            <span>Manual values expire after 30 minutes.</span>
            {saved && (
              <span>
                Saved {ageMinutes} min ago · {saved.ltp.toLocaleString()} · {saved.change_pct >= 0 ? '+' : ''}{saved.change_pct.toFixed(2)}%
              </span>
            )}
            {message && <span className="text-slate-700 dark:text-slate-300">{message}</span>}
          </div>
        </CardBody>
      </Card>

      <LiveReadiness />
      <ProviderDiagnostics />
      {scannerMode === 'single' && lastScan && <FreshnessCard result={lastScan} />}
      {scannerMode === 'single' && lastScan && <ExecutionQualityCard result={lastScan} />}
      <div onClickCapture={handleScannerClick}>
        <TradeScannerLive onNavigate={onNavigate} />
      </div>
      <TradeSetupNews mode={scannerMode} />
      {scannerMode === 'find' && <RankingAudit />}
      {scannerMode === 'find' && <UniverseSessionLog />}
      <LiveScanValidationLog />
    </div>
  );
}

function FreshnessCard({ result }: { result: FnoScanResponse }) {
  const session = result.market_session ?? {};
  const isOpen = session.is_open === true;
  const timeframes = result.technical?.timeframes ?? {};
  return (
    <Card>
      <CardHeader
        title={`${result.symbol} · Market Data Freshness`}
        subtitle="Latest candle timestamps returned by the backend for the live scanner."
        action={<Badge variant={isOpen ? 'green' : 'red'}>{isOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}</Badge>}
      />
      <CardBody className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {LIVE_TIMEFRAMES.map(tf => (
            <div key={tf} className="rounded-lg border border-slate-200 dark:border-slate-800 p-3">
              <p className="text-xs text-slate-500">Latest {tf} candle</p>
              <p className="text-sm font-semibold mt-1">{formatCandleTime(timeframes?.[tf]?.latest_candle_at)}</p>
            </div>
          ))}
        </div>
        {!isOpen && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-300">
            <b>No new market data while NSE is closed.</b> Repeated scans can return the same technical/F&amp;O result until fresh candles arrive in the next live session.
          </div>
        )}
        {session.checked_at && <p className="text-xs text-slate-500">Session checked {formatCandleTime(session.checked_at)}</p>}
      </CardBody>
    </Card>
  );
}

function ExecutionQualityCard({ result }: { result: FnoScanResponse }) {
  const quality = result.execution_quality;
  if (!quality || typeof quality !== 'object') return null;
  const checks = quality.checks && typeof quality.checks === 'object' ? quality.checks : {};
  const ordered = [
    ['market_session', 'Market Session'],
    ['market_data_fresh', 'Fresh Market Data'],
    ['underlying_plan', 'Underlying Plan'],
    ['option_plan', 'Option Plan'],
    ['option_risk_reward', 'Option R:R'],
    ['open_interest', 'Open Interest'],
    ['volume', 'Traded Volume'],
    ['iv_sanity', 'IV Sanity'],
    ['one_lot_capital', '1-Lot Capital'],
  ] as const;
  const blockers = Array.isArray(quality.blockers) ? quality.blockers.map(String) : [];
  const passed = Number(quality.checks_passed ?? 0);
  const applicable = Number(quality.checks_applicable ?? quality.checks_total ?? ordered.length);
  const total = Number(quality.checks_total ?? ordered.length);

  return (
    <Card>
      <CardHeader
        title={`${result.symbol} · Execution Quality`}
        subtitle="Backend hard gates used before AlphaPilot can mark a setup execution-ready."
        action={<Badge variant={quality.ready === true ? 'green' : 'red'}>{quality.ready === true ? 'EXECUTION READY' : 'BLOCKED'}</Badge>}
      />
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-slate-500">Quality checks passed</span>
          <b>{passed}/{applicable} applicable <span className="text-xs font-normal text-slate-500">({total} total)</span></b>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {ordered.map(([key, label]) => {
            const check = checks[key] ?? {};
            const applicableCheck = check?.applicable !== false;
            const pass = check?.pass === true;
            return (
              <div key={key} className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-xs font-semibold mt-0.5">{qualityValue(key, check)}</p>
                </div>
                <Badge variant={!applicableCheck ? 'blue' : pass ? 'green' : 'red'}>{!applicableCheck ? 'N/A' : pass ? 'PASS' : 'FAIL'}</Badge>
              </div>
            );
          })}
        </div>
        {blockers.length > 0 && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-300">
            <b>Execution blockers</b>
            <div className="mt-1 space-y-1">{blockers.map((blocker: string, index: number) => <p key={`${blocker}-${index}`}>• {blocker}</p>)}</div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function qualityValue(key: string, check: any) {
  if (check?.applicable === false) return String(check?.reason ?? 'Not applicable for this session');
  if (key === 'market_session') return String(check?.value ?? 'Unknown');
  if (key === 'option_risk_reward') {
    const value = Number(check?.value);
    const minimum = Number(check?.minimum);
    return Number.isFinite(value) && value > 0 ? `${value.toFixed(2)}:1${Number.isFinite(minimum) ? ` · min ${minimum.toFixed(2)}:1` : ''}` : 'Unavailable';
  }
  if (key === 'one_lot_capital') {
    const value = Number(check?.value);
    return Number.isFinite(value) && value > 0 ? `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}` : 'Unavailable';
  }
  if (key === 'open_interest' || key === 'volume') {
    const value = Number(check?.value);
    return Number.isFinite(value) ? value.toLocaleString('en-IN') : 'Unavailable';
  }
  if (key === 'iv_sanity') {
    const value = Number(check?.value);
    return Number.isFinite(value) && value > 0 ? `${value.toFixed(2)}%` : 'Unavailable';
  }
  return check?.pass === true ? 'Validated' : 'Not validated';
}

function formatCandleTime(value: unknown) {
  if (typeof value !== 'string' || !value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
}
