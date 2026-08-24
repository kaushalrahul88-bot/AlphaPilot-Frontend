import { useEffect, useMemo, useState } from 'react';
import { Newspaper, TrendingUp, TrendingDown, Minus, RefreshCw, ExternalLink } from 'lucide-react';
import { Card, CardBody, Badge, Button, Select } from '@/components/ui';
import { INSTRUMENTS } from '@/lib/marketData';
import { getMarketNews, type MarketNewsItem, type MarketNewsResponse } from '@/lib/alphaPilotApi';

const DEFAULT_SYMBOLS = ['NIFTY', 'BANKNIFTY', 'RELIANCE', 'HDFCBANK', 'ICICIBANK', 'INFY', 'TCS'];

export function News() {
  const [filterSymbol, setFilterSymbol] = useState('');
  const [data, setData] = useState<MarketNewsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const symbols = useMemo(() => filterSymbol ? [filterSymbol] : DEFAULT_SYMBOLS, [filterSymbol]);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      setData(await getMarketNews(symbols, 3));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load live market news.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [filterSymbol]);

  const rows = useMemo(() => {
    if (!data) return [] as Array<{ symbol: string; item: MarketNewsItem }>;
    return Object.entries(data.items ?? {})
      .flatMap(([symbol, items]) => (items ?? []).map(item => ({ symbol, item })))
      .sort((a, b) => new Date(b.item.published_at ?? 0).getTime() - new Date(a.item.published_at ?? 0).getTime());
  }, [data]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Live Market News</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Recent market headlines with rule-based sentiment context from trusted financial publishers.</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterSymbol} onChange={setFilterSymbol} options={[{ value: '', label: 'Top Market News' }, ...INSTRUMENTS.map(i => ({ value: i.symbol, label: i.symbol }))]} />
          <Button variant="default" onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={`inline mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
      </div>

      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-2 items-center text-xs text-slate-500 dark:text-slate-400">
            <Badge variant="green">LIVE FEED</Badge>
            <span>Aggregator: {data?.provider ?? 'Google News RSS'}</span>
            <span>·</span>
            <span>Preferred: Reuters, CNBC-TV18, Moneycontrol, Economic Times, Business Standard, Mint</span>
            {data?.generated_at && <><span>·</span><span>Updated {formatNewsTime(data.generated_at)}</span></>}
          </div>
        </CardBody>
      </Card>

      {error && <Card><CardBody><p className="text-sm text-red-600 dark:text-red-400">{error}</p></CardBody></Card>}

      <div className="space-y-3">
        {rows.map(({ symbol, item }, index) => <LiveNewsCard key={`${symbol}-${item.url ?? item.headline}-${index}`} symbol={symbol} item={item} />)}
      </div>

      {!loading && !error && rows.length === 0 && (
        <Card><CardBody className="text-center py-12"><Newspaper size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" /><p className="text-slate-500 dark:text-slate-400 text-sm">No recent headlines found for this filter.</p></CardBody></Card>
      )}

      <p className="text-xs text-slate-400 dark:text-slate-500 text-center pb-4">
        Headlines are live external news. Sentiment is a simple headline classifier for context only and must not override AlphaPilot execution-quality gates. Not financial advice.
      </p>
    </div>
  );
}

function LiveNewsCard({ symbol, item }: { symbol: string; item: MarketNewsItem }) {
  const sentiment = item.sentiment ?? 'NEUTRAL';
  const variant = sentiment === 'BULLISH' ? 'green' : sentiment === 'BEARISH' ? 'red' : 'default';
  const Icon = sentiment === 'BULLISH' ? TrendingUp : sentiment === 'BEARISH' ? TrendingDown : Minus;
  const content = (
    <div className="flex items-start justify-between gap-3">
      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{item.headline}</h3>
        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
          <span>{item.source}</span><span>·</span><span>{formatNewsTime(item.published_at)}</span>
          {item.preferred_source && <Badge variant="blue">PREFERRED SOURCE</Badge>}
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="default">{symbol}</Badge>
        <Badge variant={variant}><Icon size={12} className="inline mr-1" />{sentiment}</Badge>
        {item.url && <ExternalLink size={14} className="text-slate-400" />}
      </div>
    </div>
  );

  return <Card><CardBody>{item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="block hover:opacity-80 transition-opacity">{content}</a> : content}</CardBody></Card>;
}

function formatNewsTime(value?: string | null) {
  if (!value) return 'Time unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}
