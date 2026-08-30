import { useState } from 'react';
import { Bell, Plus, Trash2, BellRing } from 'lucide-react';
import { useStore } from '@/store/StoreContext';
import { Card, CardHeader, CardBody, Badge, Table, TableRow, TableCell, Button, Modal, Input, Select } from '@/components/ui';
import { INSTRUMENTS } from '@/lib/marketData';
import { formatDate } from '@/lib/format';
import type { Alert } from '@/lib/types';

const ALERT_TYPES: { value: Alert['type']; label: string }[] = [
  { value: 'PRICE', label: 'Price Target' },
  { value: 'PCT', label: 'Percentage Move' },
  { value: 'SR_BREAK', label: 'Support/Resistance Break' },
  { value: 'VOLUME', label: 'Volume Spike' },
  { value: 'OI_CHANGE', label: 'OI Change' },
  { value: 'RSI', label: 'RSI Condition' },
  { value: 'VWAP', label: 'VWAP Breakout' },
  { value: 'EMA_CROSS', label: 'EMA Crossover' },
  { value: 'NEWS', label: 'News Event' },
];

export function Alerts() {
  const { alerts, addAlert, removeAlert, toggleAlert } = useStore();
  const [showAdd, setShowAdd] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Alerts</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Create and manage price alerts</p>
        </div>
        <Button variant="primary" onClick={() => setShowAdd(true)}><Plus size={16} className="inline mr-1.5" />Create Alert</Button>
      </div>

      <Card>
        <CardHeader title="Active Alerts" subtitle={`${alerts.length} alerts`} />
        <CardBody className="p-0">
          <Table headers={['Symbol', 'Type', 'Condition', 'Value', 'Status', 'Created', '']}>
            {alerts.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium text-slate-900 dark:text-white">{a.symbol}</TableCell>
                <TableCell><Badge variant="blue">{ALERT_TYPES.find((t) => t.value === a.type)?.label ?? a.type}</Badge></TableCell>
                <TableCell className="text-xs">{a.condition}</TableCell>
                <TableCell>{a.value ? `₹${a.value}` : '-'}</TableCell>
                <TableCell>
                  <button onClick={() => toggleAlert(a.id)}>
                    {a.active ? <Badge variant="green">Active</Badge> : <Badge variant="default">Paused</Badge>}
                  </button>
                </TableCell>
                <TableCell className="text-xs">{formatDate(new Date(a.createdAt).getTime())}</TableCell>
                <TableCell><button onClick={() => removeAlert(a.id)} className="text-slate-400 hover:text-red-500"><Trash2 size={16} /></button></TableCell>
              </TableRow>
            ))}
          </Table>
          {alerts.length === 0 && (
            <div className="text-center py-12">
              <Bell size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
              <p className="text-slate-500 dark:text-slate-400 text-sm">No alerts yet. Create one to get notified.</p>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 flex items-start gap-2">
        <BellRing size={16} className="text-blue-500 shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 dark:text-blue-400">
          Browser notifications are supported. When an alert triggers, you'll receive a notification if you've granted permission. In the MVP, alerts are checked against MOCK data.
        </p>
      </div>

      <AddAlertModal open={showAdd} onClose={() => setShowAdd(false)} onAdd={addAlert} />
    </div>
  );
}

function AddAlertModal({ open, onClose, onAdd }: { open: boolean; onClose: () => void; onAdd: (a: Omit<Alert, 'id' | 'createdAt' | 'triggered'>) => void }) {
  const [symbol, setSymbol] = useState('NIFTY');
  const [type, setType] = useState<Alert['type']>('PRICE');
  const [condition, setCondition] = useState('Price crosses above');
  const [value, setValue] = useState('');

  const handleAdd = () => {
    onAdd({ symbol, type, condition, value: value ? parseFloat(value) : undefined, active: true });
    onClose();
    setValue('');
  };

  return (
    <Modal open={open} onClose={onClose} title="Create Alert">
      <div className="space-y-3">
        <Select label="Instrument" value={symbol} onChange={setSymbol} options={INSTRUMENTS.map((i) => ({ value: i.symbol, label: `${i.symbol} — ${i.name}` }))} />
        <Select label="Alert Type" value={type} onChange={(v) => setType(v as Alert['type'])} options={ALERT_TYPES} />
        <Input label="Condition" value={condition} onChange={setCondition} placeholder="e.g. Price crosses above" />
        <Input label="Value (₹)" type="number" value={value} onChange={setValue} placeholder="e.g. 25000" />
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleAdd}>Create Alert</Button>
        </div>
      </div>
    </Modal>
  );
}
