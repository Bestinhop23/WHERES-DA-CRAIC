import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Colors } from '../constants/Colors';
import { useCraicCoins } from '../contexts/CraicCoinsContext';
import { useLanguage } from '../contexts/LanguageContext';
import shopsData from '../data/shops.json';

export default function TagPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const navigate = useNavigate();
  const { addCoins, balance } = useCraicCoins();
  const { copy } = useLanguage();
  const [awarded, setAwarded] = useState(false);

  const shop = shopsData.find(s => s.id === shopId || s.nfcTagId === shopId);

  useEffect(() => {
    if (shop && !awarded) {
      // Small delay for dramatic effect
      const t = setTimeout(() => {
        addCoins(shop.id, shop.name, 20);
        setAwarded(true);
        if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [shop, awarded, addCoins]);

  if (!shop) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: Colors.background }}>
        <div className="irish-bar" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 28, textAlign: 'center' }}>
          <span style={{ fontSize: 56, marginBottom: 12 }}>😕</span>
          <h1 style={{ color: Colors.text, fontSize: 24, fontWeight: 800, margin: 0 }}>Invalid Tag</h1>
          <p style={{ color: Colors.textSecondary, fontSize: 14, marginTop: 8 }}>This NFC tag doesn't match any shop.</p>
          <button
            onClick={() => navigate('/map')}
            style={{
              marginTop: 24, backgroundColor: Colors.primary, borderRadius: 14, padding: '14px 28px',
              border: 'none', cursor: 'pointer', color: Colors.text, fontSize: 15, fontWeight: 700,
            }}
          >{copy.tabs.map} →</button>
        </div>
      </div>
    );
  }

  if (!awarded) {
    return (
      <div style={{ height: '100%', display: 'flex', flexDirection: 'column', backgroundColor: Colors.background }}>
        <div className="irish-bar" />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div className="pulse" style={{
            width: 130, height: 130, borderRadius: 65,
            backgroundColor: Colors.accent + '20', border: `3px solid ${Colors.accent}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20, boxShadow: `0 0 40px ${Colors.accent}30`,
          }}>
            <span style={{ fontSize: 48 }}>☘️</span>
          </div>
          <h2 style={{ color: Colors.text, fontSize: 22, fontWeight: 800 }}>Verifying tag...</h2>
          <p style={{ color: Colors.textSecondary, fontSize: 14, marginTop: 8 }}>{shop.name}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', backgroundColor: Colors.background }}>
      <div className="irish-bar" />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 'calc(100% - 4px)', padding: '0 28px', textAlign: 'center' }}>
        <div className="pop" style={{
          width: 110, height: 110, borderRadius: 55,
          backgroundColor: Colors.success + '20', border: `3px solid ${Colors.success}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        }}>
          <span style={{ fontSize: 52 }}>🎉</span>
        </div>

        <h1 style={{ color: Colors.text, fontSize: 28, fontWeight: 800, margin: 0 }}>+20 CraicCoins!</h1>
        <p style={{ color: Colors.accent, fontStyle: 'italic', marginBottom: 20, fontSize: 14 }}>{shop.name}</p>

        <div style={{
          backgroundColor: Colors.primary, borderRadius: 20, padding: 22,
          width: '100%', textAlign: 'center', marginBottom: 20,
          border: `2px solid ${Colors.primaryLight}`,
          backgroundImage: `linear-gradient(135deg, ${Colors.primary} 0%, ${Colors.shamrock} 100%)`,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: Colors.accentLight, marginBottom: 4 }}>YOUR BALANCE</div>
          <div style={{ fontSize: 42, fontWeight: 900, color: Colors.accent, letterSpacing: 2 }}>☘️ {balance}</div>
          <div style={{ fontSize: 13, color: Colors.textSecondary, marginTop: 4 }}>CraicCoins</div>
        </div>

        <p style={{ color: Colors.text, fontSize: 15, fontWeight: 700 }}>☘️ {copy.scan.thankYou} 🇮🇪</p>
        <p style={{ color: Colors.textSecondary, fontSize: 12, fontStyle: 'italic', marginBottom: 20 }}>{copy.scan.thankYouTranslation}</p>

        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
          <button
            onClick={() => navigate('/map')}
            style={{
              flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: '12px 20px',
              border: `1px solid ${Colors.border}`, cursor: 'pointer', color: Colors.text, fontSize: 14, fontWeight: 700,
            }}
          >🗺️ {copy.tabs.map}</button>
          <button
            onClick={() => navigate('/wallet')}
            style={{
              flex: 1, backgroundColor: Colors.accent, borderRadius: 14, padding: '12px 20px',
              border: 'none', cursor: 'pointer', color: Colors.background, fontSize: 14, fontWeight: 700,
            }}
          >☘️ Wallet</button>
        </div>
      </div>
    </div>
  );
}
