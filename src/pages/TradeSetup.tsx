import { useState } from 'react';
import { Brain, Target, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { useStore } from '@/store/StoreContext';
import { Card, CardHeader, CardBody, Badge, Button, Select } from '@/components/ui';
import { LineChart } from '@/components/charts';
import { generateTradeSetup, suggestOptionStrike, analyzeTrend } from '@/lib/scanner';
import { getQuote, getOhlc, getInstrument, INSTRUMENTS, getOptionsChain, getExpiries } from '@/lib/marketData';
import { formatCurrency } from '@/lib/format';
import type { Direction, TradeSetup } from '@/lib/types';

export function TradeSetup() {
  const { tradingCapital, scannerFilters } = useStore();
  const [symbol, setSymbol] = useState('NIFTY');
  const [setup, setSetup] = useState<TradeSetup | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [optionSuggestion, setOptionSuggestion] = useState<ReturnType<typeof suggestOptionStrike> | null>(null);

  const quote = getQuote(symbol);
  const ohlc = getOhlc(symbol);
  const trend = analyzeTrend(ohlc);

  const handleAnalyze = () => {
    setAnalyzing(true);
    setSetup(null);
    setOptionSuggestion(null);
    setTimeout(() => {
      const result = generateTradeSetup(symbol, tradingCapital, scannerFilters);
      setSetup(result);
      if (result) {
        const sug = suggestOptionStrike(symbol, result.direction);
        setOptionSuggestion(sug);
      }
      setAnalyzing(false);
    }, 800);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">AI Trade Setup</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Generate a structured trade setup for any instrument</p>
        </div>
        <div className="flex gap-2">
          <Select value={symbol} onChange={setSymbol} options={INSTRUMENTS.map((i) => ({ value: i.symbol, label: `${i.symbol} — ${i.name}` }))} />
          <Button variant="primary" onClick={handleAnalyze} disabled={analyzing}>
            <Target size={16} className="inline mr-1.5" />
            {analyzing ? 'Analyzing...' : 'Analyze Trade'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader title={symbol} subtitle={`${getInstrument(symbol)?.name} | ₹${quote.ltp.toFixed(2)} | ${quote.changePct >= 0 ? '+' : ''}${quote.changePct}%`} />
          <CardBody>
            <LineChart data={ohlc} height={200} color="auto" />
            <div className="grid grid-cols-3 gap-3 mt-3 text-sm">
              <div><span className="text-xs text-slate-500">Trend</span><p className="font-medium">{trend.trend}</p></div>
              <div><span className="text-xs text-slate-500">RSI</span><p className="font-medium">{trend.rsiVal.toFixed(1)}</p></div>
              <div><span className="text-xs text-slate-500">ATR</span><p className="font-medium">{trend.atrVal.toFixed(2)}</p></div>
              <div><span className="text-xs text-slate-500">EMA 9/20/50</span><p className="font-medium text-xs">{trend.ema9.toFixed(0)} / {trend.ema20.toFixed(0)} / {trend.ema50.toFixed(0)}</p></div>
              <div><span className="text-xs text-slate-500">Support</span><p className="font-medium text-emerald-600">₹{trend.support.toFixed(2)}</p></div>
              <div><span className="text-xs text-slate-500">Resistance</span><p className="font-medium text-red-600">₹{trend.resistance.toFixed(2)}</p></div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Market Structure" subtitle="Price action analysis" />
          <CardBody className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-500">Trend</span><Badge variant={trend.trend === 'UPTREND' ? 'green' : trend.trend === 'DOWNTREND' ? 'red' : 'default'}>{trend.trend}</Badge></div>
            <div className="flex justify-between"><span className="text-slate-500">Momentum</span><span className="text-xs">{trend.momentum > 0 ? 'Positive' : 'Negative'}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">VWAP</span><span>₹{trend.vwap.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">MACD</span><span>{trend.macdVal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Signal</span><span>{trend.macdSignal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Prev High</span><span>₹{trend.ema9.toFixed(2)}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Prev Low</span><span>₹{trend.ema50.toFixed(2)}</span></div>
          </CardBody>
        </Card>
      </div>

      {analyzing && (
        <Card>
          <CardBody className="text-center py-12">
            <Brain size={40} className="mx-auto text-blue-500 mb-3 animate-pulse" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">Alpha AI is analyzing {symbol}...</p>
          </CardBody>
        </Card>
      )}

      {setup && !analyzing && (
        <Card>
          <CardHeader
            title="AI Trade Setup"
            subtitle={`${setup.instrument} — ${setup.kind}${setup.optionType ? ` ${setup.optionType}` : ''}`}
            action={
              <div className="flex items-center gap-2">
                <Badge variant={setup.direction === 'BULLISH' ? 'green' : setup.direction === 'BEARISH' ? 'red' : 'default'}>
                  {setup.direction === 'BULLISH' ? <TrendingUp size={12} className="inline mr-1" /> : setup.direction === 'BEARISH' ? <TrendingDown size={12} className="inline mr-1" /> : <Minus size={12} className="inline mr-1" />}
                  {setup.direction}
                </Badge>
                <Badge variant="blue">Confidence: {setup.confidence}%</Badge>
              </div>
            }
          />
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
              <div><span className="text-xs text-slate-500">Entry Zone</span><p className="font-medium">₹{setup.entryZone[0]} — ₹{setup.entryZone[1]}</p></div>
              <div><span className="text-xs text-slate-500">Stop Loss</span><p className="font-medium text-red-600">₹{setup.stopLoss}</p></div>
              <div><span className="text-xs text-slate-500">Target 1</span><p className="font-medium text-emerald-600">₹{setup.target1}</p></div>
              <div><span className="text-xs text-slate-500">Target 2</span><p className="font-medium text-emerald-600">₹{setup.target2}</p></div>
              <div><span className="text-xs text-slate-500">Risk/Reward</span><p className="font-medium">{setup.riskReward}:1</p></div>
              <div><span className="text-xs text-slate-500">Quantity</span><p className="font-medium">{setup.quantity} ({setup.lots} lots)</p></div>
              <div><span className="text-xs text-slate-500">Max Risk</span><p className="font-medium text-red-600">{formatCurrency(setup.maxRisk, true)}</p></div>
              <div><span className="text-xs text-slate-500">Potential Profit</span><p className="font-medium text-emerald-600">{formatCurrency(setup.potentialProfit, true)}</p></div>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-500 mb-1">Key Reasons:</p>
              <ul className="space-y-1">
                {setup.reasons.map((r, i) => <li key={i} className="text-xs text-slate-600 dark:text-slate-400 flex gap-1.5"><span className="text-blue-500">•</span>{r}</li>)}
              </ul>
            </div>
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-red-500">Invalidation: {setup.invalidation}</p>
            </div>

            {optionSuggestion && (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <p className="text-xs font-semibold text-slate-500 mb-2">Suggested Option Strike:</p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                  <div><span className="text-xs text-slate-500">Strike</span><p className="font-medium">{optionSuggestion.strike} {optionSuggestion.type}</p></div>
                  <div><span className="text-xs text-slate-500">Premium</span><p className="font-medium">₹{optionSuggestion.premium}</p></div>
                  <div><span className="text-xs text-slate-500">Delta</span><p className="font-medium">{optionSuggestion.delta}</p></div>
                  <div><span className="text-xs text-slate-500">IV / Theta</span><p className="font-medium">{optionSuggestion.iv}% / {optionSuggestion.theta}</p></div>
                </div>
                <p className="text-xs text-slate-500 mt-2">{optionSuggestion.reason}</p>
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {!setup && !analyzing && (
        <Card>
          <CardBody className="text-center py-12">
            <Target size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">Select an instrument and click "Analyze Trade" to generate a setup.</p>
          </CardBody>
        </Card>
      )}

      <p className="text-xs text-slate-400 dark:text-slate-500 text-center pb-4">
        Live market data unavailable — analysis based on the latest available MOCK data. This is analytical information, not financial advice. Does not guarantee returns.
      </p>
    </div>
  );
}
