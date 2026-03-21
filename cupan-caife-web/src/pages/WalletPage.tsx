import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Colors } from '../constants/Colors';
import { useCraicCoins } from '../contexts/CraicCoinsContext';
import { useLanguage } from '../contexts/LanguageContext';

const REDEEM_COST = 100;
const REDEEM_VALUE = '€5';

export default function WalletPage() {
  const { balance, history, addCoins } = useCraicCoins();
  const navigate = useNavigate();
  const { copy } = useLanguage();
  const [redeemed, setRedeemed] = useState(false);

  const canRedeem = balance >= REDEEM_COST;

  const handleRedeem = () => {
    addCoins('redeem', 'Redeemed for ' + REDEEM_VALUE, -REDEEM_COST);
    setRedeemed(true);
    if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
  };

  if (redeemed) {
    // Generate a fake QR-like code pattern using CSS
    const code = `CRAIC-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    return (
      <div style={{ height: '100%', overflow: 'auto', backgroundColor: Colors.background }}>
        <div className="irish-bar" />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 28px', textAlign: 'center' }}>
          <div className="pop" style={{
            width: 90, height: 90, borderRadius: 45,
            backgroundColor: Colors.success + '20', border: `3px solid ${Colors.success}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <span style={{ fontSize: 44 }}>🎉</span>
          </div>

          <h1 style={{ color: Colors.text, fontSize: 24, fontWeight: 800, margin: 0 }}>{REDEEM_VALUE} Off!</h1>
          <p style={{ color: Colors.accent, fontSize: 14, fontStyle: 'italic', marginBottom: 24 }}>Show this to your barista</p>

          {/* Fake QR code */}
          <div style={{
            backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 20,
            width: 220, height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="180" height="180" viewBox="0 0 180 180">
              {/* Generate a fake QR pattern */}
              {Array.from({ length: 15 }, (_, row) =>
                Array.from({ length: 15 }, (_, col) => {
                  // Corner squares (finder patterns)
                  const isCorner = (
                    (row < 3 && col < 3) || (row < 3 && col > 11) || (row > 11 && col < 3)
                  );
                  const isCornerBorder = (
                    (row < 4 && col < 4 && !(row === 1 && col === 1)) ||
                    (row < 4 && col > 10 && !(row === 1 && col === 13)) ||
                    (row > 10 && col < 4 && !(row === 13 && col === 1))
                  );
                  // Random fill for data area
                  const isFilled = isCorner || isCornerBorder ||
                    ((row + col + row * col) % 3 === 0) ||
                    ((row * 7 + col * 13) % 5 === 0);

                  return isFilled ? (
                    <rect
                      key={`${row}-${col}`}
                      x={col * 12}
                      y={row * 12}
                      width="11"
                      height="11"
                      rx="1"
                      fill="#1a5e3c"
                    />
                  ) : null;
                })
              )}
              {/* Center shamrock */}
              <text x="90" y="98" textAnchor="middle" fontSize="28">☘️</text>
            </svg>
          </div>

          <div style={{
            backgroundColor: Colors.surface, borderRadius: 12, padding: '10px 18px',
            border: `1px solid ${Colors.border}`, marginBottom: 20,
          }}>
            <div style={{ color: Colors.textMuted, fontSize: 10, fontWeight: 600, letterSpacing: 1, marginBottom: 4 }}>REDEMPTION CODE</div>
            <div style={{ color: Colors.accent, fontSize: 16, fontWeight: 800, fontFamily: 'monospace', letterSpacing: 2 }}>{code}</div>
          </div>

          <div style={{
            backgroundColor: Colors.primary + '30', borderRadius: 12, padding: '12px 18px',
            border: `1px solid ${Colors.primaryLight}40`, width: '100%', marginBottom: 20,
          }}>
            <div style={{ color: Colors.primaryLight, fontSize: 13, fontWeight: 600 }}>
              ☘️ {REDEEM_VALUE} off any coffee — show this screen to your barista
            </div>
          </div>

          <button
            onClick={() => { setRedeemed(false); }}
            style={{
              backgroundColor: Colors.surface, borderRadius: 14, padding: '12px 28px',
              border: `1px solid ${Colors.border}`, cursor: 'pointer', color: Colors.text, fontSize: 15, fontWeight: 700,
            }}
          >← Back to Wallet</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height: '100%', overflow: 'auto', backgroundColor: Colors.background }}>
      <div className="irish-bar" />

      {/* Header */}
      <div style={{ textAlign: 'center', padding: '28px 24px 0' }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>☘️</div>
        <h1 style={{ color: Colors.text, fontSize: 26, fontWeight: 800, margin: 0 }}>CraicCoins</h1>
        <p style={{ color: Colors.accent, fontSize: 13, fontStyle: 'italic', marginTop: 4 }}>
          {copy.scan.thankYouTranslation || 'Earn coins by ordering as Gaeilge'}
        </p>
      </div>

      {/* Balance card */}
      <div style={{
        margin: '20px 20px 0',
        backgroundImage: `linear-gradient(135deg, ${Colors.primary} 0%, ${Colors.shamrock} 100%)`,
        borderRadius: 20, padding: 24, textAlign: 'center',
        border: `2px solid ${Colors.primaryLight}`,
      }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: Colors.accentLight, letterSpacing: 1, marginBottom: 4 }}>YOUR BALANCE</div>
        <div style={{ fontSize: 52, fontWeight: 900, color: Colors.accent, letterSpacing: 2 }}>{balance}</div>
        <div style={{ fontSize: 14, color: Colors.text, fontWeight: 600, marginTop: 2 }}>CraicCoins</div>

        {/* Progress to next reward */}
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: Colors.accentLight, fontWeight: 600, marginBottom: 6 }}>
            <span>{Math.min(balance, REDEEM_COST)}/{REDEEM_COST}</span>
            <span>{REDEEM_VALUE} off</span>
          </div>
          <div style={{ height: 8, backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              backgroundColor: Colors.accent,
              width: `${Math.min((balance / REDEEM_COST) * 100, 100)}%`,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      </div>

      {/* Redeem button */}
      <div style={{ padding: '16px 20px 0' }}>
        <button
          onClick={canRedeem ? handleRedeem : undefined}
          style={{
            width: '100%',
            backgroundColor: canRedeem ? Colors.accent : Colors.surface,
            borderRadius: 16, padding: '16px 24px',
            border: canRedeem ? 'none' : `1px solid ${Colors.border}`,
            cursor: canRedeem ? 'pointer' : 'default',
            opacity: canRedeem ? 1 : 0.5,
          }}
        >
          <div style={{ color: canRedeem ? Colors.background : Colors.textMuted, fontSize: 17, fontWeight: 800 }}>
            {canRedeem ? `🎉 Redeem ${REDEEM_VALUE} Off!` : `☘️ ${REDEEM_COST - balance} more coins for ${REDEEM_VALUE} off`}
          </div>
          <div style={{ color: canRedeem ? Colors.primary : Colors.textMuted, fontSize: 12, marginTop: 4, fontWeight: 500 }}>
            {canRedeem ? `Use ${REDEEM_COST} CraicCoins` : 'Keep scanning NFC tags!'}
          </div>
        </button>
      </div>

      {/* How to earn */}
      <div style={{ padding: '20px 20px 0' }}>
        <h2 style={{ color: Colors.text, fontSize: 18, fontWeight: 800, margin: '0 0 12px' }}>How to Earn</h2>
        <div style={{
          backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
          border: `1px solid ${Colors.border}`, display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <span style={{ fontSize: 32 }}>📱</span>
          <div>
            <div style={{ color: Colors.text, fontSize: 14, fontWeight: 700 }}>Scan an NFC tag = +20 CraicCoins</div>
            <div style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 4 }}>Order in Irish at any partner café, then scan the tag at the counter</div>
          </div>
        </div>
      </div>

      {/* History */}
      <div style={{ padding: '20px 20px 0' }}>
        <h2 style={{ color: Colors.text, fontSize: 18, fontWeight: 800, margin: '0 0 12px' }}>History</h2>
        {history.length === 0 ? (
          <div style={{
            backgroundColor: Colors.surface, borderRadius: 14, padding: 20,
            border: `1px solid ${Colors.border}`, textAlign: 'center',
          }}>
            <span style={{ fontSize: 32, display: 'block', marginBottom: 8 }}>🏃</span>
            <div style={{ color: Colors.textSecondary, fontSize: 13 }}>No scans yet — go find a café!</div>
            <button
              onClick={() => navigate('/map')}
              style={{
                marginTop: 12, backgroundColor: Colors.primary, borderRadius: 10, padding: '10px 20px',
                border: 'none', cursor: 'pointer', color: Colors.text, fontSize: 13, fontWeight: 700,
              }}
            >🗺️ Find Cafés</button>
          </div>
        ) : (
          history.map((entry, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', backgroundColor: Colors.surface,
              borderRadius: 12, padding: 14, marginBottom: 8, border: `1px solid ${Colors.border}`,
            }}>
              <span style={{
                width: 36, height: 36, borderRadius: 18,
                backgroundColor: entry.coins > 0 ? Colors.success + '20' : Colors.accent + '20',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, marginRight: 12, flexShrink: 0,
              }}>
                {entry.coins > 0 ? '☕' : '🎁'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ color: Colors.text, fontSize: 14, fontWeight: 700 }}>{entry.shopName}</div>
                <div style={{ color: Colors.textMuted, fontSize: 11, marginTop: 2 }}>
                  {new Date(entry.timestamp).toLocaleDateString('en-IE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <span style={{
                color: entry.coins > 0 ? Colors.success : Colors.accent,
                fontSize: 16, fontWeight: 800,
              }}>
                {entry.coins > 0 ? '+' : ''}{entry.coins}
              </span>
            </div>
          ))
        )}
      </div>

      <div style={{ height: 100 }} />
    </div>
  );
}
