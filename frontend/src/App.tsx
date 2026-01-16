import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import UserForm from './components/UserForm';
import Balance from './components/Balance';
import FundWallet from './components/FundWallet';
import Transfer from './components/Transfer';
import TransactionList from './components/TransactionList';
import { sessionStorage } from './utils/sessionStorage';

type Tab = 'user' | 'balance' | 'fund' | 'transfer' | 'transactions';

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('user');
  const [userId, setUserId] = useState<string>('');
  const [walletId, setWalletId] = useState<string>('');
  const [email, setEmail] = useState<string>('');

  useEffect(() => {
    const storedWalletId = sessionStorage.getWalletId();
    if (storedWalletId) {
      setWalletId(storedWalletId);
    }
  }, []);

  const handleUserCreated = (newUserId: string, newWalletId: string) => {
    setUserId(newUserId);
    setWalletId(newWalletId);
    sessionStorage.setWalletId(newWalletId);
    setActiveTab('balance');
  };

  const handleBalanceFound = (foundWalletId: string, foundUserId: string, foundEmail?: string) => {
    setWalletId(foundWalletId);
    setUserId(foundUserId);
    sessionStorage.setWalletId(foundWalletId);
    if (foundEmail) {
      setEmail(foundEmail);
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {activeTab === 'user' && <UserForm onUserCreated={handleUserCreated} />}
      {activeTab === 'balance' && (
        <Balance
          userId={userId}
          email={email}
          onBalanceFound={handleBalanceFound}
        />
      )}
      {activeTab === 'fund' && <FundWallet walletId={walletId} />}
      {activeTab === 'transfer' && <Transfer senderWalletId={walletId} />}
      {activeTab === 'transactions' && <TransactionList walletId={walletId} />}
    </Layout>
  );
}

export default App;
