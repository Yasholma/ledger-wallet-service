import { ReactNode } from 'react';
import './Layout.css';

type Tab = 'user' | 'balance' | 'fund' | 'transfer' | 'transactions';

interface LayoutProps {
  children: ReactNode;
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

export default function Layout({ children, activeTab, onTabChange }: LayoutProps) {
  const tabs: { id: Tab; label: string }[] = [
    { id: 'user', label: 'Create User' },
    { id: 'balance', label: 'Balance' },
    { id: 'fund', label: 'Fund Wallet' },
    { id: 'transfer', label: 'Transfer' },
    { id: 'transactions', label: 'Transactions' },
  ];

  return (
    <div className="layout">
      <header className="header">
        <h1>Ledger Wallet Service</h1>
        <nav className="nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`nav-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => onTabChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>
      <main className="main">{children}</main>
    </div>
  );
}
