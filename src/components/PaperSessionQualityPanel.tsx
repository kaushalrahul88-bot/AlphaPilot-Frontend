import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck } from 'lucide-react';
import { Badge, Button, Card, CardBody, CardHeader, StatCard, Table, TableCell, TableRow } from '@/components/ui';
import { attestPaperSession, type PaperSessionAttestation } from '@/lib/paperSessionQualityApi';
import { PAPER_TRADE_LIFECYCLE_EVENT, readPaperTrades } from '@/lib/paperTradeLifecycleStorage';
import {
  PAPER_SESSION_QUALITY_EVENT,
  afterSessionClose,
  buildPaperSessionRequest,
  cleanPaperSessionCount,
  readPaperSessionAttestations,
  savePaperSessionAttestation,
  todaySessionEvidence,
} from '@/lib/paperSessionQualityStorage';

function codeLabel(code: string) {
  return code.replace(/_/g, ' ').toLowerCase().replace(/^./, value => value.toUpperCase());
}

function formatIst(value: string) {
  return new Date(value).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' IST';
}

export function PaperSessionQualityPanel() {
  const [trades, setTrades] = useState(readPaperTrades);
  const [attestations, setAttestations] = useState(readPaperSessionAttestations);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attemptedRef = useRef<string | null>(null);
  const evidence = useMemo(() => todaySessionEvidence(trades), [trades, attestations]);
  const cleanSessions = cleanPaperSessionCount(attestations);
  const todayAttestation = attestations.find(row => row.session_date === evidence.session_date) ?? null;
  const todayHasFinalEvaluation = todayAttestation ? afterSessionClose(new Date(todayAttestation.evaluated_at)) : false;

  const reload = useCallback(() => {
    setTrades(readPaperTrades());
    setAttestations(readPaperSessionAttestations());
  }, []);

  const evaluate = useCallback(async () => {
    if (running || !trades.length) return;
    setRunning(true);
    setError(null);
    try {
      const result = await attestPaperSession(buildPaperSessionRequest(trades, evidence.session_date));
      savePaperSessionAttestation(result);
      setAttestations(readPaperSessionAttestations());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Paper session attestation failed.');
    } finally {
      setRunning(false);
    }
  }, [evidence.session_date, running, trades]);

  useEffect(() => {
    const onUpdate = () => reload();
    window.addEventListener(PAPER_SESSION_QUALITY_EVENT, onUpdate);
    window.addEventListener(PAPER_TRADE_LIFECYCLE_EVENT, onUpdate);
    window.addEventListener('storage', onUpdate);
    const timer = window.setInterval(() => {
      reload();
      if (
        afterSessionClose()
        && evidence.trades.length > 0
        && attemptedRef.current !== evidence.session_date
        && !todayHasFinalEvaluation
      ) {
        attemptedRef.current = evidence.session_date;
        void evaluate();
      }
    }, 5 * 60_000);
    return () => {
      window.removeEventListener(PAPER_SESSION_QUALITY_EVENT, onUpdate);
      window.removeEventListener(PAPER_TRADE_LIFECYCLE_EVENT, onUpdate);
      window.removeEventListener('storage', onUpdate);
      window.clearInterval(timer);
    };
  }, [evidence.session_date, evidence.trades.length, evaluate, reload, todayHasFinalEvaluation]);

  return <Card>
    <CardHeader
      title="Paper Session Quality Attestation v1"
      subtitle="A clean session requires contract-matched early, mid and late critical-health evidence."
      action={<div className="flex items-center gap-2"><Badge variant="blue">EVIDENCE GATE</Badge><Button size="sm" onClick={() => void evaluate()} disabled={running || evidence.trades.length === 0}>{running ? 'Evaluating…' : 'Evaluate session'}</Button></div>}
    />
    <CardBody className="space-y-4">
      <div className="rounded-lg border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/20 p-3 text-xs text-blue-700 dark:text-blue-300">
        Health checks are captured once per contract in each phase while AlphaPilot is open: early 09:15–10:30, mid 11:00–13:30 and late 14:00–15:30 IST. One failed critical snapshot keeps the session unclean.
      </div>
      {error && <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-900 p-3 text-xs text-red-600"><AlertTriangle size={16} className="shrink-0" />{error}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Clean sessions" value={String(cleanSessions)} subvalue="Unique attested dates" accent={cleanSessions ? 'green' : 'default'} />
        <StatCard label="Health coverage" value={String(evidence.early_passes) + '/' + String(evidence.mid_passes) + '/' + String(evidence.late_passes)} subvalue="Early / mid / late passes" accent={evidence.early_passes && evidence.mid_passes && evidence.late_passes ? 'green' : 'amber'} />
        <StatCard label="Critical failures" value={String(evidence.failed_snapshots)} subvalue={String(evidence.incidents.length) + ' API/data incidents'} accent={evidence.failed_snapshots || evidence.incidents.length ? 'red' : 'green'} />
        <StatCard label="Session trades" value={String(evidence.completed_trades)} subvalue={String(evidence.open_trades) + ' unresolved'} accent={evidence.open_trades ? 'red' : evidence.completed_trades ? 'blue' : 'default'} />
      </div>

      {todayAttestation ? <div className={'rounded-lg border p-3 ' + (todayAttestation.status === 'CLEAN_SESSION_ATTESTED' ? 'border-emerald-200 dark:border-emerald-900' : 'border-red-200 dark:border-red-900')}>
        <div className="flex items-start gap-2">
          {todayAttestation.status === 'CLEAN_SESSION_ATTESTED' ? <CheckCircle2 size={18} className="text-emerald-500 shrink-0" /> : <AlertTriangle size={18} className="text-red-500 shrink-0" />}
          <div><p className="text-sm font-semibold">{todayAttestation.status.replace(/_/g, ' ')}</p><p className="text-xs text-slate-500 mt-1">{todayAttestation.blockers.length ? todayAttestation.blockers.map(codeLabel).join(' · ') : 'Eligible to count as one clean paper session only.'}</p></div>
        </div>
      </div> : <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-5 text-center">
        <ClipboardCheck size={22} className="mx-auto text-slate-400 mb-2" />
        <p className="text-sm font-medium">No attestation for {evidence.session_date}</p>
        <p className="text-xs text-slate-500 mt-1">Final evaluation is valid only after 15:35 IST. You can evaluate earlier to see missing evidence without earning a clean-session count.</p>
      </div>}

      {attestations.length > 0 && <Table headers={['Session', 'Result', 'Coverage', 'Trades', 'Incidents', 'Evaluated']}>
        {attestations.slice(0, 12).map((row: PaperSessionAttestation) => <TableRow key={row.session_date}>
          <TableCell className="font-medium">{row.session_date}</TableCell>
          <TableCell><Badge variant={row.status === 'CLEAN_SESSION_ATTESTED' ? 'green' : 'red'}>{row.status === 'CLEAN_SESSION_ATTESTED' ? 'CLEAN' : 'NOT CLEAN'}</Badge></TableCell>
          <TableCell>{row.coverage.early_passes}/{row.coverage.mid_passes}/{row.coverage.late_passes} · {row.coverage.coverage_minutes}m</TableCell>
          <TableCell>{row.evidence.completed_paper_trades}</TableCell>
          <TableCell>{row.evidence.data_incidents}</TableCell>
          <TableCell className="text-xs">{formatIst(row.evaluated_at)}</TableCell>
        </TableRow>)}
      </Table>}

      <p className="text-[11px] text-slate-500">The recorder is browser-local and requires AlphaPilot to remain open during each evidence phase. It is not tamper-evident and cannot authorize or place any order.</p>
    </CardBody>
  </Card>;
}
