import { useState } from 'react';
import { Newspaper, TrendingUp, TrendingDown, Minus, FileText, Globe } from 'lucide-react';
import { Card, CardHeader, CardBody, Badge, Button, Select, Modal } from '@/components/ui';
import { getNews, INSTRUMENTS } from '@/lib/marketData';
import { formatTime, formatDate } from '@/lib/format';
import type { NewsItem } from '@/lib/types';

export function News() {
  const [filterSymbol, setFilterSymbol] = useState('');
  const [showPreMarket, setShowPreMarket] = useState(false);

  const news = filterSymbol ? getNews([filterSymbol]) : getNews();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Market News</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">AI-summarized news with impact assessment</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterSymbol} onChange={setFilterSymbol} options={[{ value: '', label: 'All News' }, ...INSTRUMENTS.map((i) => ({ value: i.symbol, label: i.symbol }))]} />
          <Button variant="default" onClick={() => setShowPreMarket(true)}><FileText size={16} className="inline mr-1.5" />Pre-Market Report</Button>
        </div>
      </div>

      <div className="space-y-3">
        {news.map((item) => (
          <NewsCard key={item.id} item={item} />
        ))}
      </div>

      {news.length === 0 && (
        <Card>
          <CardBody className="text-center py-12">
            <Newspaper size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <p className="text-slate-500 dark:text-slate-400 text-sm">No news found for this filter.</p>
          </CardBody>
        </Card>
      )}

      <PreMarketReport open={showPreMarket} onClose={() => setShowPreMarket(false)} />

      <p className="text-xs text-slate-400 dark:text-slate-500 text-center pb-4">
        All news is MOCK data for the MVP. Never fabricated. Not financial advice.
      </p>
    </div>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const impactVariant = item.impact === 'BULLISH' ? 'green' : item.impact === 'BEARISH' ? 'red' : 'default';
  const ImpactIcon = item.impact === 'BULLISH' ? TrendingUp : item.impact === 'BEARISH' ? TrendingDown : Minus;

  return (
    <Card>
      <CardBody className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{item.headline}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-slate-500 dark:text-slate-400">{item.source}</span>
              <span className="text-xs text-slate-400">·</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{formatDate(item.timestamp)} {formatTime(item.timestamp)}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant="default">{item.category}</Badge>
            <Badge variant={impactVariant}>
              <ImpactIcon size={12} className="inline mr-1" />
              {item.impact}
            </Badge>
          </div>
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400">{item.summary}</p>
        <div className="flex items-center gap-2 pt-1">
          <span className="text-xs text-slate-500 dark:text-slate-400">Potential impact:</span>
          <span className={`text-xs font-medium ${item.impact === 'BULLISH' ? 'text-emerald-600 dark:text-emerald-400' : item.impact === 'BEARISH' ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`}>
            {item.impact === 'BULLISH' ? 'Bullish' : item.impact === 'BEARISH' ? 'Bearish' : 'Neutral'} for {item.symbols.join(', ')}
          </span>
        </div>
      </CardBody>
    </Card>
  );
}

function PreMarketReport({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Pre-Market AI Report" maxWidth="max-w-2xl">
      <div className="space-y-4 text-sm">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white mb-2 flex items-center gap-2"><Globe size={16} />Global Markets</h3>
          <div className="grid grid-cols-2 gap-2">
            <ReportRow label="Gift NIFTY" value="24,920 (+0.3%)" positive />
            <ReportRow label="US Markets (S&P 500)" value="5,670 (+0.5%)" positive />
            <ReportRow label="Asian Markets (Nikkei)" value="38,200 (-0.2%)" negative />
            <ReportRow label="Hang Seng" value="17,500 (-0.4%)" negative />
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Commodities & Currency</h3>
          <div className="grid grid-cols-2 gap-2">
            <ReportRow label="Crude Oil (Brent)" value="$82.3 (+1.2%)" positive />
            <ReportRow label="Gold" value="$2,650 (+0.3%)" positive />
            <ReportRow label="USD/INR" value="₹83.45 (+0.1%)" negative />
            <ReportRow label="India VIX" value="13.2 (-2.1%)" positive />
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white mb-2">FII/DII Activity</h3>
          <div className="grid grid-cols-2 gap-2">
            <ReportRow label="FII Net" value="+₹2,340 Cr" positive />
            <ReportRow label="DII Net" value="+₹1,200 Cr" positive />
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Key Levels</h3>
          <div className="grid grid-cols-2 gap-2">
            <ReportRow label="NIFTY Support" value="24,720 / 24,400" />
            <ReportRow label="NIFTY Resistance" value="25,000 / 25,200" />
            <ReportRow label="BANKNIFTY Support" value="53,800 / 53,500" />
            <ReportRow label="BANKNIFTY Resistance" value="54,500 / 55,000" />
          </div>
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Important Events</h3>
          <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
            <li>• US CPI data release at 6:00 PM IST</li>
            <li>• Reliance AGM tomorrow</li>
            <li>• India manufacturing PMI release</li>
          </ul>
        </div>
        <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <h3 className="font-semibold text-blue-700 dark:text-blue-400 mb-2">Today's Market Game Plan</h3>
          <div className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
            <p><span className="font-medium text-emerald-600 dark:text-emerald-400">Bullish Scenario:</span> If NIFTY holds above 24,800 and breaks 25,000 with volume, target 25,200. Look for long setups in banking and IT.</p>
            <p><span className="font-medium text-red-600 dark:text-red-400">Bearish Scenario:</span> If NIFTY breaks below 24,720, expect correction to 24,400. Avoid fresh longs. Look for short setups on weak sectors.</p>
            <p><span className="font-medium text-slate-500">No-Trade Scenario:</span> If NIFTY stays range-bound between 24,800-25,000 with low volume, wait for a clear breakout. Do not force trades.</p>
          </div>
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500">Disclaimer: Pre-market report based on MOCK data. Not financial advice.</p>
      </div>
    </Modal>
  );
}

function ReportRow({ label, value, positive, negative }: { label: string; value: string; positive?: boolean; negative?: boolean }) {
  const color = positive ? 'text-emerald-600 dark:text-emerald-400' : negative ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-300';
  return (
    <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
      <span className="text-xs text-slate-500 dark:text-slate-400">{label}</span>
      <span className={`text-xs font-medium ${color}`}>{value}</span>
    </div>
  );
}
