import { useEffect, useRef, useState, useCallback } from 'react';
import L from 'leaflet';
import { Colors } from '../constants/Colors';
import { useCraicCoins } from '../contexts/CraicCoinsContext';

// ── GeoJSON types ───────────────────────────────────────────────────────

interface GAAHeritage {
  club_name: string;
  colors: string;
  sporting_legends: string;
}

interface LocalPhrase {
  phrase: string;
  phonetic: string;
  meaning: string;
}

interface CultureProperties {
  name: string;
  name_ga: string;
  county: string;
  type: string;
  folklore_myth: string;
  gaa_heritage: GAAHeritage;
  hidden_gem: string;
  local_phrase: LocalPhrase;
  history_landmarks: string[];
  famous_people: string[];
}

interface CultureFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: CultureProperties;
}

interface CultureGeoJSON {
  type: 'FeatureCollection';
  features: CultureFeature[];
}

// ── Haversine ───────────────────────────────────────────────────────────

function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Visited places ──────────────────────────────────────────────────────

const VISITED_KEY = 'craic-visited-places';

function getVisitedPlaces(): string[] {
  try {
    const raw = localStorage.getItem(VISITED_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch { /* */ }
  return [];
}

function markVisited(name: string) {
  const visited = getVisitedPlaces();
  if (!visited.includes(name)) {
    visited.push(name);
    localStorage.setItem(VISITED_KEY, JSON.stringify(visited));
  }
}

// ── TTS ─────────────────────────────────────────────────────────────────

async function speakIrish(text: string) {
  try {
    const res = await fetch('https://api.abair.ie/v3/synthesis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        synthinput: { text },
        voiceparams: { languageCode: 'ga-IE', name: 'ga_CO_snc_piper' },
        audioconfig: { audioEncoding: 'MP3', speakingRate: 1, pitch: 1 },
      }),
    });
    const data = await res.json();
    const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
    audio.play();
  } catch {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ga-IE';
    u.rate = 0.85;
    window.speechSynthesis.speak(u);
  }
}

const PROXIMITY_METRES = 200;

// ── Component ───────────────────────────────────────────────────────────

export default function PlannerPage() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const featuresRef = useRef<CultureFeature[]>([]);

  const [features, setFeatures] = useState<CultureFeature[]>([]);
  const [selectedFeature, setSelectedFeature] = useState<CultureFeature | null>(null);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [visitedPlaces, setVisitedPlaces] = useState<string[]>(getVisitedPlaces);
  const [coinPopup, setCoinPopup] = useState<{ name: string; amount: number } | null>(null);
  const [playingPhrase, setPlayingPhrase] = useState(false);
  const [showCredit, setShowCredit] = useState(false);

  const { addCoins } = useCraicCoins();

  const isNearFeature = useCallback(
    (feature: CultureFeature) => {
      if (!userPos) return false;
      const [lng, lat] = feature.geometry.coordinates;
      return haversineMetres(userPos.lat, userPos.lng, lat, lng) <= PROXIMITY_METRES;
    },
    [userPos],
  );

  // ── Fetch GeoJSON ─────────────────────────────────────────────────────

  useEffect(() => {
    fetch('/ireland_culture.geojson')
      .then((r) => r.json())
      .then((data: CultureGeoJSON) => {
        setFeatures(data.features);
        featuresRef.current = data.features;
      })
      .catch((err) => console.error('Failed to load GeoJSON', err));
  }, []);

  // ── Geolocation ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => setUserPos({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.warn('Geo error', err),
      { enableHighAccuracy: true, maximumAge: 5000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // ── Init map ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    const map = L.map(mapContainer.current, {
      center: [53.35, -7.26],
      zoom: 7,
      zoomControl: false,
      attributionControl: true,
      fadeAnimation: true,
      zoomAnimation: true,
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

    map.on('click', () => setSelectedFeature(null));

    // Render markers on viewport change
    const renderViewportMarkers = () => {
      const bounds = map.getBounds();
      const zoom = map.getZoom();

      // Remove old markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      // Only show markers at zoom >= 9 (county level)
      if (zoom < 9) return;

      const allFeatures = featuresRef.current;
      const visited = getVisitedPlaces();

      allFeatures.forEach((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        if (!bounds.contains([lat, lng])) return;

        const icon = L.divIcon({
          html: `<div style="
            background: ${Colors.primary};
            border: 2px solid ${visited.includes(feature.properties.name) ? Colors.success : Colors.accent};
            border-radius: 50%;
            width: 32px; height: 32px;
            display: flex; align-items: center; justify-content: center;
            font-size: 15px;
            box-shadow: 0 2px 8px rgba(26, 94, 60, 0.4);
          ">${visited.includes(feature.properties.name) ? '✅' : '☘️'}</div>`,
          className: '',
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });

        const marker = L.marker([lat, lng], { icon }).addTo(map);
        marker.on('click', () => {
          setSelectedFeature(feature);
          map.flyTo([lat - 0.005, lng], Math.max(zoom, 12), { duration: 0.4 });
        });
        markersRef.current.push(marker);
      });
    };

    map.on('moveend', renderViewportMarkers);
    map.on('zoomend', renderViewportMarkers);

    mapInstance.current = map;
    setTimeout(() => map.invalidateSize(), 100);

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Re-render markers when features load
  useEffect(() => {
    if (!mapInstance.current || features.length === 0) return;
    mapInstance.current.fire('moveend');
  }, [features, visitedPlaces]);

  // ── User location dot ─────────────────────────────────────────────────

  useEffect(() => {
    const map = mapInstance.current;
    if (!map || !userPos) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userPos.lat, userPos.lng]);
    } else {
      const pulseIcon = L.divIcon({
        html: `<div style="position:relative;width:20px;height:20px;">
          <div style="position:absolute;inset:0;background:rgba(66,133,244,0.3);border-radius:50%;animation:craic-pulse 2s infinite;"></div>
          <div style="position:absolute;top:4px;left:4px;width:12px;height:12px;background:#4285F4;border:2px solid #fff;border-radius:50%;"></div>
        </div>`,
        className: '',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      userMarkerRef.current = L.marker([userPos.lat, userPos.lng], {
        icon: pulseIcon,
        zIndexOffset: 1000,
      }).addTo(map);
    }
  }, [userPos]);

  // ── Claim handler with animation ──────────────────────────────────────

  const handleClaim = (feature: CultureFeature) => {
    const name = feature.properties.name;
    if (visitedPlaces.includes(name)) return;

    addCoins(name, name, 5);
    markVisited(name);
    setVisitedPlaces(getVisitedPlaces());

    // Coin popup animation
    setCoinPopup({ name, amount: 5 });
    if (navigator.vibrate) navigator.vibrate([100, 50, 200]);
    setTimeout(() => setCoinPopup(null), 2500);

    // Re-render markers to show ✅
    if (mapInstance.current) mapInstance.current.fire('moveend');
  };

  // ── Simulate visit ────────────────────────────────────────────────────

  const handleSimulateVisit = (feature: CultureFeature) => {
    const [lng, lat] = feature.geometry.coordinates;
    setUserPos({ lat, lng });

    // Update user marker position
    if (userMarkerRef.current && mapInstance.current) {
      userMarkerRef.current.setLatLng([lat, lng]);
    }

    // Then claim
    setTimeout(() => handleClaim(feature), 500);
  };

  const selectedNear = selectedFeature ? isNearFeature(selectedFeature) : false;
  const selectedClaimed = selectedFeature ? visitedPlaces.includes(selectedFeature.properties.name) : false;

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <style>{`
        @keyframes craic-pulse { 0% { transform: scale(1); opacity: 1; } 100% { transform: scale(2.5); opacity: 0; } }
        @keyframes coin-fly { 0% { transform: translateY(0) scale(1); opacity: 1; } 100% { transform: translateY(-80px) scale(1.5); opacity: 0; } }
      `}</style>

      <div className="irish-bar" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 }} />

      <div ref={mapContainer} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />

      {/* Header */}
      <div style={{
        position: 'absolute', top: 16, left: 16, right: 16,
        backgroundColor: 'rgba(13, 17, 23, 0.95)', borderRadius: 16,
        padding: '14px 18px', textAlign: 'center',
        border: `1px solid ${Colors.border}`, zIndex: 1000, backdropFilter: 'blur(8px)',
      }}>
        <div style={{ color: Colors.text, fontSize: 18, fontWeight: 800 }}>☘️ Culture Planner</div>
        <div style={{ color: Colors.accent, fontSize: 12, fontWeight: 600, marginTop: 2 }}>
          {features.length} cultural spots · Zoom in to explore
        </div>
      </div>

      {/* Coin popup animation */}
      {coinPopup && (
        <div style={{
          position: 'absolute', top: '40%', left: '50%', transform: 'translateX(-50%)',
          zIndex: 2000, animation: 'coin-fly 2.5s ease forwards', pointerEvents: 'none',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 4 }}>☘️</div>
          <div style={{
            backgroundColor: Colors.success, color: '#fff', borderRadius: 16,
            padding: '8px 20px', fontSize: 20, fontWeight: 900, whiteSpace: 'nowrap',
            boxShadow: '0 4px 20px rgba(46, 160, 67, 0.5)',
          }}>+{coinPopup.amount} CraicCoins!</div>
          <div style={{ color: Colors.text, fontSize: 13, marginTop: 4, fontWeight: 600 }}>{coinPopup.name}</div>
        </div>
      )}

      {/* Bottom sheet */}
      {selectedFeature && (
        <div style={{
          position: 'absolute', bottom: 8, left: 12, right: 12,
          backgroundColor: Colors.surface, borderRadius: 20,
          padding: '16px 18px 18px', border: `1px solid ${Colors.border}`,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.5)', zIndex: 1000,
          maxHeight: '55vh', overflowY: 'auto',
        }}>
          <div style={{ width: 36, height: 4, backgroundColor: Colors.textMuted, borderRadius: 2, margin: '0 auto 14px' }} />

          <button
            onClick={(e) => { e.stopPropagation(); setSelectedFeature(null); }}
            style={{
              position: 'absolute', top: 10, right: 14, width: 28, height: 28, borderRadius: 14,
              backgroundColor: Colors.card, border: 'none', cursor: 'pointer',
              color: Colors.textMuted, fontSize: 14, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >✕</button>

          {/* Name */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 32, marginRight: 12 }}>☘️</span>
            <div style={{ flex: 1 }}>
              <div style={{ color: Colors.text, fontSize: 18, fontWeight: 800 }}>{selectedFeature.properties.name}</div>
              {selectedFeature.properties.name_ga && (
                <div style={{ color: Colors.irish.orange, fontSize: 13, fontStyle: 'italic' }}>{selectedFeature.properties.name_ga}</div>
              )}
              {selectedFeature.properties.county && (
                <div style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 2 }}>{selectedFeature.properties.county}</div>
              )}
            </div>
            {selectedNear && (
              <span style={{
                backgroundColor: Colors.success, color: '#fff', fontSize: 11, fontWeight: 700,
                padding: '4px 10px', borderRadius: 10, whiteSpace: 'nowrap',
              }}>You're here!</span>
            )}
          </div>

          {/* Folklore */}
          {selectedFeature.properties.folklore_myth && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ color: Colors.accent, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Lore & Folklore</div>
              <div style={{ color: Colors.textSecondary, fontSize: 13, lineHeight: 1.5 }}>{selectedFeature.properties.folklore_myth}</div>
            </div>
          )}

          {/* GAA */}
          {selectedFeature.properties.gaa_heritage && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ color: Colors.accent, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>GAA Heritage</div>
              <div style={{ color: Colors.textSecondary, fontSize: 13 }}>
                <strong style={{ color: Colors.text }}>{selectedFeature.properties.gaa_heritage.club_name}</strong>{' '}
                — {selectedFeature.properties.gaa_heritage.colors}
              </div>
              {selectedFeature.properties.gaa_heritage.sporting_legends && (
                <div style={{ color: Colors.textMuted, fontSize: 12, marginTop: 2 }}>{selectedFeature.properties.gaa_heritage.sporting_legends}</div>
              )}
            </div>
          )}

          {/* Hidden gem */}
          {selectedFeature.properties.hidden_gem && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ color: Colors.accent, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Hidden Gem</div>
              <div style={{ color: Colors.textSecondary, fontSize: 13, lineHeight: 1.5 }}>{selectedFeature.properties.hidden_gem}</div>
            </div>
          )}

          {/* Local phrase with TTS */}
          {selectedFeature.properties.local_phrase && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ color: Colors.accent, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Local Phrase</div>
              <div style={{
                backgroundColor: Colors.background, borderRadius: 10, padding: '10px 14px',
                border: `1px solid ${Colors.border}`,
              }}>
                <div style={{ color: Colors.irish.green, fontSize: 15, fontWeight: 700 }}>{selectedFeature.properties.local_phrase.phrase}</div>
                <div style={{ color: Colors.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: 2 }}>/{selectedFeature.properties.local_phrase.phonetic}/</div>
                <div style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 4 }}>{selectedFeature.properties.local_phrase.meaning}</div>
                <button
                  onClick={() => {
                    setPlayingPhrase(true);
                    speakIrish(selectedFeature.properties.local_phrase.phrase);
                    setShowCredit(true);
                    setTimeout(() => { setPlayingPhrase(false); setShowCredit(false); }, 3000);
                  }}
                  style={{
                    marginTop: 8, width: '100%', backgroundColor: Colors.primary,
                    borderRadius: 10, padding: '8px 14px', border: `1px solid ${Colors.primaryLight}`,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  <span style={{ fontSize: 16 }}>{playingPhrase ? '🔊' : '🔈'}</span>
                  <span style={{ color: Colors.text, fontSize: 13, fontWeight: 700 }}>{playingPhrase ? 'Playing...' : 'Hear it spoken'}</span>
                </button>
                {showCredit && (
                  <div style={{ marginTop: 4, textAlign: 'center', color: Colors.textMuted, fontSize: 10, fontStyle: 'italic' }}>
                    Powered by abair.ie (Trinity College Dublin)
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Claim / Simulate buttons */}
          {!selectedClaimed ? (
            <div style={{ display: 'flex', gap: 8 }}>
              {selectedNear && (
                <button
                  onClick={() => handleClaim(selectedFeature)}
                  style={{
                    flex: 1, backgroundColor: Colors.success, borderRadius: 14, padding: 14,
                    border: 'none', cursor: 'pointer', color: '#fff', fontSize: 15, fontWeight: 700,
                  }}
                >☘️ Claim +5 CraicCoins</button>
              )}
              <button
                onClick={() => handleSimulateVisit(selectedFeature)}
                style={{
                  flex: 1, backgroundColor: Colors.accent, borderRadius: 14, padding: 14,
                  border: 'none', cursor: 'pointer', color: Colors.background, fontSize: 14, fontWeight: 700,
                }}
              >📍 Simulate Visit</button>
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: Colors.success, fontSize: 14, fontWeight: 700, padding: 10 }}>
              ✅ Already claimed!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
