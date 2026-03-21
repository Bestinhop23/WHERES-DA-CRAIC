import { useNavigate } from 'react-router-dom';
import { Colors } from '../constants/Colors';
import { useLanguage } from '../contexts/LanguageContext';

export default function Home() {
  const navigate = useNavigate();
  const { setLanguage } = useLanguage();

  const handleSelect = (lang: 'ga' | 'en') => {
    setLanguage(lang);
    navigate('/map');
  };

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: Colors.background,
      overflow: 'hidden',
    }}>
      {/* Irish tricolour bar */}
      <div className="irish-bar" />

      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '32px 24px 28px',
      }}>
        {/* Hero */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 56, marginBottom: 8 }}>☘️</div>
          <div style={{ color: Colors.accent, fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8 }}>
            Fáilte · Welcome
          </div>
          <h1 style={{ color: Colors.text, fontSize: 34, fontWeight: 800, lineHeight: 1.15, margin: '0 0 12px' }}>
            Cupán Caife
          </h1>
          <p style={{ color: Colors.textSecondary, fontSize: 15, lineHeight: 1.6, maxWidth: 300, margin: '0 auto' }}>
            Ordaigh as Gaeilge, faigh lascaine 20%.
          </p>
          <p style={{ color: Colors.textMuted, fontSize: 13, lineHeight: 1.5, marginTop: 6 }}>
            Order in Irish, get 20% off.
          </p>
        </div>

        {/* Language selector */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ color: Colors.textMuted, fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', textAlign: 'center' }}>
            Roghnaigh teanga · Choose language
          </div>
          <button
            onClick={() => handleSelect('ga')}
            style={{
              backgroundColor: Colors.primary,
              borderRadius: 20,
              padding: '22px 24px',
              border: `2px solid ${Colors.primaryLight}`,
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <span style={{ fontSize: 36 }}>🇮🇪</span>
            <div>
              <div style={{ color: Colors.text, fontSize: 22, fontWeight: 800 }}>Gaeilge</div>
              <div style={{ color: Colors.accentLight, fontSize: 13, marginTop: 4 }}>Taithí iomlán trí Ghaeilge</div>
            </div>
          </button>

          <button
            onClick={() => handleSelect('en')}
            style={{
              backgroundColor: Colors.surface,
              borderRadius: 20,
              padding: '22px 24px',
              border: `1px solid ${Colors.border}`,
              cursor: 'pointer',
              textAlign: 'left',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}
          >
            <span style={{ fontSize: 36 }}>🇬🇧</span>
            <div>
              <div style={{ color: Colors.text, fontSize: 22, fontWeight: 800 }}>English</div>
              <div style={{ color: Colors.accentLight, fontSize: 13, marginTop: 4 }}>Use the app in English</div>
            </div>
          </button>
        </div>

        {/* Bottom previews */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{
            flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
            border: `1px solid ${Colors.border}`, textAlign: 'center',
          }}>
            <span style={{ fontSize: 28, display: 'block', marginBottom: 6 }}>🗺️</span>
            <span style={{ color: Colors.textSecondary, fontSize: 12, fontWeight: 600 }}>15 cafés i mBÁC</span>
          </div>
          <div style={{
            flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
            border: `1px solid ${Colors.border}`, textAlign: 'center',
          }}>
            <span style={{ fontSize: 28, display: 'block', marginBottom: 6 }}>📱</span>
            <span style={{ color: Colors.textSecondary, fontSize: 12, fontWeight: 600 }}>Scan NFC · 20% off</span>
          </div>
          <div style={{
            flex: 1, backgroundColor: Colors.surface, borderRadius: 14, padding: 16,
            border: `1px solid ${Colors.border}`, textAlign: 'center',
          }}>
            <span style={{ fontSize: 28, display: 'block', marginBottom: 6 }}>🗣️</span>
            <span style={{ color: Colors.textSecondary, fontSize: 12, fontWeight: 600 }}>Frásaí Gaeilge</span>
          </div>
        </div>
      </div>

      {/* Bottom tricolour bar */}
      <div className="irish-bar" />
    </div>
  );
}
