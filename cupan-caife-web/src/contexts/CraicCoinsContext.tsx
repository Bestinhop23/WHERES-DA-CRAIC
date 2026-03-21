import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

type ScanEntry = {
  shopId: string;
  shopName: string;
  coins: number;
  timestamp: number;
};

type CraicCoinsContextType = {
  balance: number;
  history: ScanEntry[];
  addCoins: (shopId: string, shopName: string, coins?: number) => void;
  resetAll: () => void;
};

const CraicCoinsContext = createContext<CraicCoinsContextType>({
  balance: 0,
  history: [],
  addCoins: () => {},
  resetAll: () => {},
});

const STORAGE_KEY = 'craic-coins';

function loadState(): { balance: number; history: ScanEntry[] } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { balance: 0, history: [] };
}

export function CraicCoinsProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState(() => loadState().balance);
  const [history, setHistory] = useState<ScanEntry[]>(() => loadState().history);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ balance, history }));
  }, [balance, history]);

  const addCoins = (shopId: string, shopName: string, coins = 20) => {
    setBalance(b => b + coins);
    setHistory(h => [{ shopId, shopName, coins, timestamp: Date.now() }, ...h]);
  };

  const resetAll = () => {
    setBalance(0);
    setHistory([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem('craic-visited-places');
    localStorage.removeItem('craic-visited-events');
  };

  return (
    <CraicCoinsContext.Provider value={{ balance, history, addCoins, resetAll }}>
      {children}
    </CraicCoinsContext.Provider>
  );
}

export const useCraicCoins = () => useContext(CraicCoinsContext);
