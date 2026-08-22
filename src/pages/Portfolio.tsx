import { useState, useRef } from 'react';
import { Plus, Upload, Trash2, Download } from 'lucide-react';
import { useStore } from '@/store/StoreContext';
import { Card, CardHeader, CardBody, StatCard, Badge, Table, TableRow, TableCell, Button, Modal, Input, Select } from '@/components/ui';
import { Sparkline } from '@/components/charts';
import { positionPnl, portfolioSummary, allocationBySector } from '@/lib/portfolio';
import { getQuote, getInstrument, INSTRUMENTS } from '@/lib/marketData';
import { formatCurrency, formatPct } from '@/lib/format';
import type { Exchange, InstrumentType, Position } from '@/lib/types';

export function Portfolio() {
  const { positions, addPosition, removePosition, updatePosition, journal, tradingCapital } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [importMsg, setImportMsg] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const realizedHistory = journal.map((j) => j.pnl);
  const summary = portfolioSummary(positions, tradingCapital, realizedHistory);
  const sectorAlloc = allocationBySector(positions);

  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split('\n').filter((l) => l.trim());
      let count = 0;
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim());
        if (cols.length < 4) continue;
        const symbol = cols[0].toUpperCase();
        const inst = INSTRUMENTS.find((i) => i.symbol === symbol);
        if (!inst) continue;
        const qty = parseFloat(cols[1]) || 0;
        const buyPrice = parseFloat(cols[2]) || 0;
        const entryDate = cols[3] || new Date().toISOString().slice(0, 10);
        if (qty > 0 && buyPrice > 0) {
          addPosition({
            symbol, exchange: inst.exchange, type: inst.type,
            quantity: qty, buyPrice, currentPrice: getQuote(symbol)?.ltp ?? buyPrice,
            avgPrice: buyPrice, entryDate, positionSize: qty * buyPrice, brokerage: 0, realizedPnl: 0,
          });
          count++;
        }
      }
      setImportMsg(`Imported ${count} positions from CSV.`);
      setTimeout(() => setImportMsg(''), 3000);
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Portfolio</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage your positions and track P&L</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleCsvImport} />
          <Button variant="default" onClick={() => fileRef.current?.click()}>
            <Upload size={16} className="inline mr-1.5" />Import CSV
          </Button>
          <Button variant="primary" onClick={() => setShowAdd(true)}>
            <Plus size={16} className="inline mr-1.5" />Add Position
          </Button>
        </div>
      </div>

      {importMsg && <div className="px-4 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 text-sm">{importMsg}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total Value" value={formatCurrency(summary.totalValue, true)} accent="blue" />
        <StatCard label="Invested" value={formatCurrency(summary.investedCapital, true)} />
        <StatCard label="Total P&L" value={formatCurrency(summary.totalPnl, true)} accent={summary.totalPnl >= 0 ? 'green' : 'red'} />
        <StatCard label="Return %" value={formatPct(summary.returnPct)} accent={summary.returnPct >= 0 ? 'green' : 'red'} />
      </div>

      <Card>
        <CardHeader title="Sector Exposure" subtitle="Allocation by sector" />
        <CardBody>
          {sectorAlloc.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {sectorAlloc.map((s, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                  <div className="w-3 h-3 rounded-sm" style={{ background: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'][i % 5] }} />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{s.sector}</span>
                  <span className="text-sm text-slate-500">{s.pct.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          ) : <p className="text-slate-400 text-sm">No positions</p>}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Positions" subtitle={`${positions.length} open positions`} />
        <CardBody className="p-0">
          <Table headers={['Symbol', 'Exchange', 'Type', 'Qty', 'Avg Price', 'LTP', 'Invested', 'Current', 'P&L', 'P&L %', 'Stop Loss', 'Target', 'Trend', '']}>
            {positions.map((pos) => {
              const pnl = positionPnl(pos);
              const quote = getQuote(pos.symbol);
              const ohlc = quote?.ohlc ?? [];
              return (
                <TableRow key={pos.id}>
                  <TableCell className="font-medium text-slate-900 dark:text-white">{pos.symbol}</TableCell>
                  <TableCell><Badge>{pos.exchange}</Badge></TableCell>
                  <TableCell className="text-xs">{pos.type}</TableCell>
                  <TableCell>{pos.quantity}</TableCell>
                  <TableCell>₹{pos.avgPrice.toFixed(2)}</TableCell>
                  <TableCell>₹{quote?.ltp.toFixed(2) ?? pos.currentPrice.toFixed(2)}</TableCell>
                  <TableCell>{formatCurrency(pnl.investedValue, true)}</TableCell>
                  <TableCell>{formatCurrency(pnl.currentValue, true)}</TableCell>
                  <TableCell>
                    <span className={pnl.unrealizedPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                      {formatCurrency(pnl.unrealizedPnl, true)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={pnl.unrealizedPnlPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                      {formatPct(pnl.unrealizedPnlPct)}
                    </span>
                  </TableCell>
                  <TableCell>{pos.stopLoss ? `₹${pos.stopLoss.toFixed(2)}` : '-'}</TableCell>
                  <TableCell>{pos.target ? `₹${pos.target.toFixed(2)}` : '-'}</TableCell>
                  <TableCell><Sparkline data={ohlc.slice(-20)} width={50} height={20} color="auto" /></TableCell>
                  <TableCell>
                    <button onClick={() => removePosition(pos.id)} className="text-slate-400 hover:text-red-500">
                      <Trash2 size={16} />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </Table>
          {positions.length === 0 && <p className="text-slate-400 text-sm p-6 text-center">No positions yet. Add one to get started.</p>}
        </CardBody>
      </Card>

      <AddPositionModal open={showAdd} onClose={() => setShowAdd(false)} onAdd={addPosition} />
    </div>
  );
}

function AddPositionModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (pos: Omit<Position, 'id'>) => void }) {
  const [symbol, setSymbol] = useState('RELIANCE');
  const [quantity, setQuantity] = useState('100');
  const [buyPrice, setBuyPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [target, setTarget] = useState('');
  const [brokerage, setBrokerage] = useState('40');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));

  const inst = getInstrument(symbol);
  const handleAdd = () => {
    const qty = parseFloat(quantity) || 0;
    const price = parseFloat(buyPrice) || 0;
    if (qty <= 0 || price <= 0) return;
    onAdd({
      symbol, exchange: (inst?.exchange ?? 'NSE') as Exchange, type: (inst?.type ?? 'STOCK') as InstrumentType,
      quantity: qty, buyPrice: price, currentPrice: getQuote(symbol)?.ltp ?? price,
      avgPrice: price, entryDate, stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
      target: target ? parseFloat(target) : undefined, positionSize: qty * price,
      brokerage: parseFloat(brokerage) || 0, realizedPnl: 0,
      lotSize: inst?.lotSize,
    });
    onClose();
    setBuyPrice(''); setStopLoss(''); setTarget('');
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Position">
      <div className="space-y-3">
        <Select label="Instrument" value={symbol} onChange={setSymbol} options={INSTRUMENTS.map((i) => ({ value: i.symbol, label: `${i.symbol} — ${i.name}` }))} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Quantity" type="number" value={quantity} onChange={setQuantity} />
          <Input label="Buy Price (₹)" type="number" value={buyPrice} onChange={setBuyPrice} placeholder="e.g. 2850" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Stop Loss (₹)" type="number" value={stopLoss} onChange={setStopLoss} placeholder="Optional" />
          <Input label="Target (₹)" type="number" value={target} onChange={setTarget} placeholder="Optional" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Brokerage (₹)" type="number" value={brokerage} onChange={setBrokerage} />
          <Input label="Entry Date" type="date" value={entryDate} onChange={setEntryDate} />
        </div>
        {inst && <p className="text-xs text-slate-500 dark:text-slate-400">Exchange: {inst.exchange} | Type: {inst.type}{inst.lotSize ? ` | Lot Size: ${inst.lotSize}` : ''}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleAdd}>Add Position</Button>
        </div>
      </div>
    </Modal>
  );
}
