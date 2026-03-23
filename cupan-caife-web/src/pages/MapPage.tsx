import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import L from 'leaflet';
import { Colors } from '../constants/Colors';
import { useLanguage } from '../contexts/LanguageContext';
import shopsData from '../data/shops.json';
import pubsData from '../data/pubs.json';

type Mode = 'cafes' | 'pubs';

type Venue = {
  id: string;
  type?: string;
  name: string;
  latitude: number;
  longitude: number;
  address: string;
  hours: string;
  nfcTagId: string;
  description: string;
  website?: string;
  phone?: string;
};

const CENTERS: Record<Mode, [number, number]> = {
  cafes: [53.3438, -6.2588], // Dublin
  pubs: [53.2730, -9.0510],  // Galway
};

export default function MapPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [mode, setMode] = useState<Mode>('cafes');
  const [selected, setSelected] = useState<Venue | null>(null);
  const navigate = useNavigate();
  const { copy } = useLanguage();

  // Create map once
  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    const map = L.map(mapContainer.current, {
      center: CENTERS.cafes,
      zoom: 14,
      zoomControl: false,
      attributionControl: true,
      fadeAnimation: true,
      zoomAnimation: true,
      markerZoomAnimation: true,
      inertia: true,
      inertiaDeceleration: 3000,
      maxBoundsViscosity: 1.0,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://openstreetmap.org">OSM</a>',
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 4,
    }).addTo(map);

    map.on('click', () => setSelected(null));
    mapInstance.current = map;

    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Swap markers whenever mode changes
  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    // Remove old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    setSelected(null);

    const isCafe = mode === 'cafes';
    const venues: Venue[] = isCafe ? (shopsData as Venue[]) : (pubsData as Venue[]);

    const icon = L.divIcon({
      html: `<div style="
        background: ${isCafe ? Colors.primary : '#7B2D00'};
        border: 2px solid ${isCafe ? Colors.accent : '#D4722A'};
        border-radius: 50%;
        width: 38px; height: 38px;
        display: flex; align-items: center; justify-content: center;
        font-size: 18px;
        box-shadow: 0 2px 12px ${isCafe ? 'rgba(26,94,60,0.5)' : 'rgba(123,45,0,0.5)'};
      ">${isCafe ? '☕' : '🍺'}</div>`,
      className: '',
      iconSize: [38, 38],
      iconAnchor: [19, 19],
    });

    venues.forEach((venue) => {
      const marker = L.marker([venue.latitude, venue.longitude], { icon }).addTo(map);
      marker.on('click', () => {
        setSelected(venue);
        map.flyTo([venue.latitude - 0.002, venue.longitude], 16, { duration: 0.4 });
      });
      markersRef.current.push(marker);
    });

    // Fly to the relevant city
    map.flyTo(CENTERS[mode], 14, { duration: 0.6 });
  }, [mode]);

  const isPub = selected && ('type' in selected) && selected.type === 'pub';

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
        padding: '12px 18px',
        textAlign: 'center',
        border: `1px solid ${Colors.border}`,
        zIndex: 1000,
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ color: Colors.text, fontSize: 18, fontWeight: 800 }}>
          {mode === 'cafes' ? '☕' : '🍺'} {mode === 'cafes' ? copy.map.headerTitle : 'Pubs · Galway'}
        </div>
        <div style={{ color: Colors.accent, fontSize: 12, fontWeight: 600, marginTop: 2 }}>
          {mode === 'cafes'
            ? copy.map.headerSubtitle(shopsData.length)
            : `${pubsData.length} pubs in the City of the Tribes`}
        </div>

        {/* Café / Pub toggle pill */}
        <div style={{
          display: 'flex',
          marginTop: 10,
          backgroundColor: Colors.card,
          borderRadius: 20,
          padding: 3,
          gap: 3,
        }}>
          {(['cafes', 'pubs'] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              style={{
                flex: 1,
                padding: '6px 0',
                borderRadius: 17,
                border: 'none',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 700,
                backgroundColor: mode === m
                  ? (m === 'cafes' ? Colors.primary : '#7B2D00')
                  : 'transparent',
                color: mode === m ? Colors.text : Colors.textMuted,
                transition: 'background 0.2s',
              }}
            >
              {m === 'cafes' ? '☕ Cafés' : '🍺 Pubs'}
            </button>
          ))}
        </div>
      </div>

      {/* Bottom sheet */}
      {selected && (
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
            onClick={(e) => { e.stopPropagation(); setSelected(null); }}
            style={{
              position: 'absolute', top: 10, right: 14, width: 28, height: 28, borderRadius: 14,
              backgroundColor: Colors.card, border: 'none', cursor: 'pointer', color: Colors.textMuted,
              fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>

          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 32, marginRight: 12 }}>{isPub ? '🍺' : '☕'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: Colors.text, fontSize: 18, fontWeight: 800 }}>{selected.name}</div>
              <div style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 2 }}>{selected.address}</div>
            </div>
          </div>

          <div style={{ color: Colors.textSecondary, fontSize: 13, lineHeight: 1.5, marginBottom: 10 }}>
            {selected.description}
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ backgroundColor: Colors.card, borderRadius: 8, padding: '5px 10px', color: Colors.textSecondary, fontSize: 11, fontWeight: 600 }}>
              🕐 {selected.hours}
            </span>
            {isPub && selected.website ? (
              <a
                href={selected.website}
                target="_blank"
                rel="noopener noreferrer"
                style={{ backgroundColor: '#7B2D0030', borderRadius: 8, padding: '5px 10px', color: '#D4722A', fontSize: 11, fontWeight: 600, textDecoration: 'none' }}
              >
                🌐 Website
              </a>
            ) : !isPub && (
              <span style={{ backgroundColor: Colors.primary + '30', borderRadius: 8, padding: '5px 10px', color: Colors.primaryLight, fontSize: 11, fontWeight: 600 }}>
                📱 {copy.map.nfcReady}
              </span>
            )}
            {isPub && selected.phone && (
              <a
                href={`tel:${selected.phone}`}
                style={{ backgroundColor: Colors.card, borderRadius: 8, padding: '5px 10px', color: Colors.textSecondary, fontSize: 11, fontWeight: 600, textDecoration: 'none' }}
              >
                📞 {selected.phone}
              </a>
            )}
          </div>

          {!isPub && (
            <button
              onClick={() => navigate(`/shop/${selected.id}`)}
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
          )}

          {isPub && (
            <div style={{
              textAlign: 'center',
              color: Colors.textMuted,
              fontSize: 12,
              fontStyle: 'italic',
              paddingTop: 4,
            }}>
              Sláinte! 🍀
            </div>
          )}
        </div>
      )}
    </div>
  );
}
