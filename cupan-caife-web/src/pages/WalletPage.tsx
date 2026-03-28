import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchWallet } from '../lib/api';
import { useCraicCoins } from '../contexts/CraicCoinsContext';
import { useLanguage } from '../contexts/LanguageContext';
import type { WalletCheckinEntry, WalletRewardEntry } from '../types/craic';

export default function WalletPage() {
  const navigate = useNavigate();
  const { userID, balance, streak, syncWallet } = useCraicCoins();
  const { language } = useLanguage();
  const [history, setHistory] = useState<WalletRewardEntry[]>([]);
  const [checkins, setCheckins] = useState<WalletCheckinEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const wallet = await fetchWallet(userID);
        setHistory(wallet.history);
        setCheckins(wallet.checkins);
      } catch {
        setHistory([]);
        setCheckins([]);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [userID]);

  const isGA = language === 'ga';
  const toNextReward = Math.max(0, 100 - balance);

  return (
    <div className="app-shell">
      <div className="irish-bar" />
      <div className="hero-card" style={{ marginTop: 10, textAlign: 'center' }}>
        <div className="hero-eyebrow">{isGA ? 'Sparán CraicCoins' : 'CraicCoins Wallet'}</div>
        <div style={{ fontSize: 48, margin: '6px 0 8px' }}>🪙</div>
        <h1 style={{ fontSize: '2.4rem', marginBottom: 4 }}>{balance}</h1>
        <p style={{ marginBottom: 8, fontSize: '0.9rem' }}>CraicCoins</p>

        {/* Progress bar to next reward */}
        <div style={{ margin: '8px 0 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 5 }}>
            <span>{isGA ? 'Chun an chéad duaise eile' : 'To next reward'}</span>
            <span>{balance}/100</span>
          </div>
          <div style={{ height: 8, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${Math.min(100, balance)}%`,
              background: 'linear-gradient(90deg, #169B62 0%, #2ea043 100%)',
              borderRadius: 4, transition: 'width 0.4s ease',
            }} />
          </div>
          {balance >= 100 && (
            <p style={{ color: '#169B62', fontSize: '0.78rem', fontWeight: 800, marginTop: 6 }}>
              🎉 {isGA ? 'Is féidir leat €5 a fhuascailt!' : 'You can redeem €5 off!'}
            </p>
          )}
          {toNextReward > 0 && (
            <p style={{ color: 'var(--muted)', fontSize: '0.72rem', marginTop: 4 }}>
              {toNextReward} {isGA ? 'CraicCoin eile le haghaidh €5 de mhéid!' : 'more CraicCoins for €5 off!'}
            </p>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" style={{ flex: 1 }} onClick={() => void syncWallet()}>
            {isGA ? 'Athnuaigh' : 'Refresh'} ↻
          </button>
          <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => navigate('/')}>
            {isGA ? 'Aimsigh tábhairne' : 'Find a pub'} 🗺️
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 10 }}>
        <div className="section-title">
          {isGA ? '🔥 Sraith' : '🔥 Streak'}: {streak} {isGA ? `lá` : `day${streak === 1 ? '' : 's'}`}
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '0.82rem' }}>
          {isGA
            ? 'Buail isteach i dtábhairne gach lá chun do shraith a choinneáil!'
            : 'Check into a pub every day to keep your streak going!'}
        </p>
      </div>

      <div className="card" style={{ marginBottom: 10 }}>
        <div className="section-title">{isGA ? '📜 Stair Duaise' : '📜 Reward History'}</div>
        {loading && <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>{isGA ? 'Á luchtú...' : 'Loading...'}</p>}
        {!loading && history.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            {isGA
              ? 'Gan duaiseanna fós. Tapáil NFC i dtábhairne chun tosú.'
              : 'No rewards yet. Tap NFC in a pub to start earning.'}
          </p>
        )}
        {!loading && history.length > 0 && (
          <ul className="plain-list">
            {history.slice(0, 20).map(item => (
              <li key={`${item.pubID}-${item.timestamp}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><strong style={{ color: '#169B62' }}>+{item.coinsAwarded}</strong> {isGA ? 'ag' : 'at'} {item.pubName}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{new Date(item.timestamp).toLocaleDateString('en-IE')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card" style={{ marginBottom: 10 }}>
        <div className="section-title">{isGA ? '📍 Seiceálacha Isteach' : '📍 Check-ins'}</div>
        {!loading && checkins.length === 0 && (
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            {isGA ? 'Gan seiceáil isteach fós.' : 'No check-ins yet.'}
          </p>
        )}
        {!loading && checkins.length > 0 && (
          <ul className="plain-list">
            {checkins.slice(0, 20).map(item => (
              <li key={`${item.pubID}-${item.timestamp}`} style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.pubName}</span>
                <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>{new Date(item.timestamp).toLocaleDateString('en-IE')}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
