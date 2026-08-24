import { useState } from 'react';
import { useStore } from '@/store/StoreContext';
import { Card, CardHeader, CardBody, StatCard, Badge, Table, TableRow, TableCell, Button, Select, Input } from '@/components/ui';
import { getOptionsChain, getExpiries, getInstrument, INSTRUMENTS } from '@/lib/marketData';
import { formatCompact } from '@/lib/format';
import type { OptionRow } from '@/lib/types';

export function Options() {
  const [symbol, setSymbol] = useState('NIFTY');
  const [expiry, setExpiry] = useState(getExpiries('NIFTY')[0]);
  const chain = getOptionsChain(symbol, expiry);
  const inst = getInstrument(symbol);

  const maxCeOi = Math.max(...chain.rows.map((r) => r.ceOi));
  const maxPeOi = Math.max(...chain.rows.map((r) => r.peOi));
  const maxCeChgOi = Math.max(...chain.rows.map((r) => Math.abs(r.ceChgOi)));
  const maxPeChgOi = Math.max(...chain.rows.map((r) => Math.abs(r.peChgOi)));

  const expiries = getExpiries(symbol);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Options Chain</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Calls and puts side-by-side with Greeks</p>
        </div>
        <div className="flex gap-2">
          <Select value={symbol} onChange={(v) => { setSymbol(v); setExpiry(getExpiries(v)[0]); }} options={INSTRUMENTS.filter((i) => i.type === 'INDEX' || i.type === 'STOCK').map((i) => ({ value: i.symbol, label: i.symbol }))} />
          <Select value={expiry} onChange={setExpiry} options={expiries.map((e) => ({ value: e, label: e }))} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Spot Price" value={`₹${chain.spot.toFixed(2)}`} accent="blue" />
        <StatCard label="ATM Strike" value={chain.atmStrike.toString()} accent="amber" />
        <StatCard label="Highest CE OI" value={formatCompact(maxCeOi)} subvalue="Resistance" accent="red" />
        <StatCard label="Highest PE OI" value={formatCompact(maxPeOi)} subvalue="Support" accent="green" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="OI-Based Signals" subtitle="Support & Resistance from Open Interest" />
          <CardBody>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Highest CE OI (Resistance)</span>
                <Badge variant="red">₹{chain.rows.find((r) => r.ceOi === maxCeOi)?.strike}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Highest PE OI (Support)</span>
                <Badge variant="green">₹{chain.rows.find((r) => r.peOi === maxPeOi)?.strike}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Max CE OI Change</span>
                <Badge variant="amber">{chain.rows.find((r) => Math.abs(r.ceChgOi) === maxCeChgOi)?.strike ?? '-'} ({(chain.rows.find((r) => Math.abs(r.ceChgOi) === maxCeChgOi)?.ceChgOi ?? 0) > 0 ? '+' : ''}{formatCompact(chain.rows.find((r) => Math.abs(r.ceChgOi) === maxCeChgOi)?.ceChgOi ?? 0)})</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Max PE OI Change</span>
                <Badge variant="amber">{chain.rows.find((r) => Math.abs(r.peChgOi) === maxPeChgOi)?.strike ?? '-'} ({(chain.rows.find((r) => Math.abs(r.peChgOi) === maxPeChgOi)?.peChgOi ?? 0) > 0 ? '+' : ''}{formatCompact(chain.rows.find((r) => Math.abs(r.peChgOi) === maxPeChgOi)?.peChgOi ?? 0)})</Badge>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {maxPeOi > maxCeOi
                    ? 'PE OI exceeds CE OI — bullish bias indicated by option writers.'
                    : 'CE OI exceeds PE OI — bearish bias indicated by call writers at resistance.'}
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Option Details" subtitle="Select a strike to view details" />
          <CardBody>
            <OptionDetail chain={chain} />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Options Chain" subtitle={`${symbol} | Expiry: ${expiry} | MOCK data`} />
        <CardBody className="p-0 overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th colSpan={6} className="text-center py-2 text-blue-600 dark:text-blue-400 font-semibold">CALLS</th>
                <th className="px-2 py-2 text-center text-slate-500 font-semibold">STRIKE</th>
                <th colSpan={6} className="text-center py-2 text-red-600 dark:text-red-400 font-semibold">PUTS</th>
              </tr>
              <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                <th className="px-2 py-1.5 text-right">LTP</th>
                <th className="px-2 py-1.5 text-right">OI</th>
                <th className="px-2 py-1.5 text-right">Chg OI</th>
                <th className="px-2 py-1.5 text-right">Vol</th>
                <th className="px-2 py-1.5 text-right">IV</th>
                <th className="px-2 py-1.5 text-right">Delta</th>
                <th className="px-2 py-1.5 text-center bg-slate-50 dark:bg-slate-800/50">Strike</th>
                <th className="px-2 py-1.5 text-right">Delta</th>
                <th className="px-2 py-1.5 text-right">IV</th>
                <th className="px-2 py-1.5 text-right">Vol</th>
                <th className="px-2 py-1.5 text-right">Chg OI</th>
                <th className="px-2 py-1.5 text-right">OI</th>
                <th className="px-2 py-1.5 text-right">LTP</th>
              </tr>
            </thead>
            <tbody>
              {chain.rows.map((row) => {
                const isAtm = row.strike === chain.atmStrike;
                const isItmCe = row.strike < chain.spot;
                const isItmPe = row.strike > chain.spot;
                const isMaxCeOi = row.ceOi === maxCeOi;
                const isMaxPeOi = row.peOi === maxPeOi;
                return (
                  <tr key={row.strike} className={`border-b border-slate-50 dark:border-slate-800/30 ${isAtm ? 'bg-amber-50 dark:bg-amber-900/10' : ''}`}>
                    <td className={`px-2 py-1.5 text-right ${isItmCe ? 'bg-blue-50/50 dark:bg-blue-900/10 font-medium' : ''}`}>{row.ceLtp}</td>
                    <td className={`px-2 py-1.5 text-right ${isMaxCeOi ? 'bg-red-50 dark:bg-red-900/10 font-bold text-red-600 dark:text-red-400' : ''}`}>{formatCompact(row.ceOi)}</td>
                    <td className="px-2 py-1.5 text-right">{row.ceChgOi > 0 ? '+' : ''}{formatCompact(row.ceChgOi)}</td>
                    <td className="px-2 py-1.5 text-right">{formatCompact(row.ceVolume)}</td>
                    <td className="px-2 py-1.5 text-right">{row.ceIv}</td>
                    <td className="px-2 py-1.5 text-right">{row.ceDelta}</td>
                    <td className={`px-2 py-1.5 text-center font-bold ${isAtm ? 'text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-300'}`}>{row.strike}</td>
                    <td className="px-2 py-1.5 text-right">{row.peDelta}</td>
                    <td className="px-2 py-1.5 text-right">{row.peIv}</td>
                    <td className="px-2 py-1.5 text-right">{formatCompact(row.peVolume)}</td>
                    <td className="px-2 py-1.5 text-right">{row.peChgOi > 0 ? '+' : ''}{formatCompact(row.peChgOi)}</td>
                    <td className={`px-2 py-1.5 text-right ${isMaxPeOi ? 'bg-emerald-50 dark:bg-emerald-900/10 font-bold text-emerald-600 dark:text-emerald-400' : ''}`}>{formatCompact(row.peOi)}</td>
                    <td className={`px-2 py-1.5 text-right ${isItmPe ? 'bg-red-50/50 dark:bg-red-900/10 font-medium' : ''}`}>{row.peLtp}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardBody>
      </Card>
      <p className="text-xs text-slate-400 dark:text-slate-500 text-center pb-4">
        ITM strikes are highlighted. ATM is in amber. Highest OI is highlighted. All data is MOCK — not financial advice.
      </p>
    </div>
  );
}

function OptionDetail({ chain }: { chain: ReturnType<typeof getOptionsChain> }) {
  const [strike, setStrike] = useState(chain.atmStrike);
  const row: OptionRow | undefined = chain.rows.find((r) => r.strike === strike);
  if (!row) return <p className="text-slate-400 text-sm">Select a strike</p>;

  return (
    <div className="space-y-3">
      <Select label="Strike" value={String(strike)} onChange={(v) => setStrike(Number(v))} options={chain.rows.map((r) => ({ value: String(r.strike), label: `${r.strike} ${r.strike === chain.atmStrike ? '(ATM)' : r.strike < chain.spot ? '(ITM CE)' : '(OTM CE)'}` }))} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">CALL (CE)</p>
          <DetailRow label="Premium" value={`₹${row.ceLtp}`} />
          <DetailRow label="Intrinsic Value" value={`₹${Math.max(chain.spot - row.strike, 0).toFixed(2)}`} />
          <DetailRow label="Time Value" value={`₹${(row.ceLtp - Math.max(chain.spot - row.strike, 0)).toFixed(2)}`} />
          <DetailRow label="OI" value={formatCompact(row.ceOi)} />
          <DetailRow label="Chg OI" value={formatCompact(row.ceChgOi)} />
          <DetailRow label="Volume" value={formatCompact(row.ceVolume)} />
          <DetailRow label="IV" value={`${row.ceIv}%`} />
          <DetailRow label="Delta" value={row.ceDelta.toString()} />
          <DetailRow label="Gamma" value={row.ceGamma.toString()} />
          <DetailRow label="Theta" value={row.ceTheta.toString()} />
          <DetailRow label="Vega" value={row.ceVega.toString()} />
        </div>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-red-600 dark:text-red-400">PUT (PE)</p>
          <DetailRow label="Premium" value={`₹${row.peLtp}`} />
          <DetailRow label="Intrinsic Value" value={`₹${Math.max(row.strike - chain.spot, 0).toFixed(2)}`} />
          <DetailRow label="Time Value" value={`₹${(row.peLtp - Math.max(row.strike - chain.spot, 0)).toFixed(2)}`} />
          <DetailRow label="OI" value={formatCompact(row.peOi)} />
          <DetailRow label="Chg OI" value={formatCompact(row.peChgOi)} />
          <DetailRow label="Volume" value={formatCompact(row.peVolume)} />
          <DetailRow label="IV" value={`${row.peIv}%`} />
          <DetailRow label="Delta" value={row.peDelta.toString()} />
          <DetailRow label="Gamma" value={row.peGamma.toString()} />
          <DetailRow label="Theta" value={row.peTheta.toString()} />
          <DetailRow label="Vega" value={row.peVega.toString()} />
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-medium text-slate-700 dark:text-slate-300">{value}</span>
    </div>
  );
}
