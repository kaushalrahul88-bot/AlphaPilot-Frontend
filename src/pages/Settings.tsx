import { useState } from 'react';
import { Settings as SettingsIcon, Save, Calculator } from 'lucide-react';
import { useStore } from '@/store/StoreContext';
import { Card, CardHeader, CardBody, Button, Input, Badge } from '@/components/ui';
import { scenarioAnalysis, optionScenario } from '@/lib/scenario';
import { getQuote, INSTRUMENTS, getInstrument } from '@/lib/marketData';
import { formatCurrency, formatPct } from '@/lib/format';
import { EvidenceBackupPanel } from '@/components/EvidenceBackupPanel';

export function Settings() {
  const { tradingCapital, setTradingCapital, riskLimits, updateRiskLimits, scannerFilters, setScannerFilters, theme, setTheme } = useStore();
  const [cap, setCap] = useState(String(tradingCapital));

  // Scenario analysis state
  const [scenarioSymbol, setScenarioSymbol] = useState('NIFTY');
  const [scenarioPct, setScenarioPct] = useState('1');
  const [optEntry, setOptEntry] = useState('');
  const [optTarget, setOptTarget] = useState('');
  const [optQty, setOptQty] = useState('1');
  const [optSymbol, setOptSymbol] = useState('NIFTY');

  const scenarioResult = scenarioPct ? scenarioAnalysis(
    useStorePositions(), scenarioSymbol, parseFloat(scenarioPct) || 0
  ) : null;

  const optInst = getInstrument(optSymbol);
  const optResult = optEntry && optTarget ? optionScenario(
    parseFloat(optEntry), parseFloat(optTarget),
    parseFloat(optQty) || 1, optInst?.lotSize ?? 1
  ) : null;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">Settings</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Configure your trading capital, risk limits, and scanner filters</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Trading Capital" subtitle="Your total trading capital" />
          <CardBody className="space-y-3">
            <Input label="Trading Capital (₹)" type="number" value={cap} onChange={setCap} />
            <Button variant="primary" onClick={() => setTradingCapital(parseFloat(cap) || 0)}><Save size={16} className="inline mr-1.5" />Save Capital</Button>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Theme" subtitle="Dark or light mode" />
          <CardBody>
            <div className="flex gap-2">
              <Button variant={theme === 'dark' ? 'primary' : 'default'} onClick={() => setTheme('dark')}>Dark Mode</Button>
              <Button variant={theme === 'light' ? 'primary' : 'default'} onClick={() => setTheme('light')}>Light Mode</Button>
            </div>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Risk Limits" subtitle="Your personal risk management rules" />
        <CardBody>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Input label="Max Risk per Trade (%)" type="number" value={String(riskLimits.maxRiskPerTradePct)} onChange={(v) => updateRiskLimits({ maxRiskPerTradePct: parseFloat(v) || 0 })} />
            <Input label="Max Daily Loss (%)" type="number" value={String(riskLimits.maxDailyLossPct)} onChange={(v) => updateRiskLimits({ maxDailyLossPct: parseFloat(v) || 0 })} />
            <Input label="Max Weekly Loss (%)" type="number" value={String(riskLimits.maxWeeklyLossPct)} onChange={(v) => updateRiskLimits({ maxWeeklyLossPct: parseFloat(v) || 0 })} />
            <Input label="Max Open Risk (%)" type="number" value={String(riskLimits.maxOpenRiskPct)} onChange={(v) => updateRiskLimits({ maxOpenRiskPct: parseFloat(v) || 0 })} />
            <Input label="Max Concentration (%)" type="number" value={String(riskLimits.maxConcentrationPct)} onChange={(v) => updateRiskLimits({ maxConcentrationPct: parseFloat(v) || 0 })} />
            <Input label="Max Leverage (x)" type="number" value={String(riskLimits.maxLeverage)} onChange={(v) => updateRiskLimits({ maxLeverage: parseFloat(v) || 0 })} />
          </div>
        </CardBody>
      </Card>

      <EvidenceBackupPanel />

      <Card>
        <CardHeader title="Scanner Filters" subtitle="Default thresholds for the Trade Scanner" />
        <CardBody>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            <Input label="Min Risk/Reward" type="number" value={String(scannerFilters.minRiskReward)} onChange={(v) => setScannerFilters({ minRiskReward: parseFloat(v) || 0 })} />
            <Input label="Max Risk per Trade (%)" type="number" value={String(scannerFilters.maxRiskPct)} onChange={(v) => setScannerFilters({ maxRiskPct: parseFloat(v) || 0 })} />
            <Input label="Min Liquidity (Volume)" type="number" value={String(scannerFilters.minLiquidity)} onChange={(v) => setScannerFilters({ minLiquidity: parseFloat(v) || 0 })} />
          </div>
          <div className="flex gap-3 mt-3">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <input type="checkbox" checked={scannerFilters.avoidHighVolatility} onChange={(e) => setScannerFilters({ avoidHighVolatility: e.target.checked })} className="rounded" />
              Avoid high volatility setups
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <input type="checkbox" checked={scannerFilters.trendAlignment} onChange={(e) => setScannerFilters({ trendAlignment: e.target.checked })} className="rounded" />
              Require trend alignment
            </label>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Scenario Analysis" subtitle="What-if analysis for your portfolio" action={<Calculator size={18} className="text-slate-400" />} />
        <CardBody className="space-y-4">
          <div>
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Portfolio Impact</h4>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Instrument</label>
                <select value={scenarioSymbol} onChange={(e) => setScenarioSymbol(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm">
                  {INSTRUMENTS.map((i) => <option key={i.symbol} value={i.symbol}>{i.symbol}</option>)}
                </select>
              </div>
              <Input label="Price Change (%)" type="number" value={scenarioPct} onChange={setScenarioPct} placeholder="e.g. 1 or -5" />
              <div className="flex items-end">
                {scenarioResult && (
                  <div className="w-full p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <p className="text-xs text-slate-500">New Price: ₹{scenarioResult.newPrice.toFixed(2)}</p>
                    <p className={`text-sm font-medium ${scenarioResult.totalImpact >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                      Impact: {formatCurrency(scenarioResult.totalImpact, true)}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800">
            <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Option Profit Calculator</h4>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Instrument</label>
                <select value={optSymbol} onChange={(e) => setOptSymbol(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm">
                  {INSTRUMENTS.filter((i) => i.lotSize).map((i) => <option key={i.symbol} value={i.symbol}>{i.symbol}</option>)}
                </select>
              </div>
              <Input label="Entry Premium (₹)" type="number" value={optEntry} onChange={setOptEntry} placeholder="e.g. 150" />
              <Input label="Target Premium (₹)" type="number" value={optTarget} onChange={setOptTarget} placeholder="e.g. 250" />
              <Input label="Lots" type="number" value={optQty} onChange={setOptQty} placeholder="e.g. 1" />
            </div>
            {optResult && (
              <div className="flex items-center gap-3 mt-3">
                <Badge variant={optResult.profit >= 0 ? 'green' : 'red'}>
                  Profit: {formatCurrency(optResult.profit, true)}
                </Badge>
                <Badge variant="default">ROI: {formatPct(optResult.pnlPct)}</Badge>
                <span className="text-xs text-slate-500">Lot Size: {optInst?.lotSize ?? 1}</span>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Data Architecture" subtitle="Market data provider configuration" />
        <CardBody>
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
              <span className="text-slate-600 dark:text-slate-400">Current Provider</span>
              <Badge variant="amber">MOCK (Built-in)</Badge>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
              <span className="text-slate-600 dark:text-slate-400">Data Status</span>
              <Badge variant="amber">MOCK — Timestamped</Badge>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 pt-2">
              The MVP uses built-in MOCK data with timestamps. A live Indian market-data provider (e.g. NSE, Zerodha Kite, Upstox) can be plugged in by implementing the market-data service interface — no UI or analysis engine changes needed.
            </p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function useStorePositions() {
  const { positions } = useStore();
  return positions;
}
