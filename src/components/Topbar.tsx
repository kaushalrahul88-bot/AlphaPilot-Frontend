import { Sun, Moon, Search, Radio, MessageSquare, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useStore } from '@/store/StoreContext';
import { INSTRUMENTS } from '@/lib/marketData';
import { formatTime } from '@/lib/format';
import { getHealth } from '@/lib/alphaPilotApi';
import type { PageKey } from './Sidebar';

export function Topbar({ onNavigate, onOpenChat }: { onNavigate: (p: PageKey) => void; onOpenChat: () => void }) {
  const { theme, setTheme } = useStore();
  const [search, setSearch] = useState('');
  const [showResults, setShowResults] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [provider, setProvider] = useState<string>('CHECKING');
  const [apiOnline, setApiOnline] = useState<boolean | null>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    let active = true;
    const check = async () => {
      try {
        const h = await getHealth();
        if (!active) return;
        setProvider(String(h.provider || 'UNKNOWN'));
        setApiOnline(h.ok === true);
      } catch {
        if (!active) return;
        setProvider('OFFLINE');
        setApiOnline(false);
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), 60000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);


  const results = search.length > 0
    ? INSTRUMENTS.filter((i) => i.symbol.toLowerCase().includes(search.toLowerCase()) || i.name.toLowerCase().includes(search.toLowerCase())).slice(0, 6)
    : [];

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 py-3 flex items-center gap-3">
      <div className="md:hidden w-8" />
      <div className="relative flex-1 max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowResults(true); }}
          onFocus={() => setShowResults(true)}
          placeholder="Search instruments..."
          className="w-full pl-9 pr-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {showResults && results.length > 0 && (
          <div className="absolute top-full mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50">
            {results.map((r) => (
              <button
                key={r.symbol}
                onClick={() => { setSearch(''); setShowResults(false); onNavigate('markets'); }}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50 text-left"
              >
                <div>
                  <span className="font-medium text-slate-900 dark:text-white text-sm">{r.symbol}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">{r.name}</span>
                </div>
                <span className="text-xs text-slate-400">{r.exchange}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        <div className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full ${apiOnline === false ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'}`}>
          <Radio size={12} className={apiOnline === null ? 'animate-pulse' : ''} />
          <span className="text-xs font-medium">{provider}</span>
          <span className="text-xs opacity-70">{formatTime(now)}</span>
        </div>
        <button
          onClick={onOpenChat}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
          title="Alpha AI Chat"
        >
          <MessageSquare size={18} />
        </button>
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>
      </div>
    </header>
  );
}

export function ChatPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { chatMessages, addChatMessage, positions, journal, tradingCapital } = useStore();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;
    addChatMessage({ role: 'user', content: input });
    const userMsg = input;
    setInput('');
    setLoading(true);
    // Deterministic local AI response
    const response = generateLocalResponse(userMsg, positions, journal, tradingCapital);
    setTimeout(() => {
      addChatMessage({ role: 'assistant', content: response });
      setLoading(false);
    }, 600);
  };

  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} />}
      <div className={`fixed right-0 top-0 h-screen w-full sm:w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 z-50 flex flex-col transition-transform ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-xs">AI</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">Alpha AI Chat</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">Local analysis engine</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {chatMessages.length === 0 && (
            <div className="text-center text-slate-400 dark:text-slate-500 text-sm py-8">
              <p className="mb-2">Ask me anything about your portfolio, trades, or the market.</p>
              <p className="text-xs">e.g. "Which of my positions carries the highest risk?"</p>
            </div>
          )}
          {chatMessages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300'}`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-sm text-slate-400">
                Analyzing...
              </div>
            </div>
          )}
        </div>
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            placeholder="Ask Alpha AI..."
            className="flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={handleSend} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">Send</button>
        </div>
      </div>
    </>
  );
}

function generateLocalResponse(query: string, positions: any[], journal: any[], tradingCapital: number): string {
  const q = query.toLowerCase();
  if (q.includes('highest risk') || q.includes('riskiest')) {
    if (positions.length === 0) return 'You have no open positions.';
    const risks = positions.map((p) => ({ symbol: p.symbol, risk: p.stopLoss ? Math.abs((p.avgPrice - p.stopLoss) * p.quantity) : 0 }));
    risks.sort((a, b) => b.risk - a.risk);
    return `Your highest risk position is ${risks[0].symbol} with ₹${risks[0].risk.toFixed(0)} at risk (based on your stop loss). Consider reducing position size or tightening your stop.`;
  }
  if (q.includes('overtrading')) {
    const weekAgo = Date.now() - 7 * 86400000;
    const recent = journal.filter((j) => new Date(j.date).getTime() > weekAgo);
    if (recent.length > 10) return `You've made ${recent.length} trades this week. That's above average — consider reducing frequency to avoid overtrading.`;
    return `You've made ${recent.length} trades this week. That's within a reasonable range.`;
  }
  if (q.includes('loss') || q.includes('losing')) {
    const losses = journal.filter((j) => j.pnl < 0).sort((a, b) => a.pnl - b.pnl);
    if (losses.length === 0) return 'You have no losing trades recorded.';
    return `Your biggest losing trade was ${losses[0].instrument} at ₹${losses[0].pnl.toFixed(0)}. Reason: ${losses[0].mistake || 'not specified'}.`;
  }
  if (q.includes('win rate') || q.includes('performance')) {
    const wins = journal.filter((j) => j.pnl > 0);
    const winRate = journal.length > 0 ? (wins.length / journal.length) * 100 : 0;
    return `Your win rate is ${winRate.toFixed(0)}% (${wins.length} wins out of ${journal.length} trades).`;
  }
  if (q.includes('portfolio') || q.includes('summary')) {
    return `You have ${positions.length} open positions with ₹${tradingCapital.toLocaleString('en-IN')} trading capital. Use the Dashboard for a detailed overview.`;
  }
  if (q.includes('nifty')) {
    return `NIFTY is currently trading at ₹24,850.50 (MOCK data). The index is in an uptrend with support at ₹24,400 and resistance at ₹25,100. RSI is neutral. This is analysis, not financial advice.`;
  }
  return `I can help analyze your portfolio, trades, and market instruments. Try asking about your riskiest position, win rate, or overtrading patterns. Note: All market data is MOCK for the MVP.`;
}
