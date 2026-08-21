import { useEffect, useState } from 'react';
import { Badge, Button, Card, CardBody, CardHeader, Input } from '@/components/ui';
import type { PageKey } from '@/components/Sidebar';
import { TradeScannerLive } from '@/pages/TradeScannerLive';
import { MANUAL_GIFT_STORAGE_KEY, readStoredManualGift, type ManualGiftInput } from '@/lib/alphaPilotApi';

export function TradeScannerWithGift({ onNavigate }: { onNavigate: (p: PageKey) => void }) {
  const [ltp, setLtp] = useState('');
  const [changePct, setChangePct] = useState('');
  const [saved, setSaved] = useState<ManualGiftInput | null>(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const current = readStoredManualGift();
    if (current) {
      setSaved(current);
      setLtp(String(current.ltp));
      setChangePct(String(current.change_pct));
    }
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

      <TradeScannerLive onNavigate={onNavigate} />
    </div>
  );
}
