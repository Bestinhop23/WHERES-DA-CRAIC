import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useCraicCoins } from '../contexts/CraicCoinsContext';
import pubsData from '../data/pubs.json';

type Pub = (typeof pubsData)[number];

const STEPS_GA = [
  { icon: '👀', title: 'Aimsigh an Sticker', desc: 'Cuardaigh an sticker NFC ar an gcuntar sa tabhairne.' },
  { icon: '📲', title: 'Tapail do Ghuthan', desc: 'Cuir cul do ghuthain in aice leis an sticker.' },
  { icon: '🪙', title: 'CraicCoins Tuillte', desc: 'Osclaitear an leathanach agus bronntar CraicCoins ort.' },
];

const STEPS_EN = [
  { icon: '👀', title: 'Find the Sticker', desc: 'Look for the NFC sticker on the counter at any participating pub.' },
  { icon: '📲', title: 'Tap Your Phone', desc: 'Hold your phone near the sticker. No app launch needed.' },
  { icon: '🪙', title: 'CraicCoins Earned', desc: 'The page opens automatically and your CraicCoins are awarded.' },
];

export default function ScanPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { balance } = useCraicCoins();
  const [manualCode, setManualCode] = useState('');
  const [showManual, setShowManual] = useState(false);

  const isGA = language === 'ga';
  const steps = isGA ? STEPS_GA : STEPS_EN;

  const handleManualRedeem = () => {
    const code = manualCode.trim();
    if (!code) return;
    navigate('/redeem?pubID=' + encodeURIComponent(code));
  };

  return (
    <div className="app-shell">
      <div className="irish-bar" />

      <div className="hero-card" style={{ textAlign: 'center', marginTop: 10 }}>
        <div className="hero-eyebrow">CraicCoins · NFC</div>
        <div style={{ fontSize: 52, margin: '6px 0 10px' }}>📲</div>
        <h1 style={{ marginBottom: 8 }}>{isGA ? 'Tapail chun Tuilleamh' : 'Tap to Earn'}</h1>
        <p>{isGA ? 'Tapail sticker NFC i dtabhairne rannphairteach.' : 'Tap an NFC sticker in any participating pub.'}</p>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(22,155,98,0.12)', border: '1px solid rgba(22,155,98,0.3)', borderRadius: 20, padding: '6px 16px', marginTop: 8 }}>
          <span style={{ fontSize: 16 }}>🪙</span>
          <span style={{ fontWeight: 800, color: '#169B62' }}>{balance} CraicCoins</span>
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="section-title">{isGA ? 'Conas a Oibrionn Se' : 'How It Works'}</div>
        <div style={{ display: 'grid', gap: 16, marginTop: 8 }}>
          {steps.map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 21, flexShrink: 0, background: 'linear-gradient(135deg, #0f6e41 0%, #2e8c5f 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, boxShadow: '0 2px 8px rgba(15,110,65,0.3)' }}>
                {step.icon}
              </div>
              <div>
                <div style={{ fontWeight: 800, marginBottom: 3, fontSize: '0.95rem' }}>{step.title}</div>
                <div style={{ color: 'var(--muted)', fontSize: '0.82rem', lineHeight: 1.45 }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="section-title">{isGA ? 'Tithe Tabhairne Rannphairteacha' : 'Participating Pubs'}</div>
        <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginBottom: 12 }}>
          {isGA ? 'Tapail NFC in aon tabhairne den liosta seo.' : 'Tap NFC at any of these pubs to earn CraicCoins.'}
        </p>
        <div style={{ display: 'grid', gap: 8 }}>
          {(pubsData as Pub[]).slice(0, 8).map((pub) => (
            <div key={pub.id} style={{ display: 'flex', alignItems: 'center', gap: 12, border: '1px solid var(--line)', borderRadius: 12, padding: '10px 14px', background: 'var(--surface)' }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: 'rgba(123,45,0,0.15)', border: '1px solid rgba(212,114,42,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🍺</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: '0.9rem' }}>{pub.name}</div>
                <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginTop: 1 }}>{pub.address}</div>
              </div>
              <div style={{ background: 'rgba(22,155,98,0.12)', border: '1px solid rgba(22,155,98,0.25)', borderRadius: 8, padding: '3px 8px', fontSize: '0.65rem', fontWeight: 800, color: '#169B62' }}>NFC</div>
            </div>
          ))}
        </div>
        <button className="btn btn-ghost" style={{ width: '100%', marginTop: 12, padding: '10px 0' }} onClick={() => navigate('/map?mode=pubs')}>
          {isGA ? 'Feach ar an learscail' : 'View on map'}
        </button>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <button onClick={() => setShowManual(!showManual)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          <div className="section-title" style={{ margin: 0 }}>{isGA ? 'Ionchodu de Laimh' : 'Manual Entry'}</div>
          <span style={{ color: 'var(--muted)', fontSize: 16 }}>{showManual ? '▲' : '▼'}</span>
        </button>
        {showManual && (
          <div style={{ marginTop: 12 }}>
            <p style={{ color: 'var(--muted)', fontSize: '0.82rem', marginBottom: 10 }}>{isGA ? 'Mura n-oibrionn NFC, cuir isteach cod an tabhairne anseo.' : 'If NFC is not working, enter the pub code here.'}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" value={manualCode} onChange={(e) => setManualCode(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleManualRedeem(); }} placeholder={isGA ? 'Cod tabhairne...' : 'Pub code...'} style={{ flex: 1, border: '1px solid var(--line)', borderRadius: 10, padding: '10px 14px', fontSize: '0.9rem', background: 'var(--bg)', color: 'var(--ink)', outline: 'none' }} />
              <button className="btn" onClick={handleManualRedeem} disabled={!manualCode.trim()} style={{ padding: '10px 20px', borderRadius: 10 }}>→</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ height: 24 }} />
    </div>
  );
}
