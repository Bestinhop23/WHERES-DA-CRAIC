import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Colors } from '../constants/Colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useCraicCoins } from '../contexts/CraicCoinsContext';
import shopsData from '../data/shops.json';

type Shop = (typeof shopsData)[number];
type ScanState = 'idle' | 'selecting' | 'ready' | 'scanning' | 'success' | 'error';

export default function ScanPage() {
  const [state, setState] = useState<ScanState>('idle');
  const [shop, setShop] = useState<Shop | null>(null);
  const navigate = useNavigate();
  const { copy } = useLanguage();
  const { addCoins, balance } = useCraicCoins();
  const [coinsAwarded, setCoinsAwarded] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const nfcSupported = typeof window !== 'undefined' && 'NDEFReader' in (window as any);
  const abortRef = useRef<AbortController | null>(null);

  // Cleanup NFC on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  const handleScan = async () => {
    setState('scanning');

    if (nfcSupported) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const NDEFReader = (window as any).NDEFReader;
        const reader = new NDEFReader();
        abortRef.current = new AbortController();

        await reader.scan({ signal: abortRef.current.signal });

        reader.addEventListener('reading', ({ serialNumber }: { serialNumber: string }) => {
          console.log('NFC tag read:', serialNumber);
          abortRef.current?.abort();
          setState('success');
          // Vibrate on success
          if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
        });

        reader.addEventListener('readingerror', () => {
          abortRef.current?.abort();
          setState('error');
          if (navigator.vibrate) navigator.vibrate([300]);
        });
      } catch (err) {
        console.log('NFC error:', err);
        // User denied or not available — fall back to sim
        setTimeout(() => setState('success'), 2500);
      }
    } else {
      // Simulated scan
      if (navigator.vibrate) navigator.vibrate(50);
      setTimeout(() => {
        if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
        setState('success');
      }, 2500);
    }
  };

  const reset = () => {
    abortRef.current?.abort();
    setState('idle');
    setShop(null);
    setCoinsAwarded(false);
  };

  const page: React.CSSProperties = { height: '100%', overflow: 'auto', backgroundColor: Colors.background };
  const center: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '0 28px', textAlign: 'center' };

  if (state === 'idle') {
    return (
      <div style={page}>
        <div className="irish-bar" />
        <div style={center}>
          <span style={{ fontSize: 56, marginBottom: 12 }}>📱</span>
          <h1 style={{ color: Colors.text, fontSize: 26, fontWeight: 800, margin: 0 }}>{copy.scan.title}</h1>
          <p style={{ color: Colors.accent, fontSize: 14, fontWeight: 600, fontStyle: 'italic', margin: '4px 0 14px' }}>{copy.scan.subtitle}</p>
          <p style={{ color: Colors.textSecondary, fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>{copy.scan.instructions}</p>

          <button
            onClick={() => setState('selecting')}
            style={{
              width: '100%', backgroundColor: Colors.primary, borderRadius: 16, padding: '16px 32px',
              border: `2px solid ${Colors.primaryLight}`, cursor: 'pointer', marginBottom: 28,
            }}
          >
            <div style={{ color: Colors.text, fontSize: 18, fontWeight: 800 }}>☘️ {copy.scan.chooseShop}</div>
            <div style={{ color: Colors.accentLight, fontSize: 12, marginTop: 4, fontWeight: 500 }}>{copy.scan.chooseShopSubtext}</div>
          </button>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {copy.scan.steps.map((step, i) => (
              <div key={step} style={{
                display: 'flex', alignItems: 'center', backgroundColor: Colors.surface,
                borderRadius: 12, padding: 12, border: `1px solid ${Colors.border}`,
              }}>
                <span style={{
                  width: 26, height: 26, borderRadius: 13, backgroundColor: Colors.primary,
                  color: Colors.text, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, marginRight: 12, flexShrink: 0,
                }}>{i + 1}</span>
                <span style={{ color: Colors.textSecondary, fontSize: 13, fontWeight: 500 }}>
                  {step}{i === 3 ? ' 🎉' : ''}
                </span>
              </div>
            ))}
          </div>

          {nfcSupported && (
            <div style={{ marginTop: 16, backgroundColor: Colors.success + '20', borderRadius: 10, padding: '8px 14px', border: `1px solid ${Colors.success}40` }}>
              <span style={{ color: Colors.success, fontSize: 12, fontWeight: 600 }}>✓ NFC supported on this device</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (state === 'selecting') {
    return (
      <div style={page}>
        <div className="irish-bar" />
        <button onClick={reset} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '14px 20px', color: Colors.accent, fontSize: 15, fontWeight: 600 }}>
          ← {copy.scan.back}
        </button>
        <div style={{ padding: '0 16px', overflow: 'auto', height: 'calc(100% - 56px)' }}>
          <h2 style={{ color: Colors.text, fontSize: 22, fontWeight: 800, textAlign: 'center', margin: '0 0 4px' }}>{copy.scan.selectingTitle}</h2>
          <p style={{ color: Colors.accent, fontSize: 13, textAlign: 'center', fontStyle: 'italic', marginBottom: 16 }}>{copy.scan.selectingSubtitle}</p>
          {shopsData.map(shopItem => (
            <button
              key={shopItem.id}
              onClick={() => { setShop(shopItem); setState('ready'); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', backgroundColor: Colors.surface,
                borderRadius: 14, padding: 14, marginBottom: 8, border: `1px solid ${Colors.border}`,
                cursor: 'pointer', textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 26, marginRight: 12 }}>☕</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: Colors.text, fontSize: 15, fontWeight: 700 }}>{shopItem.name}</div>
                <div style={{ color: Colors.textSecondary, fontSize: 11, marginTop: 2 }}>{shopItem.address}</div>
              </div>
              <span style={{ color: Colors.accent, fontSize: 18, fontWeight: 700 }}>→</span>
            </button>
          ))}
          <div style={{ height: 80 }} />
        </div>
      </div>
    );
  }

  if (state === 'ready') {
    return (
      <div style={page}>
        <div className="irish-bar" />
        <div style={center}>
          <div style={{ color: Colors.text, fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{shop?.name}</div>
          <div style={{ color: Colors.textSecondary, fontSize: 13, marginBottom: 28 }}>{shop?.address}</div>

          <div className="pulse" style={{
            width: 130, height: 130, borderRadius: 65,
            backgroundColor: Colors.primary + '20', border: `3px solid ${Colors.primary}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 20, boxShadow: `0 0 30px ${Colors.primary}40`,
          }}>
            <span style={{ fontSize: 44 }}>📱</span>
          </div>

          <h2 style={{ color: Colors.text, fontSize: 22, fontWeight: 800, margin: 0 }}>{copy.scan.readyTitle}</h2>
          <p style={{ color: Colors.accent, fontStyle: 'italic', marginBottom: 24, fontSize: 14 }}>{copy.scan.readySubtitle}</p>

          <button
            onClick={handleScan}
            style={{
              backgroundColor: Colors.accent, borderRadius: 16, padding: '16px 44px',
              border: 'none', cursor: 'pointer', color: Colors.background, fontSize: 17, fontWeight: 800,
              boxShadow: `0 4px 20px ${Colors.accent}40`,
            }}
          >☘️ {copy.scan.scanButton}</button>

          {!nfcSupported && (
            <p style={{ color: Colors.textMuted, fontSize: 11, fontStyle: 'italic', marginTop: 10 }}>{copy.scan.simNote}</p>
          )}
          {nfcSupported && (
            <p style={{ color: Colors.success, fontSize: 11, marginTop: 10, fontWeight: 600 }}>✓ Hold phone to NFC tag when ready</p>
          )}

          <button onClick={reset} style={{ background: 'none', border: 'none', cursor: 'pointer', color: Colors.textSecondary, marginTop: 20, fontSize: 13 }}>
            ← {copy.scan.changeShop}
          </button>
        </div>
      </div>
    );
  }

  if (state === 'scanning') {
    return (
      <div style={page}>
        <div className="irish-bar" />
        <div style={center}>
          <div className="pulse" style={{
            width: 160, height: 160, borderRadius: 80,
            backgroundColor: Colors.accent + '15', border: `3px solid ${Colors.accent}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: 28, boxShadow: `0 0 40px ${Colors.accent}30`,
          }}>
            <span style={{ fontSize: 56 }}>📡</span>
          </div>
          <h2 style={{ color: Colors.text, fontSize: 26, fontWeight: 800, margin: 0 }}>{copy.scan.scanningTitle}</h2>
          <p style={{ color: Colors.textSecondary, marginTop: 8, fontSize: 14 }}>
            {nfcSupported ? copy.scan.scanningSupported : copy.scan.scanningDemo}
          </p>
          {nfcSupported && (
            <p style={{ color: Colors.accent, fontSize: 12, marginTop: 16, fontWeight: 600 }}>
              📱 Waiting for NFC tag...
            </p>
          )}
          <button onClick={reset} style={{ background: 'none', border: 'none', cursor: 'pointer', color: Colors.textMuted, marginTop: 24, fontSize: 13 }}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (state === 'success') {
    // Award coins once
    if (!coinsAwarded && shop) {
      addCoins(shop.id, shop.name, 20);
      setCoinsAwarded(true);
    }

    return (
      <div style={page}>
        <div className="irish-bar" />
        <div style={center}>
          <div className="pop" style={{
            width: 110, height: 110, borderRadius: 55,
            backgroundColor: Colors.success + '20', border: `3px solid ${Colors.success}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <span style={{ fontSize: 52 }}>🎉</span>
          </div>

          <h1 style={{ color: Colors.text, fontSize: 30, fontWeight: 800, margin: 0 }}>+20 CraicCoins!</h1>
          <p style={{ color: Colors.accent, fontStyle: 'italic', marginBottom: 20, fontSize: 14 }}>{shop?.name}</p>

          <div style={{
            backgroundColor: Colors.primary, borderRadius: 20, padding: 22,
            width: '100%', textAlign: 'center', marginBottom: 20,
            border: `2px solid ${Colors.primaryLight}`,
            backgroundImage: `linear-gradient(135deg, ${Colors.primary} 0%, ${Colors.shamrock} 100%)`,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: Colors.accentLight, letterSpacing: 1, marginBottom: 4 }}>YOUR BALANCE</div>
            <div style={{ fontSize: 42, fontWeight: 900, color: Colors.accent, letterSpacing: 2 }}>☘️ {balance}</div>
            <div style={{ fontSize: 13, color: Colors.text, fontWeight: 600, marginTop: 4 }}>CraicCoins</div>
            <div style={{ height: 1, backgroundColor: Colors.primaryLight + '40', margin: '12px 0' }} />
            <div style={{ fontSize: 12, color: Colors.textSecondary, fontStyle: 'italic' }}>
              {balance >= 100 ? '🎉 You can redeem €5 off!' : `${100 - balance} more for €5 off`}
            </div>
          </div>

          <p style={{ color: Colors.text, fontSize: 15, fontWeight: 700 }}>☘️ {copy.scan.thankYou} 🇮🇪</p>
          <p style={{ color: Colors.textSecondary, fontSize: 12, fontStyle: 'italic', marginBottom: 20 }}>{copy.scan.thankYouTranslation}</p>

          <div style={{ display: 'flex', gap: 10, width: '100%' }}>
            <button
              onClick={reset}
              style={{
                flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: '12px 20px',
                border: `1px solid ${Colors.border}`, cursor: 'pointer', color: Colors.text, fontSize: 14, fontWeight: 700,
              }}
            >{copy.scan.reset} ↻</button>
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

  // error
  return (
    <div style={page}>
      <div className="irish-bar" />
      <div style={center}>
        <span style={{ fontSize: 56, marginBottom: 14 }}>😕</span>
        <h2 style={{ color: Colors.text, fontSize: 22, fontWeight: 800, margin: 0 }}>{copy.scan.errorTitle}</h2>
        <p style={{ color: Colors.accent, fontStyle: 'italic', marginBottom: 14 }}>{copy.scan.errorSubtitle}</p>
        <p style={{ color: Colors.textSecondary, fontSize: 14, lineHeight: 1.5, marginBottom: 20 }}>{copy.scan.errorMessage}</p>
        <button
          onClick={() => setState('ready')}
          style={{
            backgroundColor: Colors.primary, borderRadius: 14, padding: '14px 28px',
            border: 'none', cursor: 'pointer', color: Colors.text, fontSize: 15, fontWeight: 700,
          }}
        >{copy.scan.retry}</button>
      </div>
    </div>
  );
}
