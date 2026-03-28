import type {
  PubDetails,
  PubSummary,
  RedeemResponse,
  WalletResponse,
} from '../types/craic';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) {
    const message = (data && (data.error as string)) || 'Request failed';
    throw new Error(message);
  }
  return data as T;
}

export async function fetchPubs(): Promise<PubSummary[]> {
  const data = await request<{ pubs: PubSummary[] }>('/api/pubs');
  return data.pubs;
}

export async function fetchPub(pubID: string): Promise<PubDetails> {
  return request<PubDetails>(`/api/pubs/${encodeURIComponent(pubID)}`);
}

export async function redeemPub(userID: string, pubID: string, deviceFingerprint: string): Promise<RedeemResponse> {
  return request<RedeemResponse>('/api/redeem', {
    method: 'POST',
    body: JSON.stringify({ userID, pubID, deviceFingerprint }),
  });
}

export async function fetchWallet(userID: string): Promise<WalletResponse> {
  return request<WalletResponse>(`/api/wallet/${encodeURIComponent(userID)}`);
}

export async function createCheckin(userID: string, pubID: string, note?: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>('/api/checkins', {
    method: 'POST',
    body: JSON.stringify({ userID, pubID, note: note ?? '' }),
  });
}
