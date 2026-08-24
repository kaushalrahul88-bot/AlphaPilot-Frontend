import { useEffect, useRef } from 'react';
import { FNO_SCAN_EVENT, getOptionChain, type FnoScanResponse } from '@/lib/alphaPilotApi';
import { applyObservedLtp, findOptionLtp, makeValidationRecord, readValidationRecords, saveValidationRecords } from '@/lib/liveValidation';

const POLL_MS = 60_000;

export function LiveValidationRecorder() {
  const checkingRef = useRef(false);

  useEffect(() => {
    const onScan = (event: Event) => {
      const result = (event as CustomEvent<FnoScanResponse>).detail;
      const record = result ? makeValidationRecord(result) : null;
      if (!record) return;
      const current = readValidationRecords();
      const duplicate = current.some(row => row.symbol === record.symbol && row.option_contract === record.option_contract && row.status === 'OPEN' && Date.now() - new Date(row.captured_at).getTime() < 30 * 60 * 1000);
      if (!duplicate) saveValidationRecords([record, ...current]);
    };

    const checkOpenRecords = async () => {
      if (checkingRef.current) return;
      checkingRef.current = true;
      try {
        const records = readValidationRecords();
        const open = records.filter(row => row.status === 'OPEN' && row.expiry && Number.isFinite(row.strike) && row.option_type);
        if (!open.length) return;
        const byKey = new Map<string, typeof open>();
        for (const row of open) {
          const key = `${row.symbol}|${row.expiry}`;
          byKey.set(key, [...(byKey.get(key) ?? []), row]);
        }
        const updates = new Map<string, ReturnType<typeof applyObservedLtp>>();
        for (const [key, group] of byKey.entries()) {
          const [symbol, expiry] = key.split('|');
          try {
            const chain = await getOptionChain(symbol, expiry);
            for (const row of group) {
              const ltp = findOptionLtp(chain, row);
              if (Number.isFinite(ltp)) updates.set(row.id, applyObservedLtp(row, Number(ltp)));
            }
          } catch {
            // Provider diagnostics already captures API failures; keep validation records open.
          }
        }
        if (updates.size) {
          const latest = readValidationRecords();
          saveValidationRecords(latest.map(row => updates.get(row.id) ?? row));
        }
      } finally {
        checkingRef.current = false;
      }
    };

    window.addEventListener(FNO_SCAN_EVENT, onScan);
    void checkOpenRecords();
    const timer = window.setInterval(() => void checkOpenRecords(), POLL_MS);
    return () => {
      window.removeEventListener(FNO_SCAN_EVENT, onScan);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
