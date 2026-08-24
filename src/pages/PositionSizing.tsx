import { useState } from 'react';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import { useStore } from '@/store/StoreContext';
import { Card, CardHeader, CardBody, StatCard, Button, Input, Select, Badge } from '@/components/ui';
import { calculatePositionSizing } from '@/lib/positionSizing';
import { getInstrument, INSTRUMENTS } from '@/lib/marketData';
import { formatCurrency, formatPct } from '@/lib/format';

export function PositionSizing() {
  const { tradingCapital, riskLimits, setTradingCapital } = useStore();
  const [capital, setCapital] = useState(String(tradingCapital));
  const [maxRiskPct, setMaxRiskPct] = useState(String(riskLimits.maxRiskPerTradePct));
  const [symbol, setSymbol] = useState('NIFTY');
  const [entry, setEntry] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [target, setTarget] = useState('');
  const [brokerage, setBrokerage] = useState('50');

  const inst = getInstrument(symbol);
  const lotSize = inst?.lotSize ?? 1;

  const result = calculatePositionSizing({
    tradingCapital: parseFloat(capital) || 0,
    maxRiskPct: parseFloat(maxRiskPct) || 0,
    entryPrice: parseFloat(entry) || 0,
    stopLoss: parseFloat(stopLoss) || 0,
    targetPrice: parseFloat(target) || 0,
    brokerage: parseFloat(brokerage) || 0,
    lotSize,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Position Sizing Calculator</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Calculate optimal position size based on your risk</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Inputs" subtitle="Enter your trade parameters" />
          <CardBody className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input label="Trading Capital (₹)" type="number" value={capital} onChange={(v) => { setCapital(v); setTradingCapital(parseFloat(v) || 0); }} />
              <Input label="Max Risk (%)" type="number" value={maxRiskPct} onChange={setMaxRiskPct} />
            </div>
            <Select label="Instrument" value={symbol} onChange={setSymbol} options={INSTRUMENTS.map((i) => ({ value: i.symbol, label: `${i.symbol} — ${i.name}${i.lotSize ? ` (Lot: ${i.lotSize})` : ''}` }))} />
            <div className="grid grid-cols-3 gap-3">
              <Input label="Entry Price" type="number" value={entry} onChange={setEntry} placeholder="e.g. 24850" />
              <Input label="Stop Loss" type="number" value={stopLoss} onChange={setStopLoss} placeholder="e.g. 24600" />
              <Input label="Target" type="number" value={target} onChange={setTarget} placeholder="e.g. 25100" />
            </div>
            <Input label="Brokerage/Charges (₹)" type="number" value={brokerage} onChange={setBrokerage} />
            {inst?.lotSize && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Badge variant="blue">Lot Size: {inst.lotSize}</Badge>
                <Badge variant="default">Exchange: {inst.exchange}</Badge>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Results" subtitle="Calculated position size and risk metrics" />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Max Risk (₹)" value={formatCurrency(result.maxRiskRupees, true)} accent="amber" />
              <StatCard label="Risk/Reward" value={`${result.riskReward.toFixed(2)}:1`} accent={result.riskReward >= 1.5 ? 'green' : 'red'} />
              <StatCard label="Quantity" value={result.quantity.toString()} subvalue={`${result.lots} lots`} accent="blue" />
              <StatCard label="Position Value" value={formatCurrency(result.positionValue, true)} />
              <StatCard label="Potential Loss" value={formatCurrency(result.potentialLoss, true)} accent="red" />
              <StatCard label="Potential Profit" value={formatCurrency(result.potentialProfit, true)} accent="green" />
              <StatCard label="Capital Utilization" value={formatPct(result.capitalUtilizationPct)} accent={result.capitalUtilizationPct > 50 ? 'amber' : 'default'} />
              <StatCard label="Risk per Unit" value={`₹${result.riskPerUnit.toFixed(2)}`} />
            </div>

            {result.warning ? (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <AlertTriangle size={18} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 dark:text-red-400">{result.warning}</p>
              </div>
            ) : result.quantity > 0 ? (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800">
                <CheckCircle size={18} className="text-emerald-500 shrink-0 mt-0.5" />
                <p className="text-sm text-emerald-700 dark:text-emerald-400">Position size is within your risk limits. This trade risks {((result.potentialLoss / (parseFloat(capital) || 1)) * 100).toFixed(2)}% of your capital.</p>
              </div>
            ) : null}

            <div className="text-xs text-slate-400 dark:text-slate-500 pt-2 border-t border-slate-100 dark:border-slate-800">
              <p>Calculations are deterministic and based on your inputs. Lot size is enforced — quantity is rounded down to whole lots.</p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
