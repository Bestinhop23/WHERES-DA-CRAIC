import { useLocation, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useCraicCoins } from '../contexts/CraicCoinsContext';

const TABS = [
  { path: '/map', icon: '🗺️', ga: 'Léarscáil', en: 'Map' },
  { path: '/scan', icon: '📲', ga: 'NFC', en: 'NFC' },
  { path: '/events', icon: '🎭', ga: 'Imeachtaí', en: 'Events' },
  { path: '/wallet', icon: '🪙', ga: 'Sparán', en: 'Wallet' },
];

export default function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { language, setLanguage } = useLanguage();
  const { balance } = useCraicCoins();

  if (location.pathname === '/redeem') return null;

  const isMapActive = location.pathname === '/' || location.pathname.startsWith('/map');

  return (
    <div style={{
      display: 'flex',
      backgroundColor: '#0d1117',
      borderTop: '1px solid #30363d',
      paddingBottom: 'env(safe-area-inset-bottom, 12px)',
      paddingTop: 6,
    }}>
      {TABS.map(tab => {
        const active = tab.path === '/map'
          ? isMapActive
          : location.pathname.startsWith(tab.path);
        const label = language === 'ga' ? tab.ga : tab.en;
        const displayLabel = tab.path === '/wallet' ? `${label} · ${balance}` : label;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '6px 0 10px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: active ? '#169B62' : '#6e7681',
              transition: 'color 0.15s',
            }}
          >
            <span style={{ fontSize: 22 }}>{tab.icon}</span>
            <span style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: 0.4,
              color: active ? '#169B62' : '#6e7681',
            }}>{displayLabel}</span>
          </button>
        );
      })}
      <button
        onClick={() => setLanguage(language === 'ga' ? 'en' : 'ga')}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 3,
          padding: '6px 0 10px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#6e7681',
        }}
      >
        <span style={{ fontSize: 22 }}>{language === 'ga' ? '🇮🇪' : '🇬🇧'}</span>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.4 }}>
          {language === 'ga' ? 'Gaeilge' : 'English'}
        </span>
      </button>
    </div>
  );
}
