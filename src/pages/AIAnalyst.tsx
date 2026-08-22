import { useState } from 'react';
import { Brain, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Card, CardHeader, CardBody, Badge, Button, Select } from '@/components/ui';
import { LineChart } from '@/components/charts';
import { analyzeInstrument } from '@/lib/aiAnalyst';
import { getInstrument, INSTRUMENTS } from '@/lib/marketData';
import { formatCurrency } from '@/lib/format';

export function AIAnalyst() {
  const [symbol, setSymbol] = useState('NIFTY');
  const [analysis, setAnalysis] = useState<ReturnType<typeof analyzeInstrument> | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const handleAnalyze = () => {
    setAnalyzing(true);
    setAnalysis(null);
    setTimeout(() => {
      setAnalysis(analyzeInstrument(symbol));
      setAnalyzing(false);
    }, 800);
  };

  const inst = getInstrument(symbol);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">AI Market Analyst</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Alpha AI analyzes price action and market structure</p>
        </div>
        <div className="flex gap-2">
          <Select value={symbol} onChange={setSymbol} options={INSTRUMENTS.map((i) => ({ value: i.symbol, label: `${i.symbol} — ${i.name}` }))} />
          <Button variant="primary" onClick={handleAnalyze} disabled={analyzing}>
            <Brain size={16} className="inline mr-1.5" />
            {analyzing ? 'Analyzing...' : 'Analyze'}
          </Button>
        </div>
      </div>

      {analyzing && (
        <Card>
          <CardBody className="text-center py-12">
            <Brain size={40} className="mx-auto text-blue-500 mb-3 animate-pulse" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">Alpha AI is analyzing {symbol} using price action and technical indicators...</p>
          </CardBody>
        </Card>
      )}

      {analysis && !analyzing && (
        <>
          <Card>
            <CardHeader title={symbol} subtitle={`${inst?.name} | ₹${analysis.ltp.toFixed(2)}`} action={
              <div className="flex items-center gap-2">
                <Badge variant={analysis.direction === 'BULLISH' ? 'green' : analysis.direction === 'BEARISH' ? 'red' : 'default'}>
                  {analysis.direction === 'BULLISH' ? <TrendingUp size={12} className="inline mr-1" /> : analysis.direction === 'BEARISH' ? <TrendingDown size={12} className="inline mr-1" /> : <Minus size={12} className="inline mr-1" />}
                  {analysis.direction}
                </Badge>
                <Badge variant="blue">Confidence: {analysis.confidence}%</Badge>
              </div>
            } />
            <CardBody className="space-y-4">
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-slate-700 dark:text-slate-300">{analysis.summary}</p>
              </div>
              <LineChart data={getInstrument(symbol) ? analysis.ltp ? [analysis.ltp * 0.92, analysis.ltp * 0.94, analysis.ltp * 0.96, analysis.ltp * 0.98, analysis.ltp] : [] : []} height={180} color="auto" />
            </CardBody>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader title="Market Structure" subtitle="Price action analysis" />
              <CardBody className="space-y-2 text-sm">
                <Row label="Trend" value={analysis.trend} />
                <Row label="Momentum" value={analysis.momentum} />
                <Row label="Support" value={`₹${analysis.support.toFixed(2)}`} color="text-emerald-600 dark:text-emerald-400" />
                <Row label="Resistance" value={`₹${analysis.resistance.toFixed(2)}`} color="text-red-600 dark:text-red-400" />
                <Row label="Breakout Level" value={`₹${analysis.breakout.toFixed(2)}`} />
                <Row label="Breakdown Level" value={`₹${analysis.breakdown.toFixed(2)}`} />
                <Row label="Volume Behavior" value={analysis.volumeBehavior} />
                <Row label="Volatility" value={analysis.volatility} />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Technical Indicators" subtitle="Key metrics" />
              <CardBody className="space-y-2 text-sm">
                <Row label="EMA 9" value={`₹${analysis.ema9.toFixed(2)}`} />
                <Row label="EMA 20" value={`₹${analysis.ema20.toFixed(2)}`} />
                <Row label="EMA 50" value={`₹${analysis.ema50.toFixed(2)}`} />
                <Row label="VWAP" value={`₹${analysis.vwap.toFixed(2)}`} />
                <Row label="RSI (14)" value={analysis.rsiVal.toFixed(1)} color={analysis.rsiVal > 70 ? 'text-red-600' : analysis.rsiVal < 30 ? 'text-emerald-600' : ''} />
                <Row label="MACD" value={analysis.macdVal.toFixed(2)} />
                <Row label="MACD Signal" value={analysis.macdSignal.toFixed(2)} />
                <Row label="ATR (14)" value={analysis.atrVal.toFixed(2)} />
                <Row label="Prev Day High" value={`₹${analysis.prevHigh.toFixed(2)}`} />
                <Row label="Prev Day Low" value={`₹${analysis.prevLow.toFixed(2)}`} />
                <Row label="Open" value={`₹${analysis.open.toFixed(2)}`} />
                <Row label="High" value={`₹${analysis.high.toFixed(2)}`} />
                <Row label="Low" value={`₹${analysis.low.toFixed(2)}`} />
                <Row label="Close" value={`₹${analysis.close.toFixed(2)}`} />
              </CardBody>
            </Card>
          </div>

          <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
            <p className="text-xs text-amber-700 dark:text-amber-400">{analysis.disclaimer}</p>
          </div>
        </>
      )}

      {!analysis && !analyzing && (
        <Card>
          <CardBody className="text-center py-12">
            <Brain size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">Select an instrument and click "Analyze" to get Alpha AI's market structure analysis.</p>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-500 dark:text-slate-400 text-xs">{label}</span>
      <span className={`font-medium ${color ?? 'text-slate-700 dark:text-slate-300'}`}>{value}</span>
    </div>
  );
}
