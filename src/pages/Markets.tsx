import { useState } from 'react';
import { Plus, Trash2, Star, X } from 'lucide-react';
import { useStore } from '@/store/StoreContext';
import { Card, CardHeader, CardBody, Badge, Table, TableRow, TableCell, Button, Modal, Input, Select } from '@/components/ui';
import { Sparkline } from '@/components/charts';
import { getQuote, INSTRUMENTS, getInstrument } from '@/lib/marketData';
import { analyzeTrend } from '@/lib/scanner';
import { formatPct, formatCompact } from '@/lib/format';

export function Markets() {
  const { watchlists, addWatchlist, removeWatchlist, addToWatchlist, removeFromWatchlist } = useStore();
  const [activeList, setActiveList] = useState(watchlists[0]?.id ?? '');
  const [showAddList, setShowAddList] = useState(false);
  const [showAddSymbol, setShowAddSymbol] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [sortKey, setSortKey] = useState('symbol');

  const active = watchlists.find((w) => w.id === activeList) ?? watchlists[0];

  const rows = (active?.symbols ?? []).map((sym) => {
    const quote = getQuote(sym);
    const ohlc = quote.ohlc ?? [];
    const trend = analyzeTrend(ohlc);
    return {
      symbol: sym, ltp: quote.ltp, changePct: quote.changePct, volume: quote.volume,
      vwap: quote.vwap, rsi: trend.rsiVal, trend: trend.trend,
      support: trend.support, resistance: trend.resistance,
      direction: trend.trend === 'UPTREND' ? 'BULLISH' : trend.trend === 'DOWNTREND' ? 'BEARISH' : 'NEUTRAL',
      confidence: Math.abs(trend.momentum) > 1 ? 75 : 50,
    };
  }).sort((a, b) => {
    const av = (a as Record<string, any>)[sortKey];
    const bv = (b as Record<string, any>)[sortKey];
    if (typeof av === 'string') return av.localeCompare(bv);
    return bv - av;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Markets & Watchlists</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Track instruments with AI signals</p>
        </div>
        <div className="flex gap-2">
          {watchlists.map((w) => (
            <button
              key={w.id}
              onClick={() => setActiveList(w.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${activeList === w.id ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
            >
              {w.name}
            </button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setShowAddList(true)}><Plus size={14} /></Button>
        </div>
      </div>

      {active && (
        <Card>
          <CardHeader
            title={active.name}
            subtitle={`${active.symbols.length} instruments`}
            action={
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setShowAddSymbol(true)}><Plus size={14} className="inline mr-1" />Add</Button>
                <Button size="sm" variant="ghost" onClick={() => removeWatchlist(active.id)}><Trash2 size={14} /></Button>
              </div>
            }
          />
          <CardBody className="p-0">
            <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500">Sort by:</span>
              <Select value={sortKey} onChange={setSortKey} options={[
                { value: 'symbol', label: 'Symbol' }, { value: 'changePct', label: 'Change %' },
                { value: 'volume', label: 'Volume' }, { value: 'rsi', label: 'RSI' }, { value: 'trend', label: 'Trend' },
              ]} className="w-32" />
            </div>
            <Table headers={['Symbol', 'Price', 'Change %', 'Volume', 'VWAP', 'RSI', 'Trend', 'Support', 'Resistance', 'AI Signal', 'Conf.', '']}>
              {rows.map((r) => (
                <TableRow key={r.symbol}>
                  <TableCell className="font-medium text-slate-900 dark:text-white">{r.symbol}</TableCell>
                  <TableCell>₹{r.ltp.toFixed(2)}</TableCell>
                  <TableCell><span className={r.changePct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>{formatPct(r.changePct)}</span></TableCell>
                  <TableCell>{formatCompact(r.volume)}</TableCell>
                  <TableCell>₹{r.vwap.toFixed(2)}</TableCell>
                  <TableCell>{r.rsi.toFixed(0)}</TableCell>
                  <TableCell><Badge variant={r.trend === 'UPTREND' ? 'green' : r.trend === 'DOWNTREND' ? 'red' : 'default'}>{r.trend}</Badge></TableCell>
                  <TableCell className="text-emerald-600 dark:text-emerald-400 text-xs">₹{r.support.toFixed(0)}</TableCell>
                  <TableCell className="text-red-600 dark:text-red-400 text-xs">₹{r.resistance.toFixed(0)}</TableCell>
                  <TableCell><Badge variant={r.direction === 'BULLISH' ? 'green' : r.direction === 'BEARISH' ? 'red' : 'default'}>{r.direction}</Badge></TableCell>
                  <TableCell>{r.confidence}%</TableCell>
                  <TableCell>
                    <button onClick={() => removeFromWatchlist(active.id, r.symbol)} className="text-slate-400 hover:text-red-500"><X size={14} /></button>
                  </TableCell>
                </TableRow>
              ))}
            </Table>
            {rows.length === 0 && <p className="text-slate-400 text-sm p-6 text-center">No symbols in this watchlist. Add some to get started.</p>}
          </CardBody>
        </Card>
      )}

      {watchlists.length === 0 && (
        <Card>
          <CardBody className="text-center py-12">
            <Star size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">No watchlists yet. Create one to start tracking instruments.</p>
            <Button variant="primary" onClick={() => setShowAddList(true)} className="mt-3"><Plus size={16} className="inline mr-1.5" />Create Watchlist</Button>
          </CardBody>
        </Card>
      )}

      <Modal open={showAddList} onClose={() => setShowAddList(false)} title="Create Watchlist">
        <div className="space-y-3">
          <Input label="Watchlist Name" value={newListName} onChange={setNewListName} placeholder="e.g. My Favorites" />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowAddList(false)}>Cancel</Button>
            <Button variant="primary" onClick={() => { if (newListName.trim()) { addWatchlist(newListName); setNewListName(''); setShowAddList(false); } }}>Create</Button>
          </div>
        </div>
      </Modal>

      <AddSymbolModal open={showAddSymbol} onClose={() => setShowAddSymbol(false)} onAdd={(sym) => { if (active) addToWatchlist(active.id, sym); }} />
    </div>
  );
}

function AddSymbolModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (sym: string) => void }) {
  const [symbol, setSymbol] = useState('');
  return (
    <Modal open={open} onClose={onClose} title="Add Symbol to Watchlist">
      <div className="space-y-3">
        <Select label="Instrument" value={symbol} onChange={setSymbol} options={INSTRUMENTS.map((i) => ({ value: i.symbol, label: `${i.symbol} — ${i.name}` }))} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => { if (symbol) { onAdd(symbol); onClose(); } }}>Add</Button>
        </div>
      </div>
    </Modal>
  );
}
