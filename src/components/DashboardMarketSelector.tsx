import { Bitcoin, ChevronDown, Landmark, Waves, type LucideIcon } from 'lucide-react';
import { Badge, Card, CardBody } from '@/components/ui';
import {
  MARKET_CATEGORY_LABELS,
  findDashboardInstrument,
  type DashboardInstrument,
  type DashboardUniverse,
  type MarketCategory,
} from '@/lib/dashboardUniverse';

const CATEGORY_META = {
  FNO: { icon: Landmark, subtitle: 'Indices and equity F&O' },
  COMMODITIES: { icon: Waves, subtitle: 'MCX commodity options research' },
  CRYPTO: { icon: Bitcoin, subtitle: 'Crypto Options research' },
} satisfies Record<MarketCategory, { icon: LucideIcon; subtitle: string }>;

export function DashboardMarketSelector({
  category,
  instrument,
  selectedSymbols,
  universe,
  universeStatus,
  onSelect,
}: {
  category: MarketCategory;
  instrument: DashboardInstrument;
  selectedSymbols: Record<MarketCategory, string>;
  universe: DashboardUniverse;
  universeStatus?: string;
  onSelect: (category: MarketCategory, symbol: string) => void;
}) {
  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <p className="text-base font-semibold text-slate-900 dark:text-white">Market Brain workspace</p>
            <p className="text-xs text-slate-500 mt-1">Choose a market category, then choose the instrument AlphaPilot should show.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {universeStatus && <Badge variant={universeStatus === 'ACTIVE' ? 'green' : 'amber'}>{universeStatus}</Badge>}
            <Badge variant={instrument.state === 'CONNECTED' ? 'green' : instrument.state === 'AVAILABLE' ? 'blue' : 'default'}>{instrument.state}</Badge>
            <Badge variant="default">{instrument.symbol}</Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {(Object.keys(universe) as MarketCategory[]).map((key) => {
            const active = category === key;
            const Icon = CATEGORY_META[key].icon;
            const selectedInstrument = findDashboardInstrument(key, selectedSymbols[key], universe);
            return (
              <div
                key={key}
                className={`rounded-xl border p-4 transition-colors ${active ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/20' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900'}`}
              >
                <button type="button" onClick={() => onSelect(key, selectedInstrument.symbol)} className="w-full text-left">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}><Icon size={18}/></div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">{MARKET_CATEGORY_LABELS[key]}</p>
                        <p className="text-[11px] text-slate-500">{CATEGORY_META[key].subtitle}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">{active && <Badge variant="blue">ACTIVE</Badge>}<span className="text-[10px] text-slate-400">{universe[key].length} instruments</span></div>
                  </div>
                </button>

                <div className="relative mt-3">
                  <select
                    aria-label={`${MARKET_CATEGORY_LABELS[key]} instrument`}
                    value={selectedInstrument.symbol}
                    onChange={(event) => onSelect(key, event.target.value)}
                    className="w-full appearance-none rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 pr-9 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {universe[key].map((item) => (
                      <option key={item.symbol} value={item.symbol}>{item.symbol} — {item.name}{item.state === 'PLANNED' ? ' · planned' : ''}</option>
                    ))}
                  </select>
                  <ChevronDown size={15} className="pointer-events-none absolute right-3 top-3 text-slate-400"/>
                </div>
              </div>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
