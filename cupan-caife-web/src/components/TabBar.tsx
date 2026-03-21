import { useLocation, useNavigate } from 'react-router-dom';
import { Colors } from '../constants/Colors';
import { useLanguage } from '../contexts/LanguageContext';
import { useCraicCoins } from '../contexts/CraicCoinsContext';

export default function TabBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { copy } = useLanguage();
  const { balance } = useCraicCoins();

  if (location.pathname === '/' || location.pathname.startsWith('/tag/')) return null;

  const tabs = [
    { path: '/map', label: copy.tabs.map, icon: '🗺️' },
    { path: '/scan', label: copy.tabs.scan, icon: '📱' },
    { path: '/wallet', label: `☘️ ${balance}`, icon: '💰' },
  ];

  return (
    <div style={{
      display: 'flex',
      backgroundColor: Colors.surface,
      borderTop: `1px solid ${Colors.border}`,
      paddingBottom: 'env(safe-area-inset-bottom, 16px)',
      paddingTop: 8,
    }}>
      {tabs.map(tab => {
        const active = location.pathname.startsWith(tab.path);
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: '8px 0 12px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: active ? Colors.accent : Colors.textMuted,
            }}
          >
            <span style={{ fontSize: 24 }}>{tab.icon}</span>
            <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
