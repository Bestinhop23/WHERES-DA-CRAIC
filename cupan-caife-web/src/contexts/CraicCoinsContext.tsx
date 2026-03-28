import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchWallet } from '../lib/api';
import { getOrCreateUserID } from '../lib/user';

type ScanEntry = {
  shopId: string;
  shopName: string;
  coins: number;
  timestamp: number;
};

type CraicCoinsContextType = {
  userID: string;
  balance: number;
  streak: number;
  history: ScanEntry[];
  addCoins: (shopId: string, shopName: string, coins?: number) => void;
  syncWallet: () => Promise<void>;
  resetAll: () => void;
};

const CraicCoinsContext = createContext<CraicCoinsContextType>({
  userID: 'demo-user',
  balance: 0,
  streak: 0,
  history: [],
  addCoins: () => {},
  syncWallet: async () => {},
  resetAll: () => {},
});

const STORAGE_KEY = 'craic-coins';
const USER_KEY = 'craic-user-id';

function loadState(): { balance: number; history: ScanEntry[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { balance: 0, history: [] };
}

export function CraicCoinsProvider({ children }: { children: ReactNode }) {
  const [userID] = useState(() => getOrCreateUserID());
  const [balance, setBalance] = useState<number>(() => loadState().balance);
  const [streak, setStreak] = useState<number>(0);
  const [history, setHistory] = useState<ScanEntry[]>(() => loadState().history);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ balance, history }));
  }, [balance, history]);

  const addCoins = (shopId: string, shopName: string, coins = 20) => {
    setBalance(b => b + coins);
    setHistory(h => [{ shopId, shopName, coins, timestamp: Date.now() }, ...h]);
  };

  const syncWallet = async () => {
    try {
      const wallet = await fetchWallet(userID);
      setBalance(wallet.coins);
      setStreak(wallet.streak);
      setHistory(
        wallet.history.map(entry => ({
          shopId: entry.pubID,
          shopName: entry.pubName,
          coins: entry.coinsAwarded,
          timestamp: new Date(entry.timestamp).getTime(),
        }))
      );
    } catch {
      // Keep local state if API is unavailable.
    }
  };

  useEffect(() => {
    void syncWallet();
    // Only run initial sync once for this user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userID]);

  const resetAll = () => {
    setBalance(0);
    setStreak(0);
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem('craic-visited-places');
    localStorage.removeItem('craic-visited-events');
    window.location.reload();
  };

  const value = useMemo(
    () => ({ userID, balance, streak, history, addCoins, syncWallet, resetAll }),
    [userID, balance, streak, history]
  );

  return (
    <CraicCoinsContext.Provider value={value}>
      {children}
    </CraicCoinsContext.Provider>
  );
}

export const useCraicCoins = () => useContext(CraicCoinsContext);
