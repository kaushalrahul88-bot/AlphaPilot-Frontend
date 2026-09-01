import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import type { Position, JournalEntry, Watchlist, Alert, RiskLimits, ChatMessage, ScannerFilters } from '@/lib/types';
import { loadState, saveState, DEFAULT_RISK_LIMITS, DEFAULT_SCANNER_FILTERS } from '@/lib/storage';
import { seedPositions, seedJournal, seedWatchlists } from '@/lib/seedData';
import { genId } from '@/lib/format';

interface Store {
  positions: Position[];
  journal: JournalEntry[];
  watchlists: Watchlist[];
  alerts: Alert[];
  riskLimits: RiskLimits;
  tradingCapital: number;
  theme: 'dark' | 'light';
  scannerFilters: ScannerFilters;
  chatMessages: ChatMessage[];
  // Actions
  addPosition: (pos: Omit<Position, 'id'>) => void;
  updatePosition: (id: string, pos: Partial<Position>) => void;
  removePosition: (id: string) => void;
  addJournalEntry: (entry: Omit<JournalEntry, 'id'>) => void;
  updateJournalEntry: (id: string, entry: Partial<JournalEntry>) => void;
  removeJournalEntry: (id: string) => void;
  addWatchlist: (name: string) => void;
  removeWatchlist: (id: string) => void;
  addToWatchlist: (id: string, symbol: string) => void;
  removeFromWatchlist: (id: string, symbol: string) => void;
  addAlert: (alert: Omit<Alert, 'id' | 'createdAt' | 'triggered'>) => void;
  removeAlert: (id: string) => void;
  toggleAlert: (id: string) => void;
  updateRiskLimits: (limits: Partial<RiskLimits>) => void;
  setTradingCapital: (cap: number) => void;
  setTheme: (theme: 'dark' | 'light') => void;
  setScannerFilters: (filters: Partial<ScannerFilters>) => void;
  addChatMessage: (msg: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
  clearChat: () => void;
}

const StoreContext = createContext<Store | null>(null);

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const initial = loadState();
  const [positions, setPositions] = useState<Position[]>(initial.positions.length > 0 ? initial.positions : seedPositions());
  const [journal, setJournal] = useState<JournalEntry[]>(initial.journal.length > 0 ? initial.journal : seedJournal());
  const [watchlists, setWatchlists] = useState<Watchlist[]>(initial.watchlists.length > 0 ? initial.watchlists : seedWatchlists());
  const [alerts, setAlerts] = useState<Alert[]>(initial.alerts);
  const [riskLimits, setRiskLimitsState] = useState<RiskLimits>(initial.riskLimits);
  const [tradingCapital, setTradingCapitalState] = useState<number>(initial.tradingCapital);
  const [theme, setThemeState] = useState<'dark' | 'light'>(initial.theme);
  const [scannerFilters, setScannerFiltersState] = useState<ScannerFilters>(DEFAULT_SCANNER_FILTERS);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  useEffect(() => { saveState({ positions }); }, [positions]);
  useEffect(() => { saveState({ journal }); }, [journal]);
  useEffect(() => { saveState({ watchlists }); }, [watchlists]);
  useEffect(() => { saveState({ alerts }); }, [alerts]);
  useEffect(() => { saveState({ riskLimits }); }, [riskLimits]);
  useEffect(() => { saveState({ tradingCapital }); }, [tradingCapital]);
  useEffect(() => { saveState({ theme }); }, [theme]);

  useEffect(() => {
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [theme]);

  const addPosition = useCallback((pos: Omit<Position, 'id'>) => {
    setPositions((prev) => [...prev, { ...pos, id: genId() }]);
  }, []);

  const updatePosition = useCallback((id: string, pos: Partial<Position>) => {
    setPositions((prev) => prev.map((p) => (p.id === id ? { ...p, ...pos } : p)));
  }, []);

  const removePosition = useCallback((id: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const addJournalEntry = useCallback((entry: Omit<JournalEntry, 'id'>) => {
    setJournal((prev) => [...prev, { ...entry, id: genId() }]);
  }, []);

  const updateJournalEntry = useCallback((id: string, entry: Partial<JournalEntry>) => {
    setJournal((prev) => prev.map((j) => (j.id === id ? { ...j, ...entry } : j)));
  }, []);

  const removeJournalEntry = useCallback((id: string) => {
    setJournal((prev) => prev.filter((j) => j.id !== id));
  }, []);

  const addWatchlist = useCallback((name: string) => {
    setWatchlists((prev) => [...prev, { id: genId(), name, symbols: [] }]);
  }, []);

  const removeWatchlist = useCallback((id: string) => {
    setWatchlists((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const addToWatchlist = useCallback((id: string, symbol: string) => {
    setWatchlists((prev) => prev.map((w) => (w.id === id && !w.symbols.includes(symbol) ? { ...w, symbols: [...w.symbols, symbol] } : w)));
  }, []);

  const removeFromWatchlist = useCallback((id: string, symbol: string) => {
    setWatchlists((prev) => prev.map((w) => (w.id === id ? { ...w, symbols: w.symbols.filter((s) => s !== symbol) } : w)));
  }, []);

  const addAlert = useCallback((alert: Omit<Alert, 'id' | 'createdAt' | 'triggered'>) => {
    setAlerts((prev) => [...prev, { ...alert, id: genId(), createdAt: new Date().toISOString(), triggered: false }]);
  }, []);

  const removeAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const toggleAlert = useCallback((id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, active: !a.active } : a)));
  }, []);

  const updateRiskLimits = useCallback((limits: Partial<RiskLimits>) => {
    setRiskLimitsState((prev) => ({ ...prev, ...limits }));
  }, []);

  const setTradingCapital = useCallback((cap: number) => {
    setTradingCapitalState(cap);
  }, []);

  const setTheme = useCallback((t: 'dark' | 'light') => {
    setThemeState(t);
  }, []);

  const setScannerFilters = useCallback((filters: Partial<ScannerFilters>) => {
    setScannerFiltersState((prev) => ({ ...prev, ...filters }));
  }, []);

  const addChatMessage = useCallback((msg: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    setChatMessages((prev) => [...prev, { ...msg, id: genId(), timestamp: Date.now() }]);
  }, []);

  const clearChat = useCallback(() => {
    setChatMessages([]);
  }, []);

  const store: Store = {
    positions, journal, watchlists, alerts, riskLimits, tradingCapital, theme, scannerFilters, chatMessages,
    addPosition, updatePosition, removePosition,
    addJournalEntry, updateJournalEntry, removeJournalEntry,
    addWatchlist, removeWatchlist, addToWatchlist, removeFromWatchlist,
    addAlert, removeAlert, toggleAlert,
    updateRiskLimits, setTradingCapital, setTheme, setScannerFilters,
    addChatMessage, clearChat,
  };

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
