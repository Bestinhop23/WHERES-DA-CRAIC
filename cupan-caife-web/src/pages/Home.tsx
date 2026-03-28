import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { fetchPubs } from '../lib/api';
import { useLanguage } from '../contexts/LanguageContext';
import type { PubSummary } from '../types/craic';

const GALWAY_CENTER: [number, number] = [53.274, -9.049];

export default function Home() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [pubs, setPubs] = useState<PubSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPub, setSelectedPub] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchPubs();
        setPubs(data);
      } catch {
        setPubs([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: GALWAY_CENTER,
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    L.control.zoom({ position: 'topright' }).addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    pubs.forEach(pub => {
      if (typeof pub.latitude !== 'number' || typeof pub.longitude !== 'number') return;

      const marker = L.marker([pub.latitude, pub.longitude]).addTo(map);
      marker.on('click', () => {
        setSelectedPub(pub.pubID);
        map.flyTo([pub.latitude as number, pub.longitude as number], 15, { duration: 0.45 });
      });
      markersRef.current.push(marker);
    });
  }, [pubs]);

  const selected = useMemo(
    () => pubs.find(pub => pub.pubID === selectedPub) ?? null,
    [pubs, selectedPub]
  );

  return (
    <div className="app-shell">
      <div className="irish-bar" />
      <div className="hero-card">
        <div className="hero-eyebrow">{language === 'ga' ? 'Where&apos;s The Craic' : 'Where&apos;s The Craic'}</div>
        <h1>{language === 'ga' ? 'Aimsigh tithe tábhairne agus tapáil NFC chun pointí a fháil' : 'Find pubs and tap NFC to earn'}</h1>
        <p>
          {language === 'ga'
            ? 'Coinnigh an léarscáil, an pleanálaí cultúir, imeachtaí agus cleachtadh Gaeilge sa leagan deiridh.'
            : 'Keep the map, culture planner, events, and Irish practice in the final build.'}
        </p>
        <button className="btn" onClick={() => navigate('/wallet')}>
          {language === 'ga' ? 'Oscail Sparan' : 'Open Wallet'}
        </button>
      </div>

      <div className="card">
        <div className="section-title">{language === 'ga' ? 'Uirlisí Croí' : 'Core Tools'}</div>
        <div className="pub-card-badges" style={{ marginTop: 0 }}>
          <button className="btn btn-ghost" onClick={() => navigate('/map')}>{language === 'ga' ? 'Léarscáil' : 'Map'}</button>
          <button className="btn btn-ghost" onClick={() => navigate('/planner')}>{language === 'ga' ? 'Pleanálaí Cultúir' : 'Culture Planner'}</button>
          <button className="btn btn-ghost" onClick={() => navigate('/events')}>{language === 'ga' ? 'Imeachtaí' : 'Events'}</button>
          <button className="btn btn-ghost" onClick={() => navigate('/scan')}>{language === 'ga' ? 'Cleachtadh NFC' : 'NFC Practice'}</button>
        </div>
      </div>

      <div className="nfc-callout">
        <div className="nfc-callout-title">{language === 'ga' ? 'Tapáil NFC chun CraicCoins a thuilleamh' : 'Tap NFC to earn'}</div>
        <div className="nfc-callout-text">
          {language === 'ga'
            ? <>Osclaíonn clibeanna URL mar <code>/redeem?pubID=XYZ123</code>. Tá tú réidh le fuascailt in aon tapáil amháin.</>
            : <>Tags open links like <code>/redeem?pubID=XYZ123</code>. You are ready to redeem in one tap.</>}
        </div>
      </div>

      <div className="map-frame" ref={mapContainerRef} />

      <div className="section-title">{language === 'ga' ? 'Tithe Tábhairne In Aice Leat' : 'Nearby pubs'}</div>
      <div className="pub-list">
        {loading && <div className="card">{language === 'ga' ? 'Ag lódáil tithe tabhairne...' : 'Loading pubs...'}</div>}
        {!loading && pubs.length === 0 && <div className="card">{language === 'ga' ? 'Ni bhfuarthas tithe tabhairne o API.' : 'No pubs found from API.'}</div>}
        {!loading && pubs.map(pub => (
          <button
            key={pub.pubID}
            className={`pub-card ${selectedPub === pub.pubID ? 'pub-card-active' : ''}`}
            onClick={() => {
              setSelectedPub(pub.pubID);
              navigate(`/pub/${pub.pubID}`);
            }}
          >
            <div className="pub-card-title">{pub.name}</div>
            <div className="pub-card-meta">{pub.address ?? (language === 'ga' ? 'Gaillimh' : 'Galway')}</div>
            <div className="pub-card-badges">
              {(pub.badges ?? []).slice(0, 2).map(badge => (
                <span key={badge} className="badge">{badge}</span>
              ))}
            </div>
          </button>
        ))}
      </div>

      {selected && (
        <div className="floating-select">
          <div>
            <div className="floating-title">{selected.name}</div>
            <div className="floating-sub">{selected.address ?? (language === 'ga' ? 'Lar chathair na Gaillimhe' : 'Galway city center')}</div>
          </div>
          <button className="btn btn-secondary" onClick={() => navigate(`/pub/${selected.pubID}`)}>
            {language === 'ga' ? 'Feach tabhairne' : 'View pub'}
          </button>
        </div>
      )}
    </div>
  );
}
