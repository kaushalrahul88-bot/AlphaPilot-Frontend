export function ema(values: number[], period: number): number[] {
  const result: number[] = [];
  const k = 2 / (period + 1);
  let prev = values[0] ?? 0;
  for (let i = 0; i < values.length; i++) {
    if (i === 0) { prev = values[0]; result.push(prev); }
    else { prev = values[i] * k + prev * (1 - k); result.push(prev); }
  }
  return result;
}

export function rsi(values: number[], period = 14): number[] {
  const result: number[] = [NaN];
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i < values.length; i++) {
    const change = values[i] - values[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    if (i <= period) {
      avgGain += gain; avgLoss += loss;
      if (i === period) {
        avgGain /= period; avgLoss /= period;
        result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
      } else { result.push(NaN); }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      result.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss));
    }
  }
  return result;
}

export function macd(values: number[], fast = 12, slow = 26, signal = 9): { macd: number[]; signal: number[]; histogram: number[] } {
  const emaFast = ema(values, fast);
  const emaSlow = ema(values, slow);
  const macdLine = values.map((_, i) => emaFast[i] - emaSlow[i]);
  const signalLine = ema(macdLine, signal);
  const histogram = macdLine.map((v, i) => v - signalLine[i]);
  return { macd: macdLine, signal: signalLine, histogram };
}

export function atr(values: number[], period = 14): number {
  if (values.length < 2) return 0;
  const trs: number[] = [];
  for (let i = 1; i < values.length; i++) {
    trs.push(Math.abs(values[i] - values[i - 1]));
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / slice.length;
}

export function supportResistance(values: number[], lookback = 20): { support: number; resistance: number } {
  const recent = values.slice(-lookback);
  return { support: Math.min(...recent), resistance: Math.max(...recent) };
}

export function maxDrawdown(values: number[]): number {
  let peak = values[0] ?? 0;
  let maxDd = 0;
  for (const v of values) {
    if (v > peak) peak = v;
    const dd = peak > 0 ? ((peak - v) / peak) * 100 : 0;
    if (dd > maxDd) maxDd = dd;
  }
  return maxDd;
}

export function cumulativeEquity(pnls: number[]): number[] {
  const equity: number[] = [];
  let cum = 0;
  for (const p of pnls) { cum += p; equity.push(cum); }
  return equity;
}
