import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, Newspaper } from 'lucide-react';
import { Badge, Card, CardBody, CardHeader } from '@/components/ui';
import {
  FNO_SCAN_EVENT,
  MTF_SCAN_EVENT,
  getTradeNews,
  type FnoScanResponse,
  type TradeNewsItem,
  type TradeNewsResponse,
} from '@/lib/alphaPilotApi';

type ScannerMode = 'find' | 'single';
type SetupMap = Record<string, { action: string; alpha: number }>;

function actionOf(result: FnoScanResponse) {
  const direction = String(result.technical?.direction ?? result.recommended_option?.direction ?? '').toUpperCase();
  return direction.includes('SHORT') ? 'BUY PE' : 'BUY CE';
}

function impactVariant(sentiment: TradeNewsItem['sentiment']) {
  return sentiment === 'BULLISH' ? 'green' : sentiment === 'BEARISH' ? 'red' : 'blue';
}

function alignment(action: string, sentiment: TradeNewsItem['sentiment']) {
  if (sentiment === 'NEUTRAL') return 'NEUTRAL';
  if (action === 'BUY CE') return sentiment === 'BULLISH' ? 'ALIGNED' : 'CONFLICTING';
  return sentiment === 'BEARISH' ? 'ALIGNED' : 'CONFLICTING';
}

export function TradeSetupNews({ mode }: { mode: ScannerMode }) {
  const [setups, setSetups] = useState<SetupMap>({});
  const [news, setNews] = useState<TradeNewsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setSetups({});
    setNews(null);
    setError(null);
  }, [mode]);

  useEffect(() => {
    const onMtfScan = () => {
      if (mode !== 'find') return;
      setSetups({});
      setNews(null);
      setError(null);
    };
    const onFnoScan = (event: Event) => {
      const result = (event as CustomEvent<FnoScanResponse>).detail;
      if (!result?.symbol) return;
      const next = { action: actionOf(result), alpha: Number(result.overall_alpha_score ?? 50) };
      setSetups(previous => mode === 'single' ? { [result.symbol]: next } : { ...previous, [result.symbol]: next });
    };
    window.addEventListener(MTF_SCAN_EVENT, onMtfScan);
    window.addEventListener(FNO_SCAN_EVENT, onFnoScan);
    return () => {
      window.removeEventListener(MTF_SCAN_EVENT, onMtfScan);
      window.removeEventListener(FNO_SCAN_EVENT, onFnoScan);
    };
  }, [mode]);

  const symbols = useMemo(() => Object.keys(setups), [setups]);

  useEffect(() => {
    if (timerRef.current != null) window.clearTimeout(timerRef.current);
    if (!symbols.length) return;
    timerRef.current = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        setNews(await getTradeNews(symbols, 3));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to load market news.');
      } finally {
        setLoading(false);
      }
    }, mode === 'find' ? 1800 : 100);
    return () => {
      if (timerRef.current != null) window.clearTimeout(timerRef.current);
    };
  }, [mode, symbols.join('|')]);

  if (!symbols.length) return null;

  return (
    <Card>
      <CardHeader
        title="Latest Market News · Trade Setups"
        subtitle="Recent symbol-specific headlines from major financial publishers, grouped with each F&O-confirmed setup."
        action={<Badge variant="blue">{loading ? 'UPDATING' : `${symbols.length} SETUP${symbols.length === 1 ? '' : 'S'}`}</Badge>}
      />
      <CardBody className="space-y-4">
        {error && <p className="text-xs text-amber-600">News feed: {error}</p>}
        {symbols.map(symbol => {
          const setup = setups[symbol];
          const rows = news?.items?.[symbol] ?? [];
          return (
            <div key={symbol} className="rounded-xl border border-slate-200 dark:border-slate-800 p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Newspaper size={17} className="text-slate-500" />
                  <b>{symbol}</b>
                  <Badge variant={setup.action === 'BUY CE' ? 'green' : 'red'}>{setup.action}</Badge>
                </div>
                <span className="text-xs text-slate-500">Alpha {setup.alpha.toFixed(1)}/100</span>
              </div>

              <div className="space-y-2 mt-3">
                {!rows.length && <p className="text-xs text-slate-500">{loading ? 'Loading latest headlines…' : 'No recent headline returned for this symbol.'}</p>}
                {rows.map((item, index) => {
                  const relation = alignment(setup.action, item.sentiment);
                  return (
                    <div key={`${symbol}-${item.headline}-${index}`} className="rounded-lg bg-slate-50 dark:bg-slate-900/60 px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          {item.url ? (
                            <a href={item.url} target="_blank" rel="noreferrer" className="text-sm font-semibold hover:underline">
                              {item.headline} <ExternalLink size={12} className="inline" />
                            </a>
                          ) : <p className="text-sm font-semibold">{item.headline}</p>}
                          <p className="text-[11px] text-slate-500 mt-1">{item.source} · {formatPublished(item.published_at)}</p>
                        </div>
                        <div className="flex gap-1 shrink-0 flex-wrap justify-end">
                          <Badge variant={impactVariant(item.sentiment)}>{item.sentiment}</Badge>
                          <Badge variant={relation === 'ALIGNED' ? 'green' : relation === 'CONFLICTING' ? 'red' : 'blue'}>{relation}</Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        <div className="rounded-lg border border-slate-200 dark:border-slate-800 px-3 py-2 text-xs text-slate-500">
          Source priority: Reuters, CNBC-TV18, Moneycontrol, Economic Times, Business Standard and Mint; other recent publishers are used only as fallback. Headline sentiment is a lightweight context label and does not override AlphaPilot execution gates.
        </div>
      </CardBody>
    </Card>
  );
}

function formatPublished(value?: string | null) {
  if (!value) return 'time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: true });
}
