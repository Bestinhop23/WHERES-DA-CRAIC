import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import L from 'leaflet';
import { Colors } from '../constants/Colors';
import { useCraicCoins } from '../contexts/CraicCoinsContext';
import { useLanguage } from '../contexts/LanguageContext';
import { createCheckin, fetchPub, redeemPub } from '../lib/api';
import { getDeviceFingerprint } from '../lib/user';
import shopsData from '../data/shops.json';
import pubsData from '../data/pubs.json';

type Mode = 'cafes' | 'pubs' | 'culture';

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

type CultureFeature = {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    name: string;
    name_ga?: string;
    county?: string;
    folklore_myth?: string;
    hidden_gem?: string;
    local_phrase?: {
      phrase: string;
      phonetic: string;
      meaning: string;
    };
  };
};

type CultureGeoJSON = {
  type: 'FeatureCollection';
  features: CultureFeature[];
};

const VISITED_CULTURE_KEY = 'craic-visited-culture';

const CENTERS: Record<Mode, [number, number]> = {
  cafes: [53.3438, -6.2588],
  pubs: [53.273, -9.051],
  culture: [53.35, -7.26],
};

function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getVisitedCulture(): string[] {
  try {
    const raw = localStorage.getItem(VISITED_CULTURE_KEY);
    if (raw) return JSON.parse(raw) as string[];
  } catch {
    // Ignore parse errors.
  }
  return [];
}

function markVisitedCulture(name: string): void {
  const visited = getVisitedCulture();
  if (visited.includes(name)) return;
  visited.push(name);
  localStorage.setItem(VISITED_CULTURE_KEY, JSON.stringify(visited));
}

async function speakIrish(text: string): Promise<void> {
  try {
    const response = await fetch('https://api.abair.ie/v3/synthesis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        synthinput: { text },
        voiceparams: { languageCode: 'ga-IE', name: 'ga_CO_snc_piper' },
        audioconfig: { audioEncoding: 'MP3', speakingRate: 1, pitch: 1 },
      }),
    });
    const data = (await response.json()) as { audioContent?: string };
    if (!data.audioContent) throw new Error('No audio');
    const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
    await audio.play();
  } catch {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ga-IE';
    utterance.rate = 0.88;
    window.speechSynthesis.speak(utterance);
  }
}

async function recordAndRecognise(): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
  const chunks: Blob[] = [];

  return new Promise((resolve, reject) => {
    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = async () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        try {
          const response = await fetch('https://phoneticsrv3.lcs.tcd.ie/asr_api/recognise', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ recogniseBlob: base64, developer: true, method: 'online2bin' }),
          });
          const data = await response.json();
          const utterance = data?.transcriptions?.[0]?.utterance || data?.transcription || data?.text || '';
          resolve(utterance);
        } catch {
          reject(new Error('recognition-failed'));
        }
      };
      reader.readAsDataURL(blob);
    };

    recorder.start();
    window.setTimeout(() => recorder.stop(), 3500);
  });
}

function similarityScore(a: string, b: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z\u00e1\u00e9\u00ed\u00f3\u00fa\s]/g, '').trim();
  const A = normalize(a).split(/\s+/).filter(Boolean);
  const B = normalize(b).split(/\s+/).filter(Boolean);
  if (A.length === 0 || B.length === 0) return 0;
  const matches = A.filter((token) => B.includes(token)).length;
  return Math.round((matches / Math.max(A.length, B.length)) * 100);
}

export default function MapPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const { userID, syncWallet, addCoins } = useCraicCoins();

  const requestedMode = searchParams.get('mode');
  const initialMode: Mode = requestedMode === 'pubs' || requestedMode === 'culture' ? requestedMode : 'cafes';

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [selectedCulture, setSelectedCulture] = useState<CultureFeature | null>(null);
  const [cultureFeatures, setCultureFeatures] = useState<CultureFeature[]>([]);
  const [visitedCulture, setVisitedCulture] = useState<string[]>(getVisitedCulture());
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);
  const [pubPhrase, setPubPhrase] = useState('Pionta Guinness, le do thoil.');
  const [pubEvents, setPubEvents] = useState<string[]>([]);
  const [loadingPubExtras, setLoadingPubExtras] = useState(false);
  const [redeemState, setRedeemState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [checkinState, setCheckinState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [coinToast, setCoinToast] = useState<{ open: boolean; label: string }>({ open: false, label: '' });
  const [recognition, setRecognition] = useState<{ text: string; score: number } | null>(null);
  const [recording, setRecording] = useState(false);

  const text = useMemo(() => {
    if (language === 'ga') {
      return {
        tabs: {
          cafes: 'Caifeanna',
          pubs: 'Tithe Tabhairne',
          culture: 'Pleanaileai Cultuir',
        },
        headers: {
          cafes: `Cafeanna i mBaile Atha Cliath: ${shopsData.length}`,
          pubs: `Tithe tabhairne i nGaillimh: ${pubsData.length}`,
          culture: `Aiteanna cultuir: ${cultureFeatures.length}`,
        },
        mapTitle: 'Learscail Aontaithe',
        tapToEarn: 'Tapail NFC chun CraicCoins a thuilleamh',
        tapLoading: 'Tapail ag bailiu...',
        tapDone: 'CraicCoins bronnta!',
        tapError: 'Theip ar an tapail',
        checkin: 'Seiceail isteach',
        checkinDone: 'Seicealadh isteach',
        checkinError: 'Theip ar an tseiceail isteach',
        viewMenu: 'Ordaigh as Gaeilge',
        speakPhrase: 'Eist leis an bhfraisa',
        events: 'Imeachtai',
        noEvents: 'Nior luchtaigh imeachtai don tabhairne seo.',
        claimCulture: 'Eileamh +5 CraicCoins',
        practice: 'Cleachtadh frasa',
        close: 'Dun',
        website: 'Suibheas',
        phone: 'Fón',
      };
    }

    return {
      tabs: {
        cafes: 'Cafes',
        pubs: 'Pubs',
        culture: 'Culture',
      },
      headers: {
        cafes: `Cafes in Dublin: ${shopsData.length}`,
        pubs: `Pubs in Galway: ${pubsData.length}`,
        culture: `Cultural spots: ${cultureFeatures.length}`,
      },
      mapTitle: 'Unified Map',
      tapToEarn: 'Tap NFC to earn CraicCoins',
      tapLoading: 'Processing tap...',
      tapDone: 'CraicCoins awarded!',
      tapError: 'Tap failed',
      checkin: 'Check in',
      checkinDone: 'Checked in',
      checkinError: 'Check-in failed',
      viewMenu: 'Order in Irish',
      speakPhrase: 'Hear phrase',
      events: 'Events',
      noEvents: 'No pub events loaded for this location.',
      claimCulture: 'Claim +5 CraicCoins',
      practice: 'Practice phrase',
      close: 'Close',
      website: 'Website',
      phone: 'Phone',
    };
  }, [language, cultureFeatures.length]);

  useEffect(() => {
    if (searchParams.get('mode') !== mode) {
      const next = new URLSearchParams(searchParams);
      next.set('mode', mode);
      setSearchParams(next, { replace: true });
    }
  }, [mode, searchParams, setSearchParams]);

  useEffect(() => {
    fetch('/ireland_culture.geojson')
      .then((response) => response.json())
      .then((data: CultureGeoJSON) => setCultureFeatures(data.features ?? []))
      .catch(() => setCultureFeatures([]));
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setUserPos({ lat: position.coords.latitude, lng: position.coords.longitude });
      },
      () => {
        setUserPos(null);
      },
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: CENTERS[mode],
      zoom: mode === 'culture' ? 7 : 14,
      zoomControl: false,
      attributionControl: true,
      inertia: true,
      fadeAnimation: true,
      zoomAnimation: true,
      markerZoomAnimation: true,
    });

    L.control.zoom({ position: 'topright' }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://openstreetmap.org">OSM</a>',
    }).addTo(map);

    map.on('click', () => {
      setSelectedVenue(null);
      setSelectedCulture(null);
      setRedeemState('idle');
      setCheckinState('idle');
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [mode]);

  const cultureNear = useMemo(() => {
    if (!selectedCulture || !userPos) return false;
    const [lng, lat] = selectedCulture.geometry.coordinates;
    return haversineMetres(userPos.lat, userPos.lng, lat, lng) <= 200;
  }, [selectedCulture, userPos]);

  const placeMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    setSelectedVenue(null);
    setSelectedCulture(null);
    setRedeemState('idle');
    setCheckinState('idle');

    if (mode === 'cafes' || mode === 'pubs') {
      const entries: Venue[] = mode === 'cafes' ? (shopsData as Venue[]) : (pubsData as Venue[]);
      const isCafe = mode === 'cafes';

      const icon = L.divIcon({
        html: `<div style="
          background:${isCafe ? Colors.primary : '#7B2D00'};
          border:2px solid ${isCafe ? Colors.accent : '#D4722A'};
          border-radius:50%;
          width:38px;
          height:38px;
          display:flex;
          align-items:center;
          justify-content:center;
          font-size:18px;
          box-shadow:0 2px 12px ${isCafe ? 'rgba(26,94,60,0.45)' : 'rgba(123,45,0,0.45)'};
        ">${isCafe ? '☕' : '🍺'}</div>`,
        className: '',
        iconSize: [38, 38],
        iconAnchor: [19, 19],
      });

      entries.forEach((entry) => {
        const marker = L.marker([entry.latitude, entry.longitude], { icon }).addTo(map);
        marker.on('click', () => {
          setSelectedVenue(entry);
          map.flyTo([entry.latitude - 0.002, entry.longitude], 15, { duration: 0.45 });
        });
        markersRef.current.push(marker);
      });

      map.flyTo(CENTERS[mode], 14, { duration: 0.6 });
      return;
    }

    const icon = L.divIcon({
      html: `<div style="
        background:${Colors.primary};
        border:2px solid ${Colors.accent};
        border-radius:50%;
        width:34px;
        height:34px;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:16px;
      ">☘️</div>`,
      className: '',
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });

    cultureFeatures.forEach((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      const visited = visitedCulture.includes(feature.properties.name);
      const cultureIcon = visited
        ? L.divIcon({
            html: `<div style="
              background:${Colors.success};
              border:2px solid #fff;
              border-radius:50%;
              width:34px;
              height:34px;
              display:flex;
              align-items:center;
              justify-content:center;
              font-size:15px;
            ">✅</div>`,
            className: '',
            iconSize: [34, 34],
            iconAnchor: [17, 17],
          })
        : icon;

      const marker = L.marker([lat, lng], { icon: cultureIcon }).addTo(map);
      marker.on('click', () => {
        setSelectedCulture(feature);
        map.flyTo([lat - 0.004, lng], 11, { duration: 0.45 });
      });
      markersRef.current.push(marker);
    });

    map.flyTo(CENTERS.culture, 7, { duration: 0.6 });
  }, [cultureFeatures, mode, visitedCulture]);

  useEffect(() => {
    placeMarkers();
  }, [placeMarkers]);

  useEffect(() => {
    if (!selectedVenue || mode !== 'pubs') {
      setPubPhrase('Pionta Guinness, le do thoil.');
      setPubEvents([]);
      return;
    }

    setLoadingPubExtras(true);
    fetchPub(selectedVenue.nfcTagId)
      .then((pub) => {
        setPubPhrase(pub.phrase?.ga || 'Pionta Guinness, le do thoil.');
        setPubEvents(pub.events || []);
      })
      .catch(() => {
        setPubPhrase('Pionta Guinness, le do thoil.');
        setPubEvents([]);
      })
      .finally(() => setLoadingPubExtras(false));
  }, [mode, selectedVenue]);

  const handlePubRedeem = async (pubID: string) => {
    setRedeemState('loading');
    try {
      await redeemPub(userID, pubID, getDeviceFingerprint());
      setRedeemState('done');
      await syncWallet();
      setCoinToast({ open: true, label: '+20 CraicCoins' });
      window.setTimeout(() => setCoinToast({ open: false, label: '' }), 1800);
    } catch {
      setRedeemState('error');
    }
  };

  const handlePubCheckin = async (pubID: string) => {
    setCheckinState('loading');
    try {
      await createCheckin(userID, pubID, 'Map check-in');
      setCheckinState('done');
    } catch {
      setCheckinState('error');
    }
  };

  const handleCultureClaim = async () => {
    if (!selectedCulture) return;
    const placeName = selectedCulture.properties.name;
    if (visitedCulture.includes(placeName)) return;

    markVisitedCulture(placeName);
    setVisitedCulture(getVisitedCulture());
    addCoins(placeName, placeName, 5);
    setCoinToast({ open: true, label: '+5 CraicCoins' });
    window.setTimeout(() => setCoinToast({ open: false, label: '' }), 1800);
  };

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div className="irish-bar" style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 1000 }} />
      <div ref={mapContainerRef} style={{ position: 'absolute', inset: 0 }} />

      {coinToast.open && (
        <div style={{
          position: 'absolute',
          top: '36%',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 2000,
          background: Colors.success,
          color: '#fff',
          borderRadius: 14,
          padding: '8px 16px',
          fontWeight: 800,
          boxShadow: '0 8px 20px rgba(46,160,67,0.45)',
        }}>
          {coinToast.label}
        </div>
      )}

      <div style={{
        position: 'absolute',
        top: 16,
        left: 16,
        right: 16,
        zIndex: 1000,
        backgroundColor: 'rgba(13, 17, 23, 0.95)',
        borderRadius: 16,
        border: `1px solid ${Colors.border}`,
        padding: '12px 16px',
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{ color: Colors.text, fontSize: 18, fontWeight: 800, textAlign: 'center' }}>
          {mode === 'cafes' ? '☕' : mode === 'pubs' ? '🍺' : '☘️'} {text.mapTitle}
        </div>
        <div style={{ color: Colors.accent, fontSize: 12, fontWeight: 600, textAlign: 'center', marginTop: 2 }}>
          {mode === 'cafes' ? text.headers.cafes : mode === 'pubs' ? text.headers.pubs : text.headers.culture}
        </div>

        <div style={{
          display: 'flex',
          gap: 4,
          marginTop: 10,
          backgroundColor: Colors.card,
          borderRadius: 20,
          padding: 3,
        }}>
          {(['cafes', 'pubs', 'culture'] as Mode[]).map((item) => (
            <button
              key={item}
              onClick={() => setMode(item)}
              style={{
                flex: 1,
                border: 'none',
                borderRadius: 17,
                padding: '6px 0',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 800,
                color: mode === item ? Colors.text : Colors.textMuted,
                backgroundColor: mode === item
                  ? (item === 'cafes' ? Colors.primary : item === 'pubs' ? '#7B2D00' : '#2B4D8A')
                  : 'transparent',
              }}
            >
              {item === 'cafes' ? text.tabs.cafes : item === 'pubs' ? text.tabs.pubs : text.tabs.culture}
            </button>
          ))}
        </div>
      </div>

      {selectedVenue && (
        <div style={{
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 8,
          zIndex: 1000,
          backgroundColor: Colors.surface,
          borderRadius: 20,
          border: `1px solid ${Colors.border}`,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.45)',
          padding: '16px 16px 14px',
          maxHeight: '58vh',
          overflowY: 'auto',
        }}>
          <button
            onClick={() => setSelectedVenue(null)}
            style={{
              position: 'absolute',
              top: 10,
              right: 12,
              width: 28,
              height: 28,
              borderRadius: 14,
              border: 'none',
              background: Colors.card,
              color: Colors.textMuted,
              cursor: 'pointer',
              fontWeight: 800,
            }}
          >
            {text.close[0]}
          </button>

          <div style={{ color: Colors.text, fontSize: 18, fontWeight: 800 }}>{selectedVenue.name}</div>
          <div style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 2 }}>{selectedVenue.address}</div>
          <div style={{ color: Colors.textSecondary, fontSize: 13, marginTop: 10, lineHeight: 1.45 }}>{selectedVenue.description}</div>

          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ background: Colors.card, borderRadius: 8, padding: '5px 10px', color: Colors.textSecondary, fontSize: 11, fontWeight: 700 }}>🕐 {selectedVenue.hours}</span>
            {!!selectedVenue.website && (
              <a
                href={selectedVenue.website}
                target="_blank"
                rel="noopener noreferrer"
                style={{ background: '#7B2D0030', borderRadius: 8, padding: '5px 10px', color: '#D4722A', fontSize: 11, fontWeight: 700, textDecoration: 'none' }}
              >
                🌐 {text.website}
              </a>
            )}
            {!!selectedVenue.phone && (
              <a
                href={`tel:${selectedVenue.phone}`}
                style={{ background: Colors.card, borderRadius: 8, padding: '5px 10px', color: Colors.textSecondary, fontSize: 11, fontWeight: 700, textDecoration: 'none' }}
              >
                📞 {text.phone}
              </a>
            )}
          </div>

          {mode === 'cafes' && (
            <button
              onClick={() => navigate(`/shop/${selectedVenue.id}`)}
              style={{
                marginTop: 12,
                width: '100%',
                border: `1px solid ${Colors.primaryLight}`,
                background: Colors.primary,
                color: Colors.text,
                borderRadius: 12,
                padding: 12,
                cursor: 'pointer',
                fontWeight: 800,
              }}
            >
              {text.viewMenu} →
            </button>
          )}

          {mode === 'pubs' && (
            <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
              <button
                onClick={() => void handlePubRedeem(selectedVenue.nfcTagId)}
                disabled={redeemState === 'loading'}
                style={{
                  width: '100%',
                  border: '1px solid #D4722A',
                  background: '#7B2D00',
                  color: Colors.text,
                  borderRadius: 12,
                  padding: 12,
                  cursor: 'pointer',
                  fontWeight: 800,
                }}
              >
                {redeemState === 'loading' ? text.tapLoading : text.tapToEarn}
              </button>

              <button
                onClick={() => void handlePubCheckin(selectedVenue.nfcTagId)}
                disabled={checkinState === 'loading'}
                style={{
                  width: '100%',
                  border: `1px solid ${Colors.border}`,
                  background: Colors.card,
                  color: Colors.text,
                  borderRadius: 12,
                  padding: 10,
                  cursor: 'pointer',
                  fontWeight: 700,
                }}
              >
                {checkinState === 'loading' ? `${text.checkin}...` : text.checkin}
              </button>

              {redeemState === 'done' && <div style={{ color: Colors.success, fontSize: 12, fontWeight: 700 }}>{text.tapDone}</div>}
              {redeemState === 'error' && <div style={{ color: Colors.error, fontSize: 12, fontWeight: 700 }}>{text.tapError}</div>}
              {checkinState === 'done' && <div style={{ color: Colors.success, fontSize: 12, fontWeight: 700 }}>{text.checkinDone}</div>}
              {checkinState === 'error' && <div style={{ color: Colors.error, fontSize: 12, fontWeight: 700 }}>{text.checkinError}</div>}

              <div style={{
                background: Colors.background,
                border: `1px solid ${Colors.border}`,
                borderRadius: 10,
                padding: 10,
              }}>
                <div style={{ color: Colors.text, fontWeight: 700, fontSize: 13 }}>{pubPhrase}</div>
                <button
                  onClick={() => void speakIrish(pubPhrase)}
                  style={{
                    marginTop: 8,
                    width: '100%',
                    background: Colors.primary,
                    border: `1px solid ${Colors.primaryLight}`,
                    color: Colors.text,
                    borderRadius: 9,
                    padding: 8,
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  🔈 {text.speakPhrase}
                </button>
                {loadingPubExtras && <div style={{ marginTop: 6, color: Colors.textMuted, fontSize: 11 }}>...</div>}
              </div>

              <div style={{ marginTop: 2 }}>
                <div style={{ color: Colors.accent, fontSize: 11, fontWeight: 700, marginBottom: 4 }}>{text.events}</div>
                {pubEvents.length === 0 && <div style={{ color: Colors.textMuted, fontSize: 12 }}>{text.noEvents}</div>}
                {pubEvents.length > 0 && (
                  <ul style={{ listStyle: 'none', display: 'grid', gap: 6 }}>
                    {pubEvents.slice(0, 3).map((event) => (
                      <li key={event} style={{ color: Colors.textSecondary, fontSize: 12, lineHeight: 1.35 }}>• {event}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {selectedCulture && (
        <div style={{
          position: 'absolute',
          left: 12,
          right: 12,
          bottom: 8,
          zIndex: 1000,
          backgroundColor: Colors.surface,
          borderRadius: 20,
          border: `1px solid ${Colors.border}`,
          boxShadow: '0 -4px 24px rgba(0,0,0,0.45)',
          padding: '16px 16px 14px',
          maxHeight: '58vh',
          overflowY: 'auto',
        }}>
          <button
            onClick={() => setSelectedCulture(null)}
            style={{
              position: 'absolute',
              top: 10,
              right: 12,
              width: 28,
              height: 28,
              borderRadius: 14,
              border: 'none',
              background: Colors.card,
              color: Colors.textMuted,
              cursor: 'pointer',
              fontWeight: 800,
            }}
          >
            {text.close[0]}
          </button>

          <div style={{ color: Colors.text, fontSize: 18, fontWeight: 800 }}>
            {language === 'ga' && selectedCulture.properties.name_ga
              ? selectedCulture.properties.name_ga
              : selectedCulture.properties.name}
          </div>
          <div style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 2 }}>{selectedCulture.properties.county || ''}</div>

          {!!selectedCulture.properties.folklore_myth && (
            <p style={{ color: Colors.textSecondary, fontSize: 13, lineHeight: 1.45, marginTop: 10 }}>
              {selectedCulture.properties.folklore_myth}
            </p>
          )}

          {!!selectedCulture.properties.hidden_gem && (
            <p style={{ color: Colors.textMuted, fontSize: 12, lineHeight: 1.35, marginTop: 8 }}>
              {selectedCulture.properties.hidden_gem}
            </p>
          )}

          {!!selectedCulture.properties.local_phrase?.phrase && (
            <div style={{ marginTop: 10, background: Colors.background, borderRadius: 10, border: `1px solid ${Colors.border}`, padding: 10 }}>
              <div style={{ color: Colors.irish.green, fontWeight: 700 }}>{selectedCulture.properties.local_phrase.phrase}</div>
              <div style={{ color: Colors.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: 2 }}>
                /{selectedCulture.properties.local_phrase.phonetic}/
              </div>
              <div style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                {selectedCulture.properties.local_phrase.meaning}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => void speakIrish(selectedCulture.properties.local_phrase?.phrase || '')}
                  style={{
                    flex: 1,
                    background: Colors.primary,
                    color: Colors.text,
                    border: `1px solid ${Colors.primaryLight}`,
                    borderRadius: 9,
                    padding: 8,
                    cursor: 'pointer',
                    fontWeight: 700,
                    fontSize: 12,
                  }}
                >
                  🔈 {text.speakPhrase}
                </button>
                <button
                  onClick={async () => {
                    if (recording) return;
                    setRecording(true);
                    setRecognition(null);
                    try {
                      const spoken = await recordAndRecognise();
                      const target = selectedCulture.properties.local_phrase?.phrase || '';
                      setRecognition({ text: spoken, score: similarityScore(spoken, target) });
                    } catch {
                      setRecognition({ text: language === 'ga' ? 'Theip ar aithint gutha' : 'Speech recognition failed', score: 0 });
                    }
                    setRecording(false);
                  }}
                  style={{
                    flex: 1,
                    background: recording ? '#c62828' : Colors.accent,
                    color: Colors.background,
                    border: 'none',
                    borderRadius: 9,
                    padding: 8,
                    cursor: 'pointer',
                    fontWeight: 800,
                    fontSize: 12,
                  }}
                >
                  🎤 {recording ? '...' : text.practice}
                </button>
              </div>
            </div>
          )}

          {recognition && (
            <div style={{ marginTop: 8, color: Colors.textSecondary, fontSize: 12 }}>
              <div>{recognition.text}</div>
              <div style={{ color: recognition.score >= 70 ? Colors.success : Colors.accent, fontWeight: 700 }}>
                {recognition.score}%
              </div>
            </div>
          )}

          <button
            onClick={() => void handleCultureClaim()}
            disabled={visitedCulture.includes(selectedCulture.properties.name)}
            style={{
              marginTop: 10,
              width: '100%',
              border: `1px solid ${Colors.primaryLight}`,
              background: visitedCulture.includes(selectedCulture.properties.name) ? Colors.card : Colors.primary,
              color: Colors.text,
              borderRadius: 12,
              padding: 10,
              cursor: visitedCulture.includes(selectedCulture.properties.name) ? 'default' : 'pointer',
              fontWeight: 800,
            }}
          >
            {visitedCulture.includes(selectedCulture.properties.name)
              ? (language === 'ga' ? 'Eilithe cheana' : 'Already claimed')
              : cultureNear
                ? text.claimCulture
                : (language === 'ga' ? 'Bog nios gaire chun eileamh' : 'Move closer to claim')}
          </button>
        </div>
      )}
    </div>
  );
}
