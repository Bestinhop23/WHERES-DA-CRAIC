import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { Colors } from '../constants/Colors';
import { useLanguage } from '../contexts/LanguageContext';
import shopsData from '../data/shops.json';

type Shop = (typeof shopsData)[number];

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const navigate = useNavigate();
  const { copy } = useLanguage();

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    const map = L.map(mapContainer.current, {
      center: [53.3438, -6.2588],
      zoom: 14,
      zoomControl: false,
      attributionControl: true,
      // Smoother on mobile
      fadeAnimation: true,
      zoomAnimation: true,
      markerZoomAnimation: true,
      inertia: true,
      inertiaDeceleration: 3000,
      maxBoundsViscosity: 1.0,
    });

    // Zoom control top-right
    L.control.zoom({ position: 'topright' }).addTo(map);

    // Dark OSM tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://openstreetmap.org">OSM</a>',
      // Faster tile loading
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 4,
    }).addTo(map);

    // Custom shamrock marker
    const coffeeIcon = L.divIcon({
      html: `<div style="
        background: ${Colors.primary};
        border: 2px solid ${Colors.accent};
        border-radius: 50%;
        width: 38px; height: 38px;
        display: flex; align-items: center; justify-content: center;
        font-size: 18px;
        box-shadow: 0 2px 12px rgba(26, 94, 60, 0.5);
      ">☕</div>`,
      className: '',
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });

    shopsData.forEach((shop) => {
      const marker = L.marker([shop.latitude, shop.longitude], { icon: coffeeIcon }).addTo(map);
      marker.on('click', () => {
        setSelectedShop(shop);
        map.flyTo([shop.latitude - 0.002, shop.longitude], 16, { duration: 0.4 });
      });
    });

    // Close sheet on map click
    map.on('click', () => setSelectedShop(null));

    mapInstance.current = map;

    // Fix tiles not loading on mobile
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {/* Irish bar top */}
      <div className="irish-bar" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 }} />

      <div ref={mapContainer} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />

      {/* Header overlay */}
      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        right: 16,
        backgroundColor: 'rgba(13, 17, 23, 0.95)',
        borderRadius: 16,
        padding: '14px 18px',
        textAlign: 'center',
        border: `1px solid ${Colors.border}`,
        zIndex: 1000,
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ color: Colors.text, fontSize: 18, fontWeight: 800 }}>☘️ {copy.map.headerTitle}</div>
        <div style={{ color: Colors.accent, fontSize: 12, fontWeight: 600, marginTop: 2 }}>
          {copy.map.headerSubtitle(shopsData.length)}
        </div>
      </div>

      {/* Bottom sheet */}
      {selectedShop && (
        <div style={{
          position: 'absolute',
          bottom: 8,
          left: 12,
          right: 12,
          backgroundColor: Colors.surface,
          borderRadius: 20,
          padding: '16px 18px 18px',
          border: `1px solid ${Colors.border}`,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.5)',
          zIndex: 1000,
        }}>
          <div style={{ width: 36, height: 4, backgroundColor: Colors.textMuted, borderRadius: 2, margin: '0 auto 14px' }} />

          <button
            onClick={(e) => { e.stopPropagation(); setSelectedShop(null); }}
            style={{
              position: 'absolute', top: 10, right: 14, width: 28, height: 28, borderRadius: 14,
              backgroundColor: Colors.card, border: 'none', cursor: 'pointer', color: Colors.textMuted,
              fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>

          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 32, marginRight: 12 }}>☕</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: Colors.text, fontSize: 18, fontWeight: 800 }}>{selectedShop.name}</div>
              <div style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 2 }}>{selectedShop.address}</div>
            </div>
          </div>

          <div style={{ color: Colors.textSecondary, fontSize: 13, lineHeight: 1.5, marginBottom: 10 }}>
            {selectedShop.description}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <span style={{ backgroundColor: Colors.card, borderRadius: 8, padding: '5px 10px', color: Colors.textSecondary, fontSize: 11, fontWeight: 600 }}>
              🕐 {selectedShop.hours}
            </span>
            <span style={{ backgroundColor: Colors.primary + '30', borderRadius: 8, padding: '5px 10px', color: Colors.primaryLight, fontSize: 11, fontWeight: 600 }}>
              📱 {copy.map.nfcReady}
            </span>
          </div>

          <button
            onClick={() => navigate(`/shop/${selectedShop.id}`)}
            style={{
              width: '100%',
              backgroundColor: Colors.primary,
              borderRadius: 14,
              padding: 14,
              border: `1px solid ${Colors.primaryLight}`,
              cursor: 'pointer',
              color: Colors.text,
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            {copy.map.cta} →
          </button>
        </div>
      )}
    </div>
  );
}
