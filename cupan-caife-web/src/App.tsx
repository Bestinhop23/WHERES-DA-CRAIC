import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { LanguageProvider } from './contexts/LanguageContext';
import { CraicCoinsProvider } from './contexts/CraicCoinsContext';
import Home from './pages/Home';
import MapPage from './pages/MapPage';
import ScanPage from './pages/ScanPage';
import ShopPage from './pages/ShopPage';
import TagPage from './pages/TagPage';
import WalletPage from './pages/WalletPage';
import TabBar from './components/TabBar';

export default function App() {
  return (
    <LanguageProvider>
      <CraicCoinsProvider>
        <BrowserRouter>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/scan" element={<ScanPage />} />
                <Route path="/shop/:id" element={<ShopPage />} />
                <Route path="/tag/:shopId" element={<TagPage />} />
                <Route path="/wallet" element={<WalletPage />} />
              </Routes>
            </div>
            <TabBar />
          </div>
        </BrowserRouter>
      </CraicCoinsProvider>
    </LanguageProvider>
  );
}
