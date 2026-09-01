import { useState } from 'react';
import { Plus, Trash2, Brain, FileText } from 'lucide-react';
import { useStore } from '@/store/StoreContext';
import { Card, CardHeader, CardBody, StatCard, Badge, Table, TableRow, TableCell, Button, Modal, Input, Select } from '@/components/ui';
import { BarChart } from '@/components/charts';
import { analyzeJournalMistakes, generateWeeklyReport, buildTradingProfile } from '@/lib/aiAnalyst';
import { formatCurrency, formatDate } from '@/lib/format';
import type { JournalEntry, Direction } from '@/lib/types';

const MISTAKES = ['Overtrading', 'Revenge trading', 'Increasing position size after losses', 'Moving stop loss', 'Entering without a setup', 'Trading against the trend', 'Excessive options buying', 'Poor risk/reward', 'Trading during volatile events'];
const STRATEGIES = ['Trend Following', 'Mean Reversion', 'Breakout', 'Swing', 'News Based', 'Counter Trend', 'Scalping', 'Options Buying'];
const EMOTIONS = ['Confident', 'Anxious', 'Calm', 'Greedy', 'Fearful', 'Excited', 'Revengeful', 'Patient', 'Frustrated', 'Happy', 'Satisfied', 'Regretful', 'Angry'];

export function Journal() {
  const { journal, addJournalEntry, removeJournalEntry } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  const mistakes = analyzeJournalMistakes(journal);
  const totalPnl = journal.reduce((a, j) => a + j.pnl, 0);
  const wins = journal.filter((j) => j.pnl > 0);
  const losses = journal.filter((j) => j.pnl < 0);
  const winRate = journal.length > 0 ? (wins.length / journal.length) * 100 : 0;
  const profile = buildTradingProfile(journal);
  const weeklyReport = generateWeeklyReport(journal);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Trading Journal</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Record trades and analyze your behavior</p>
        </div>
        <div className="flex gap-2">
          <Button variant="default" onClick={() => setShowProfile(true)}><Brain size={16} className="inline mr-1.5" />My Profile</Button>
          <Button variant="default" onClick={() => setShowReport(true)}><FileText size={16} className="inline mr-1.5" />Weekly Report</Button>
          <Button variant="primary" onClick={() => setShowAdd(true)}><Plus size={16} className="inline mr-1.5" />Add Trade</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Trades" value={String(journal.length)} accent="blue" />
        <StatCard label="Win Rate" value={`${winRate.toFixed(0)}%`} accent={winRate >= 50 ? 'green' : 'red'} />
        <StatCard label="Net P&L" value={formatCurrency(totalPnl, true)} accent={totalPnl >= 0 ? 'green' : 'red'} />
        <StatCard label="Mistakes Logged" value={String(mistakes.reduce((a, m) => a + m.count, 0))} accent="amber" />
      </div>

      {mistakes.length > 0 && (
        <Card>
          <CardHeader title="Recurring Mistakes" subtitle="AI analysis of your journal" />
          <CardBody>
            <BarChart data={mistakes.map((m) => ({ label: m.mistake.split(' ')[0], value: m.count }))} height={180} color="#ef4444" />
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Trade History" subtitle={`${journal.length} trades recorded`} />
        <CardBody className="p-0">
          <Table headers={['Date', 'Instrument', 'Dir', 'Entry', 'Exit', 'Qty', 'Strategy', 'Result', 'P&L', 'Mistake', '']}>
            {journal.slice().reverse().map((j) => (
              <TableRow key={j.id}>
                <TableCell className="text-xs">{formatDate(new Date(j.date).getTime())}</TableCell>
                <TableCell className="font-medium text-slate-900 dark:text-white">{j.instrument}</TableCell>
                <TableCell><Badge variant={j.direction === 'BULLISH' ? 'green' : 'red'}>{j.direction === 'BULLISH' ? 'B' : 'S'}</Badge></TableCell>
                <TableCell>₹{j.entry}</TableCell>
                <TableCell>₹{j.exit}</TableCell>
                <TableCell>{j.quantity}</TableCell>
                <TableCell className="text-xs">{j.strategy ?? '-'}</TableCell>
                <TableCell><Badge variant={j.result === 'WIN' ? 'green' : j.result === 'LOSS' ? 'red' : 'default'}>{j.result}</Badge></TableCell>
                <TableCell><span className={j.pnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{formatCurrency(j.pnl, true)}</span></TableCell>
                <TableCell className="text-xs text-amber-600 dark:text-amber-400">{j.mistake || '-'}</TableCell>
                <TableCell><button onClick={() => removeJournalEntry(j.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16} /></button></TableCell>
              </TableRow>
            ))}
          </Table>
          {journal.length === 0 && <p className="text-slate-400 text-sm p-6 text-center">No trades yet. Add one to get started.</p>}
        </CardBody>
      </Card>

      <AddTradeModal open={showAdd} onClose={() => setShowAdd(false)} onAdd={addJournalEntry} />

      <Modal open={showReport} onClose={() => setShowReport(false)} title="Weekly Trading Behavior Report" maxWidth="max-w-2xl">
        <pre className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap font-sans">{weeklyReport}</pre>
      </Modal>

      <Modal open={showProfile} onClose={() => setShowProfile(false)} title="My Trading Profile" maxWidth="max-w-2xl">
        <div className="space-y-4">
          <p className="text-sm text-slate-500 dark:text-slate-400">AI-generated profile based on your trading history and journal entries.</p>
          {journal.length === 0 ? (
            <p className="text-slate-400 text-sm">No trading data available. Add journal entries to build your profile.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <ProfileRow label="Best Strategy" value={profile.bestStrategy ?? '-'} accent="green" />
              <ProfileRow label="Worst Strategy" value={profile.worstStrategy ?? '-'} accent="red" />
              <ProfileRow label="Best Instrument" value={profile.bestInstrument ?? '-'} accent="green" />
              <ProfileRow label="Worst Instrument" value={profile.worstInstrument ?? '-'} accent="red" />
              <ProfileRow label="Best Trading Time" value={profile.bestTime ?? '-'} accent="green" />
              <ProfileRow label="Worst Trading Time" value={profile.worstTime ?? '-'} accent="red" />
              <ProfileRow label="Avg Holding Period" value={profile.avgHoldingPeriod ?? '-'} />
              <ProfileRow label="Avg Risk/Reward" value={profile.avgRiskReward ? `${profile.avgRiskReward.toFixed(2)}:1` : '-'} />
              <ProfileRow label="Win Rate" value={profile.winRate ? `${profile.winRate.toFixed(0)}%` : '-'} />
              <ProfileRow label="Profit Factor" value={profile.profitFactor ? (profile.profitFactor === Infinity ? 'Inf' : profile.profitFactor.toFixed(2)) : '-'} />
              <ProfileRow label="Max Drawdown" value={profile.maxDrawdown ? `${profile.maxDrawdown.toFixed(2)}%` : '-'} accent="amber" />
              <ProfileRow label="Common Mistake" value={profile.commonMistake ?? '-'} accent="red" />
            </div>
          )}
          <p className="text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">Disclaimer: Based on your journal entries with MOCK data. Not financial advice.</p>
        </div>
      </Modal>
    </div>
  );
}

function ProfileRow({ label, value, accent }: { label: string; value: string; accent?: 'green' | 'red' | 'amber' }) {
  const colors: Record<string, string> = { green: 'text-emerald-600 dark:text-emerald-400', red: 'text-red-600 dark:text-red-400', amber: 'text-amber-600 dark:text-amber-400' };
  return (
    <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-sm font-medium mt-0.5 ${accent ? colors[accent] : 'text-slate-900 dark:text-white'}`}>{value}</p>
    </div>
  );
}

function AddTradeModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (e: Omit<JournalEntry, 'id'>) => void }) {
  const [instrument, setInstrument] = useState('NIFTY');
  const [direction, setDirection] = useState<Direction>('BULLISH');
  const [entry, setEntry] = useState('');
  const [exit, setExit] = useState('');
  const [quantity, setQuantity] = useState('75');
  const [stopLoss, setStopLoss] = useState('');
  const [target, setTarget] = useState('');
  const [strategy, setStrategy] = useState('Trend Following');
  const [reason, setReason] = useState('');
  const [emotionBefore, setEmotionBefore] = useState('Confident');
  const [emotionAfter, setEmotionAfter] = useState('Satisfied');
  const [result, setResult] = useState<'WIN' | 'LOSS' | 'BREAKEVEN' | 'OPEN'>('WIN');
  const [pnl, setPnl] = useState('');
  const [mistake, setMistake] = useState('');
  const [notes, setNotes] = useState('');

  const handleAdd = () => {
    const entryVal = parseFloat(entry) || 0;
    const exitVal = parseFloat(exit) || 0;
    const qty = parseFloat(quantity) || 0;
    const pnlVal = parseFloat(pnl) || (exitVal - entryVal) * qty;
    onAdd({
      date: new Date().toISOString().slice(0, 10), instrument, direction,
      entry: entryVal, exit: exitVal, quantity: qty,
      stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      target: target ? parseFloat(target) : undefined,
      strategy, reason, emotionBefore, emotionAfter,
      result, pnl: pnlVal, mistake: mistake || undefined, notes,
    });
    onClose();
    setEntry(''); setExit(''); setStopLoss(''); setTarget(''); setPnl(''); setReason(''); setMistake(''); setNotes('');
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Journal Entry" maxWidth="max-w-2xl">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Input label="Instrument" value={instrument} onChange={setInstrument} />
          <Select label="Direction" value={direction} onChange={(v) => setDirection(v as Direction)} options={[{ value: 'BULLISH', label: 'Bullish (Long)' }, { value: 'BEARISH', label: 'Bearish (Short)' }]} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Entry Price" type="number" value={entry} onChange={setEntry} />
          <Input label="Exit Price" type="number" value={exit} onChange={setExit} />
          <Input label="Quantity" type="number" value={quantity} onChange={setQuantity} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Stop Loss" type="number" value={stopLoss} onChange={setStopLoss} placeholder="Optional" />
          <Input label="Target" type="number" value={target} onChange={setTarget} placeholder="Optional" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Strategy" value={strategy} onChange={setStrategy} options={STRATEGIES.map((s) => ({ value: s, label: s }))} />
          <Select label="Result" value={result} onChange={(v) => setResult(v as typeof result)} options={[{ value: 'WIN', label: 'Win' }, { value: 'LOSS', label: 'Loss' }, { value: 'BREAKEVEN', label: 'Breakeven' }, { value: 'OPEN', label: 'Open' }]} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Emotion Before" value={emotionBefore} onChange={setEmotionBefore} options={EMOTIONS.map((e) => ({ value: e, label: e }))} />
          <Select label="Emotion After" value={emotionAfter} onChange={setEmotionAfter} options={EMOTIONS.map((e) => ({ value: e, label: e }))} />
        </div>
        <Input label="P&L (₹) — auto-calculated if empty" type="number" value={pnl} onChange={setPnl} placeholder="Auto: (exit - entry) × qty" />
        <Input label="Reason for Entry" value={reason} onChange={setReason} placeholder="Why did you enter this trade?" />
        <Select label="Mistake (if any)" value={mistake} onChange={setMistake} options={[{ value: '', label: 'None' }, ...MISTAKES.map((m) => ({ value: m, label: m }))]} />
        <Input label="Notes" value={notes} onChange={setNotes} placeholder="Additional notes" />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleAdd}>Add Trade</Button>
        </div>
      </div>
    </Modal>
  );
}
