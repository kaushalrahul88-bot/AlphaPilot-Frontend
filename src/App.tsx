import { useState } from 'react';
import { StoreProvider } from '@/store/StoreContext';
import { Sidebar, type PageKey } from '@/components/Sidebar';
import { Topbar, ChatPanel } from '@/components/Topbar';
import { Dashboard } from '@/pages/Dashboard';
import { Portfolio } from '@/pages/Portfolio';
import { Options } from '@/pages/Options';
import { PositionSizing } from '@/pages/PositionSizing';
import { TradeScannerWithGift } from '@/pages/TradeScannerWithGift';
import { Backtest } from '@/pages/Backtest';
import { TradeSetup } from '@/pages/TradeSetup';
import { Journal } from '@/pages/Journal';
import { RiskCenter } from '@/pages/RiskCenter';
import { AIAnalyst } from '@/pages/AIAnalyst';
import { News } from '@/pages/News';
import { Markets } from '@/pages/Markets';
import { Alerts } from '@/pages/Alerts';
import { Settings } from '@/pages/Settings';

function AppContent() {
  const [page, setPage] = useState<PageKey>('dashboard');
  const [chatOpen, setChatOpen] = useState(false);

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <Dashboard onNavigate={setPage} />;
      case 'markets': return <Markets />;
      case 'portfolio': return <Portfolio />;
      case 'options': return <Options />;
      case 'ai-analyst': return <AIAnalyst />;
      case 'trade-scanner': return <TradeScannerWithGift onNavigate={setPage} />;
      case 'backtest': return <Backtest />;
      case 'trade-setup': return <TradeSetup />;
      case 'position-sizing': return <PositionSizing />;
      case 'journal': return <Journal />;
      case 'risk': return <RiskCenter />;
      case 'news': return <News />;
      case 'alerts': return <Alerts />;
      case 'settings': return <Settings />;
      default: return <Dashboard onNavigate={setPage} />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      <Sidebar page={page} onNavigate={setPage} />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar onNavigate={setPage} onOpenChat={() => setChatOpen(true)} />
        <main className="flex-1 p-4 md:p-6 overflow-x-hidden">{renderPage()}</main>
      </div>
      <ChatPanel open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
}

export default function App() {
  return <StoreProvider><AppContent /></StoreProvider>;
}
