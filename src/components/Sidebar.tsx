import { LayoutDashboard, LineChart, Wallet, Layers, Brain, Target, Calculator, BookOpen, ShieldAlert, Newspaper, Bell, Settings, Menu, X, ScanLine, FlaskConical, BarChart3, Activity, HeartPulse, Database, Gauge, MoonStar } from 'lucide-react';
import { useState } from 'react';

export type PageKey = 'dashboard' | 'markets' | 'portfolio' | 'options' | 'ai-analyst' | 'trade-scanner' | 'commodity-next-session' | 'commodity-diagnostics' | 'commodity-backtest' | 'live-validation' | 'system-health' | 'data-quality' | 'backtest' | 'direction-diagnostics' | 'trade-setup' | 'position-sizing' | 'journal' | 'risk' | 'news' | 'alerts' | 'settings';

const NAV_ITEMS: { key: PageKey; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'markets', label: 'Markets', icon: LineChart },
  { key: 'portfolio', label: 'Portfolio', icon: Wallet },
  { key: 'options', label: 'Options', icon: Layers },
  { key: 'ai-analyst', label: 'AI Analyst', icon: Brain },
  { key: 'trade-scanner', label: 'Trade Scanner', icon: ScanLine },
  { key: 'commodity-next-session', label: 'Commodity Next Session', icon: MoonStar },
  { key: 'commodity-diagnostics', label: 'Commodity Diagnostics', icon: Gauge },
  { key: 'commodity-backtest', label: 'Commodity Backtest', icon: FlaskConical },
  { key: 'live-validation', label: 'Live Validation', icon: Activity },
  { key: 'system-health', label: 'System Health', icon: HeartPulse },
  { key: 'data-quality', label: 'Data Quality', icon: Database },
  { key: 'backtest', label: 'Backtest', icon: FlaskConical },
  { key: 'direction-diagnostics', label: 'Direction Diagnostics', icon: BarChart3 },
  { key: 'trade-setup', label: 'Trade Setup', icon: Target },
  { key: 'position-sizing', label: 'Position Sizing', icon: Calculator },
  { key: 'journal', label: 'Trading Journal', icon: BookOpen },
  { key: 'risk', label: 'Risk Center', icon: ShieldAlert },
  { key: 'news', label: 'News', icon: Newspaper },
  { key: 'alerts', label: 'Alerts', icon: Bell },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ page, onNavigate }: { page: PageKey; onNavigate: (p: PageKey) => void }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navContent = (
    <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = page === item.key;
        return <button key={item.key} onClick={() => { onNavigate(item.key); setMobileOpen(false); }} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${active ? 'bg-blue-600 text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Icon size={18}/>{item.label}</button>;
      })}
    </nav>
  );
  const logo = <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-200 dark:border-slate-800"><div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center"><span className="text-white font-bold text-sm">A</span></div><div><p className="font-bold text-slate-900 dark:text-white text-sm">AlphaPilot</p><p className="text-xs text-slate-500 dark:text-slate-400">Trading Terminal</p></div></div>;
  return <><button onClick={() => setMobileOpen(true)} className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm"><Menu size={20} className="text-slate-700 dark:text-slate-300"/></button><div className="hidden md:flex flex-col w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 h-screen sticky top-0">{logo}{navContent}</div>{mobileOpen && <div className="md:hidden fixed inset-0 z-50 flex"><div className="w-60 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col"><div className="flex items-center justify-between">{logo}<button onClick={() => setMobileOpen(false)} className="px-4 text-slate-400"><X size={20}/></button></div>{navContent}</div><div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)}/></div>}</>;
}
