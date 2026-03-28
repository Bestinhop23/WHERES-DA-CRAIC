import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import CoinBurst from '../components/CoinBurst';
import { redeemPub } from '../lib/api';
import { getDeviceFingerprint } from '../lib/user';
import { useCraicCoins } from '../contexts/CraicCoinsContext';
import { useLanguage } from '../contexts/LanguageContext';

type RedeemStatus = 'loading' | 'success' | 'error';

export default function RedeemPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { userID, syncWallet } = useCraicCoins();
  const { language } = useLanguage();
  const [status, setStatus] = useState<RedeemStatus>('loading');
  const [message, setMessage] = useState('Processing tap...');
  const [awarded, setAwarded] = useState(0);
  const [balance, setBalance] = useState(0);
  const pubID = params.get('pubID');

  useEffect(() => {
    if (!pubID) {
      setStatus('error');
      setMessage('Missing pubID in URL.');
      return;
    }

    const run = async () => {
      try {
        const response = await redeemPub(userID, pubID, getDeviceFingerprint());
        setStatus('success');
        setMessage(response.message || 'CraicCoins awarded');
        setAwarded(response.awarded);
        setBalance(response.balance);
        await syncWallet();
      } catch (error) {
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Redeem failed');
      }
    };

    void run();
  }, [pubID, syncWallet, userID]);

  const isGA = language === 'ga';

  return (
    <div className="app-shell redeem-shell">
      <div className="irish-bar" />
      <CoinBurst open={status === 'success'} coins={awarded} label={isGA ? 'Deimhnithe: duais NFC' : 'NFC reward confirmed'} />

      <div className="hero-card" style={{ textAlign: 'center', marginTop: 10 }}>
        <div className="hero-eyebrow">
          {status === 'loading' ? 'NFC · CraicCoins' : status === 'success' ? 'Duais Faighte' : 'Earraidh'}
        </div>
        <div style={{ fontSize: 52, margin: '8px 0 10px' }}>
          {status === 'loading' ? '⌛' : status === 'success' ? '🪙' : '😕'}
        </div>
        <h1 style={{ fontSize: '1.7rem', marginBottom: 6 }}>
          {status === 'loading'
            ? (isGA ? 'Do thapáil á bailíochtú...' : 'Validating your tap...')
            : status === 'success'
              ? (isGA ? "D'éirigh leis an tapáil!" : 'Tap Successful!')
              : (isGA ? 'Níorbh fhéidir fuascailt' : 'Could not redeem')}
        </h1>
        <p style={{ color: 'var(--muted)' }}>{message}</p>
      </div>

      {status === 'success' && (
        <div className="card">
          <div className="section-title">{isGA ? 'Duais Faighte' : 'Reward Received'}</div>
          <div style={{ textAlign: 'center', padding: '12px 0 8px', fontSize: '2.8rem', fontWeight: 900, color: '#169B62' }}>
            +{awarded}
          </div>
          <p style={{ textAlign: 'center', color: 'var(--muted)', marginBottom: 12 }}>
            {isGA ? 'Iarmhéid nua: ' : 'New balance: '}
            <strong style={{ color: 'var(--ink)' }}>{balance} CraicCoins</strong>
          </p>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', color: 'var(--muted)', marginBottom: 4 }}>
              <span>{isGA ? 'Chun EUR5 de mhéid' : 'To EUR5 discount'}</span>
              <span>{balance}/100</span>
            </div>
            <div style={{ height: 8, background: 'var(--line)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, balance)}%`, background: 'linear-gradient(90deg, #169B62, #2ea043)', borderRadius: 4 }} />
            </div>
          </div>
          <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={() => navigate('/wallet')}>
            {isGA ? 'Feach ar mo sparan' : 'View my wallet'}
          </button>
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => navigator.share?.({ text: isGA ? "Thuill me CraicCoins ag Where's The Craic!" : "I just earned CraicCoins at Where's The Craic!" })}>
            {isGA ? 'Comhroinn' : 'Share'}
          </button>
        </div>
      )}

      {status === 'error' && (
        <div className="card">
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginBottom: 12 }}>
            {isGA
              ? "Theip ar an tapáil NFC. B'fhéidir gur tapáladh tú cheana inniu."
              : 'The NFC tap failed. You may have already tapped today.'}
          </p>
          <button className="btn" style={{ width: '100%', marginBottom: 8 }} onClick={() => navigate('/')}>
            {isGA ? 'Ar ais chuig léarscáil' : 'Back to map'}
          </button>
          <button className="btn btn-ghost" style={{ width: '100%' }} onClick={() => navigate('/scan')}>
            {isGA ? 'Cabhair NFC' : 'NFC help'}
          </button>
        </div>
      )}
    </div>
  );
}
