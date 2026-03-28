export type PubSummary = {
  pubID: string;
  name: string;
  photo?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  nfcUrl?: string;
  badges: string[];
};

export type PubDetails = PubSummary & {
  discountRules: {
    baseReward?: number;
    cooldownMinutes?: number;
  };
  phrase: {
    ga: string;
    en: string;
    pronunciation: string;
  };
  events: string[];
};

export type WalletRewardEntry = {
  timestamp: string;
  pubID: string;
  pubName: string;
  coinsAwarded: number;
};

export type WalletCheckinEntry = {
  timestamp: string;
  pubID: string;
  pubName: string;
};

export type WalletResponse = {
  userID: string;
  coins: number;
  streak: number;
  history: WalletRewardEntry[];
  checkins: WalletCheckinEntry[];
};

export type RedeemResponse = {
  ok: boolean;
  awarded: number;
  balance: number;
  streak: number;
  message: string;
  pub: {
    pubID: string;
    name: string;
  };
  error?: string;
};
