import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { Colors } from '../constants/Colors';
import { useCraicCoins } from '../contexts/CraicCoinsContext';
import { useLanguage } from '../contexts/LanguageContext';
import { createCheckin, fetchPub, redeemPub } from '../lib/api';
import { getDeviceFingerprint } from '../lib/user';
import pubsData from '../data/pubs.json';

type Mode = 'culture';

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
  signedUp?: boolean;
};

type PubFilter = 'all' | 'signed' | 'unsigned';
type MarkerView = 'all' | 'pubs' | 'places';

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

type Seanfhocal = {
  irish: string;
  english: string;
};

const PRACTICE_RECORDING_MS = 7000;
const PRACTICE_SECONDS = Math.floor(PRACTICE_RECORDING_MS / 1000);

const VISITED_CULTURE_KEY = 'craic-visited-culture';

const CENTERS: Record<Mode, [number, number]> = {
  culture: [53.35, -7.26],
};

type RouteSuggestion = {
  pub: Venue;
  distanceKm: number;
};

type PlaceSearchResult = {
  id: string;
  kind: 'pub' | 'culture';
  name: string;
  subtitle: string;
  lat: number;
  lon: number;
  pub?: Venue;
  culture?: CultureFeature;
};

type PlannerTarget = {
  id: string;
  kind: 'pub' | 'culture';
  name: string;
  subtitle: string;
  lat: number;
  lon: number;
  pub?: Venue;
  culture?: CultureFeature;
};

function haversineMetres(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function distancePointToSegmentKm(lat: number, lon: number, aLat: number, aLon: number, bLat: number, bLon: number): number {
  const kmPerDegLat = 111.32;
  const cosLat = Math.cos(((lat + aLat + bLat) / 3) * Math.PI / 180);
  const kmPerDegLon = 111.32 * Math.max(0.2, cosLat);

  const px = lon * kmPerDegLon;
  const py = lat * kmPerDegLat;
  const ax = aLon * kmPerDegLon;
  const ay = aLat * kmPerDegLat;
  const bx = bLon * kmPerDegLon;
  const by = bLat * kmPerDegLat;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    const ddx = px - ax;
    const ddy = py - ay;
    return Math.sqrt(ddx * ddx + ddy * ddy);
  }

  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const ex = px - cx;
  const ey = py - cy;
  return Math.sqrt(ex * ex + ey * ey);
}

function distanceToPolylineKm(lat: number, lon: number, points: [number, number][]): number {
  if (points.length < 2) return Number.POSITIVE_INFINITY;
  let minDist = Number.POSITIVE_INFINITY;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const next = points[i];
    const d = distancePointToSegmentKm(lat, lon, prev[0], prev[1], next[0], next[1]);
    if (d < minDist) minDist = d;
  }
  return minDist;
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

async function recordAndRecognise(onRecorderReady?: (stop: () => void) => void): Promise<string> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
  const chunks: Blob[] = [];

  return new Promise((resolve, reject) => {
    const stopRecorder = () => {
      if (recorder.state !== 'inactive') recorder.stop();
    };

    onRecorderReady?.(stopRecorder);

    recorder.ondataavailable = (event) => chunks.push(event.data);
    recorder.onstop = async () => {
      window.clearTimeout(autoStopId);
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
    const autoStopId = window.setTimeout(stopRecorder, PRACTICE_RECORDING_MS);
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

function parseSeanfhocailCsv(csvText: string): Seanfhocal[] {
  return csvText
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const firstComma = line.indexOf(',');
      if (firstComma === -1) return null;
      const irish = line.slice(0, firstComma).trim().replace(/^"|"$/g, '');
      const english = line.slice(firstComma + 1).trim().replace(/^"|"$/g, '');
      if (!irish || !english) return null;
      return { irish, english };
    })
    .filter((item): item is Seanfhocal => item !== null);
}

function hashText(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function capByDistanceToCenter<T>(
  items: T[],
  maxItems: number,
  centerLat: number,
  centerLon: number,
  getLatLon: (item: T) => [number, number]
): T[] {
  if (items.length <= maxItems) return items;
  return [...items]
    .sort((a, b) => {
      const [aLat, aLon] = getLatLon(a);
      const [bLat, bLon] = getLatLon(b);
      const aDist = haversineMetres(centerLat, centerLon, aLat, aLon);
      const bDist = haversineMetres(centerLat, centerLon, bLat, bLon);
      if (aDist !== bDist) return aDist - bDist;
      if (aLat !== bLat) return aLat - bLat;
      return aLon - bLon;
    })
    .slice(0, maxItems);
}

export default function MapPage() {
  const { language } = useLanguage();
  const { userID, syncWallet, addCoins } = useCraicCoins();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Layer[]>([]);
  const routeLineRef = useRef<L.Polyline | null>(null);
  const routePinRef = useRef<L.Marker[]>([]);

  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null);
  const [selectedCulture, setSelectedCulture] = useState<CultureFeature | null>(null);
  const [cultureFeatures, setCultureFeatures] = useState<CultureFeature[]>([]);
  const [seanfhocail, setSeanfhocail] = useState<Seanfhocal[]>([]);
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
  const stopRecordingRef = useRef<(() => void) | null>(null);
  const [routeToPoint, setRouteToPoint] = useState<PlannerTarget | null>(null);
  const [plannerQuery, setPlannerQuery] = useState('');
  const [routeSummary, setRouteSummary] = useState('');
  const [routePubs, setRoutePubs] = useState<RouteSuggestion[]>([]);
  const [planningRoute, setPlanningRoute] = useState(false);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [pubFilter, setPubFilter] = useState<PubFilter>('unsigned');
  const [markerView, setMarkerView] = useState<MarkerView>('all');
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const allPubs = useMemo(() => (pubsData as Venue[]), []);
  const filteredPubs = useMemo(() => {
    if (pubFilter === 'all') return allPubs;
    if (pubFilter === 'signed') return allPubs.filter((pub) => pub.signedUp);
    return allPubs.filter((pub) => !pub.signedUp);
  }, [allPubs, pubFilter]);
  const signedPubCount = useMemo(() => allPubs.filter((pub) => pub.signedUp).length, [allPubs]);

  const text = useMemo(() => {
    if (language === 'ga') {
      return {
        header: `Tithe tabhairne + cultuir: ${filteredPubs.length}/${allPubs.length} tabhairne, ${cultureFeatures.length} ait`,
        mapTitle: 'Learscail Chultuir agus Tithe Tabhairne',
        tapToEarn: 'Tapail NFC chun CraicCoins a thuilleamh',
        tapLoading: 'Tapail ag bailiu...',
        tapDone: 'CraicCoins bronnta!',
        tapError: 'Theip ar an tapail',
        checkin: 'Seiceail isteach',
        checkinDone: 'Seicealadh isteach',
        checkinError: 'Theip ar an tseiceail isteach',
        speakPhrase: 'Eist leis an bhfraisa',
        events: 'Imeachtai',
        noEvents: 'Nior luchtaigh imeachtai don tabhairne seo.',
        claimCulture: 'Eileamh +5 CraicCoins',
        practice: `Cleachtadh frasa (${PRACTICE_SECONDS}s)`,
        stopPractice: 'Stad agus Scorail',
        routeTitle: 'Plean Bealaigh Tithe Tabhairne',
        routeFromMe: 'Tosach: Mo shuiochán',
        routePickHint: 'Cliceáil ponc tabhairne/áite, no cuardaigh anseo',
        routeToSearch: 'Cuardaigh ceann scriobe',
        routeNoGps: 'Cumasaigh suiochán chun pleanáil a dhéanamh',
        routeNoDestination: 'Roghnaigh ceann scriobe ar dtús',
        routeSelected: 'Ceann scriobe roghnaithe',
        routePlan: 'Pleanail bealach',
        routeClear: 'Glan bealach',
        routeNearby: 'TabhairnI gar don bhealach',
        searchTitle: 'Cuardaigh Ait',
        searchPlaceholder: 'Cuardaigh tabhairne no ait...',
        searchNoResults: 'Nior aimsiodh aon toradh',
        filterAll: 'Uile',
        filterSigned: 'Sinithe',
        filterUnsigned: 'Gan Siniu',
        showAllMarkers: 'Uile',
        showPubsOnly: 'Tithe',
        showPlacesOnly: 'Aiteanna',
        signedSummary: `Sinithe: ${signedPubCount}`,
        menuTitle: 'Roghanna Learscaile',
        menuPubFilters: 'Scagaire Tithe Tabhairne',
        menuLayerFilters: 'Cad a fheiceann tu',
        close: 'Dun',
        website: 'Suibheas',
        phone: 'Fón',
      };
    }

    return {
      header: `Pubs + culture: ${filteredPubs.length}/${allPubs.length} pubs, ${cultureFeatures.length} spots`,
      mapTitle: 'Culture and Pubs Map',
      tapToEarn: 'Tap NFC to earn CraicCoins',
      tapLoading: 'Processing tap...',
      tapDone: 'CraicCoins awarded!',
      tapError: 'Tap failed',
      checkin: 'Check in',
      checkinDone: 'Checked in',
      checkinError: 'Check-in failed',
      speakPhrase: 'Hear phrase',
      events: 'Events',
      noEvents: 'No pub events loaded for this location.',
      claimCulture: 'Claim +5 CraicCoins',
      practice: `Practice phrase (${PRACTICE_SECONDS}s)`,
      stopPractice: 'Stop and score',
      routeTitle: 'Pub Route Planner',
      routeFromMe: 'Start: My location',
      routePickHint: 'Click any pub/place dot, or search below',
      routeToSearch: 'Search destination',
      routeNoGps: 'Enable location to plan route',
      routeNoDestination: 'Pick a destination first',
      routeSelected: 'Destination selected',
      routePlan: 'Plan route',
      routeClear: 'Clear route',
      routeNearby: 'Pubs near this route',
      searchTitle: 'Find A Place',
      searchPlaceholder: 'Search pub or place...',
      searchNoResults: 'No places found',
      filterAll: 'All',
      filterSigned: 'Signed up',
      filterUnsigned: 'Not signed up',
      showAllMarkers: 'Both',
      showPubsOnly: 'Pubs',
      showPlacesOnly: 'Places',
      signedSummary: `Signed up: ${signedPubCount}`,
      menuTitle: 'Map Options',
      menuPubFilters: 'Pub Filter',
      menuLayerFilters: 'Visible Layers',
      close: 'Close',
      website: 'Website',
      phone: 'Phone',
    };
  }, [language, cultureFeatures.length, allPubs.length, filteredPubs.length, signedPubCount]);

  useEffect(() => {
    fetch('/ireland_culture.geojson')
      .then((response) => response.json())
      .then((data: CultureGeoJSON) => setCultureFeatures(data.features ?? []))
      .catch(() => setCultureFeatures([]));
  }, []);

  useEffect(() => {
    fetch('/seanfhocail_50.csv')
      .then((response) => response.text())
      .then((csvText) => setSeanfhocail(parseSeanfhocailCsv(csvText)))
      .catch(() => setSeanfhocail([]));
  }, []);

  const selectedSeanfhocal = useMemo(() => {
    if (!selectedCulture || seanfhocail.length === 0) return null;
    const index = hashText(selectedCulture.properties.name) % seanfhocail.length;
    return seanfhocail[index];
  }, [selectedCulture, seanfhocail]);

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
      center: CENTERS.culture,
      zoom: 7,
      zoomControl: false,
      attributionControl: true,
      inertia: true,
      fadeAnimation: true,
      zoomAnimation: true,
      markerZoomAnimation: true,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

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
  }, []);

  const cultureNear = useMemo(() => {
    if (!selectedCulture || !userPos) return false;
    const [lng, lat] = selectedCulture.geometry.coordinates;
    return haversineMetres(userPos.lat, userPos.lng, lat, lng) <= 200;
  }, [selectedCulture, userPos]);

  const placeMarkers = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;

    const bounds = map.getBounds().pad(0.22);
    const zoom = map.getZoom();
    const center = map.getCenter();

    const pubMarkerSize = zoom <= 8 ? 20 : zoom <= 10 ? 26 : 32;
    const placeDotRadius = zoom <= 6 ? 2 : zoom <= 8 ? 2.5 : zoom <= 10 ? 3 : 3.8;
    const pubEmojiSize = zoom <= 6 ? 11 : zoom <= 8 ? 12 : 14;
    const placeBubbleSize = zoom <= 10 ? 24 : zoom <= 12 ? 28 : 32;
    const placeEmojiSize = zoom <= 10 ? 12 : zoom <= 12 ? 13 : 14;

    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    const pubIcon = L.divIcon({
      html: `<div style="
        background:#7B2D00;
        border:2px solid #D4722A;
        border-radius:50%;
        width:${pubMarkerSize}px;
        height:${pubMarkerSize}px;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size:${pubEmojiSize}px;
        box-shadow:0 2px 12px rgba(123,45,0,0.45);
      ">🍺</div>`,
      className: '',
      iconSize: [pubMarkerSize, pubMarkerSize],
      iconAnchor: [pubMarkerSize / 2, pubMarkerSize / 2],
    });

    const pubsVisibleAtZoom = zoom >= 10;
    const placeBubblesVisibleAtZoom = zoom >= 10;

    if (markerView !== 'places' && pubsVisibleAtZoom) {
      const pubsInView = filteredPubs.filter((pub) => bounds.contains([pub.latitude, pub.longitude]));
      const maxPubs = zoom <= 10 ? 160 : zoom <= 12 ? 320 : 560;
      const pubsToRender = capByDistanceToCenter(
        pubsInView,
        maxPubs,
        center.lat,
        center.lng,
        (pub) => [pub.latitude, pub.longitude]
      );

      pubsToRender.forEach((pub) => {
        const marker = L.marker([pub.latitude, pub.longitude], { icon: pubIcon }).addTo(map);
        marker.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          if (plannerOpen) {
            setRouteToPoint({
              id: `planner-pub-${pub.nfcTagId}`,
              kind: 'pub',
              name: pub.name,
              subtitle: pub.address || '',
              lat: pub.latitude,
              lon: pub.longitude,
              pub,
            });
          }
          setSelectedVenue(pub);
          setSelectedCulture(null);
          map.flyTo([pub.latitude - 0.002, pub.longitude], 14, { duration: 0.45 });
        });
        markersRef.current.push(marker);
      });
    }

    if (markerView !== 'pubs') {
      const cultureInView = cultureFeatures.filter((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        return bounds.contains([lat, lng]);
      });

      cultureInView.forEach((feature) => {
        const [lng, lat] = feature.geometry.coordinates;
        const visited = visitedCulture.includes(feature.properties.name);

        const marker = placeBubblesVisibleAtZoom
          ? L.marker([lat, lng], {
              icon: L.divIcon({
                html: `<div style="
                  background:${visited ? Colors.success : Colors.primary};
                  border:2px solid ${visited ? '#fff' : Colors.accent};
                  border-radius:50%;
                  width:${placeBubbleSize}px;
                  height:${placeBubbleSize}px;
                  display:flex;
                  align-items:center;
                  justify-content:center;
                  font-size:${placeEmojiSize}px;
                ">${visited ? '✅' : '☘️'}</div>`,
                className: '',
                iconSize: [placeBubbleSize, placeBubbleSize],
                iconAnchor: [placeBubbleSize / 2, placeBubbleSize / 2],
              }),
            }).addTo(map)
          : L.circleMarker([lat, lng], {
              radius: placeDotRadius,
              color: visited ? '#b7f0c5' : '#2ea043',
              fillColor: visited ? '#57d17b' : '#2ea043',
              fillOpacity: visited ? 0.9 : 0.8,
              weight: 1,
            }).addTo(map);

        marker.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          if (plannerOpen) {
            setRouteToPoint({
              id: `planner-culture-${feature.properties.name}`,
              kind: 'culture',
              name: feature.properties.name,
              subtitle: feature.properties.county || '',
              lat,
              lon: lng,
              culture: feature,
            });
          }
          setSelectedCulture(feature);
          setSelectedVenue(null);
          if (map.getZoom() < 11) {
            map.flyTo([lat - 0.004, lng], 11, { duration: 0.45 });
          } else {
            map.flyTo([lat - 0.004, lng], map.getZoom(), { duration: 0.35 });
          }
        });
        markersRef.current.push(marker);
      });
    }
  }, [filteredPubs, cultureFeatures, visitedCulture, markerView, plannerOpen]);

  useEffect(() => {
    placeMarkers();
  }, [placeMarkers]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const refresh = () => placeMarkers();
    map.on('moveend', refresh);
    map.on('zoomend', refresh);
    return () => {
      map.off('moveend', refresh);
      map.off('zoomend', refresh);
    };
  }, [placeMarkers]);

  useEffect(() => {
    if (!selectedVenue) {
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
  }, [selectedVenue]);

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

  const clearRoutePlan = () => {
    routeLineRef.current?.remove();
    routeLineRef.current = null;
    routePinRef.current.forEach((marker) => marker.remove());
    routePinRef.current = [];
    setRouteSummary('');
    setRoutePubs([]);
  };

  const placeSearchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [] as PlaceSearchResult[];

    const pubResults: PlaceSearchResult[] = filteredPubs.map((pub) => ({
      id: `pub-${pub.nfcTagId}`,
      kind: 'pub',
      name: pub.name,
      subtitle: pub.address || '',
      lat: pub.latitude,
      lon: pub.longitude,
      pub,
    }));

    const cultureResults: PlaceSearchResult[] = cultureFeatures.map((feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      const county = feature.properties.county || '';
      return {
        id: `culture-${feature.properties.name}`,
        kind: 'culture',
        name: feature.properties.name,
        subtitle: county,
        lat,
        lon,
        culture: feature,
      };
    });

    return [...pubResults, ...cultureResults]
      .filter((item) => {
        const haystack = `${item.name} ${item.subtitle}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 16);
  }, [searchQuery, filteredPubs, cultureFeatures]);

  const plannerSearchResults = useMemo(() => {
    const query = plannerQuery.trim().toLowerCase();
    if (!query) return [] as PlannerTarget[];

    const pubResults: PlannerTarget[] = filteredPubs.map((pub) => ({
      id: `planner-pub-${pub.nfcTagId}`,
      kind: 'pub',
      name: pub.name,
      subtitle: pub.address || '',
      lat: pub.latitude,
      lon: pub.longitude,
      pub,
    }));

    const cultureResults: PlannerTarget[] = cultureFeatures.map((feature) => {
      const [lon, lat] = feature.geometry.coordinates;
      return {
        id: `planner-culture-${feature.properties.name}`,
        kind: 'culture',
        name: feature.properties.name,
        subtitle: feature.properties.county || '',
        lat,
        lon,
        culture: feature,
      };
    });

    return [...pubResults, ...cultureResults]
      .filter((item) => {
        const haystack = `${item.name} ${item.subtitle}`.toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 12);
  }, [plannerQuery, filteredPubs, cultureFeatures]);

  const handleSelectPlaceSearchResult = (result: PlaceSearchResult) => {
    const map = mapRef.current;
    if (!map) return;

    if (result.kind === 'pub' && result.pub) {
      setSelectedVenue(result.pub);
      setSelectedCulture(null);
      map.flyTo([result.lat - 0.002, result.lon], 14, { duration: 0.45 });
    } else if (result.kind === 'culture' && result.culture) {
      setSelectedCulture(result.culture);
      setSelectedVenue(null);
      map.flyTo([result.lat - 0.004, result.lon], 11, { duration: 0.45 });
    }

    setSearchOpen(false);
    setSearchQuery('');
  };

  const handlePlanRoute = async () => {
    const map = mapRef.current;
    if (!map || !userPos || !routeToPoint) return;

    const fromLat = userPos.lat;
    const fromLon = userPos.lng;
    const toLat = routeToPoint.lat;
    const toLon = routeToPoint.lon;

    setPlanningRoute(true);
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}?overview=full&geometries=geojson`;
      const response = await fetch(url);
      const data = await response.json();
      const route = data?.routes?.[0];
      if (!route?.geometry?.coordinates) throw new Error('route-failed');

      const points: [number, number][] = route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]]);
      clearRoutePlan();

      routeLineRef.current = L.polyline(points, {
        color: '#e67e22',
        weight: 5,
        opacity: 0.8,
        dashArray: '8 5',
      }).addTo(map);

      const fromPin = L.marker([fromLat, fromLon], {
        icon: L.divIcon({
          className: '',
          html: '<div style="background:#169B62;color:#fff;border:2px solid #fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:800">A</div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).addTo(map);

      const toPin = L.marker([toLat, toLon], {
        icon: L.divIcon({
          className: '',
          html: '<div style="background:#7B2D00;color:#fff;border:2px solid #fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-weight:800">B</div>',
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        }),
      }).addTo(map);
      routePinRef.current = [fromPin, toPin];

      const distanceKm = Math.round((route.distance || 0) / 1000);
      const durationMin = Math.round((route.duration || 0) / 60);
      setRouteSummary(`${distanceKm} km · ${durationMin} min`);

      const nearby = filteredPubs
        .map((pub) => ({
          pub,
          distanceKm: distanceToPolylineKm(pub.latitude, pub.longitude, points),
        }))
        .filter((item) => item.distanceKm <= 5)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, 8);
      setRoutePubs(nearby);

      map.fitBounds(routeLineRef.current.getBounds(), { padding: [40, 40] });
    } catch {
      clearRoutePlan();
      setRouteSummary(language === 'ga' ? 'Theip ar phleanail an bhealaigh' : 'Could not plan route');
    } finally {
      setPlanningRoute(false);
    }
  };

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <style>{`
        .leaflet-control-zoom {
          border: none !important;
          box-shadow: 0 8px 18px rgba(0, 0, 0, 0.35) !important;
          border-radius: 12px !important;
          overflow: hidden;
          margin-right: 12px !important;
          margin-bottom: 92px !important;
        }
        .leaflet-control-zoom a {
          width: 36px !important;
          height: 36px !important;
          line-height: 36px !important;
          font-size: 20px !important;
          font-weight: 700 !important;
          color: #f0f6fc !important;
          background: rgba(13, 17, 23, 0.95) !important;
          border: 1px solid #30363d !important;
        }
        .leaflet-control-zoom a:hover {
          background: #7b2d00 !important;
          color: #ffffff !important;
        }
      `}</style>
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

      <button
        onClick={() => setMenuOpen((v) => !v)}
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          zIndex: 1300,
          width: 56,
          height: 56,
          borderRadius: 28,
          border: '1px solid #D4722A',
          background: menuOpen ? '#7B2D00' : 'rgba(13, 17, 23, 0.96)',
          color: '#fff',
          fontWeight: 800,
          cursor: 'pointer',
          boxShadow: '0 8px 18px rgba(0,0,0,0.35)',
          fontSize: 20,
        }}
        title={text.menuTitle}
      >
        ☰
      </button>

      {menuOpen && (
        <div style={{
          position: 'absolute',
          top: 84,
          left: 16,
          zIndex: 1250,
          width: 'min(340px, calc(100vw - 32px))',
          maxHeight: 'calc(100vh - 176px)',
          overflowY: 'auto',
          backgroundColor: 'rgba(13, 17, 23, 0.97)',
          borderRadius: 14,
          border: `1px solid ${Colors.border}`,
          padding: 10,
          boxShadow: '0 10px 26px rgba(0,0,0,0.4)',
        }}>
          <div style={{ color: Colors.text, fontSize: 16, fontWeight: 800 }}>
            🍺☘️ {text.mapTitle}
          </div>
          <div style={{ color: Colors.accent, fontSize: 12, fontWeight: 600, marginTop: 2 }}>
            {text.header}
          </div>

          <div style={{ color: Colors.textMuted, fontSize: 11, fontWeight: 700, marginTop: 10, marginBottom: 6 }}>
            {text.menuPubFilters}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {([
              ['all', text.filterAll],
              ['signed', text.filterSigned],
              ['unsigned', text.filterUnsigned],
            ] as Array<[PubFilter, string]>).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setPubFilter(value)}
                style={{
                  flex: 1,
                  borderRadius: 999,
                  border: `1px solid ${pubFilter === value ? '#D4722A' : Colors.border}`,
                  background: pubFilter === value ? '#7B2D00' : Colors.card,
                  color: Colors.text,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '6px 6px',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ color: Colors.textMuted, fontSize: 11, fontWeight: 700, marginTop: 10, marginBottom: 6 }}>
            {text.menuLayerFilters}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {([
              ['all', text.showAllMarkers],
              ['pubs', text.showPubsOnly],
              ['places', text.showPlacesOnly],
            ] as Array<[MarkerView, string]>).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setMarkerView(value)}
                style={{
                  flex: 1,
                  borderRadius: 999,
                  border: `1px solid ${markerView === value ? Colors.accent : Colors.border}`,
                  background: markerView === value ? Colors.primary : Colors.card,
                  color: Colors.text,
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '6px 6px',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 10, fontWeight: 700 }}>
            {text.signedSummary}
          </div>
        </div>
      )}

      <button
        onClick={() => setPlannerOpen((v) => !v)}
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          zIndex: 1100,
          width: 56,
          height: 56,
          borderRadius: 28,
          border: '1px solid #D4722A',
          background: plannerOpen ? '#7B2D00' : 'rgba(13, 17, 23, 0.96)',
          color: '#fff',
          fontWeight: 800,
          cursor: 'pointer',
          boxShadow: '0 8px 18px rgba(0,0,0,0.35)',
        }}
        title={text.routeTitle}
      >
        🧭
      </button>

      <button
        onClick={() => setSearchOpen((v) => !v)}
        style={{
          position: 'absolute',
          left: 16,
          bottom: 16,
          zIndex: 1200,
          width: 56,
          height: 56,
          borderRadius: 28,
          border: '1px solid #D4722A',
          background: searchOpen ? '#7B2D00' : 'rgba(13, 17, 23, 0.96)',
          color: '#fff',
          fontWeight: 800,
          cursor: 'pointer',
          boxShadow: '0 8px 18px rgba(0,0,0,0.35)',
          fontSize: 20,
        }}
        title={text.searchTitle}
      >
        🔍
      </button>

      {searchOpen && (
        <div style={{
          position: 'absolute',
          left: 16,
          bottom: 84,
          zIndex: 1200,
          width: 'min(420px, calc(100vw - 24px))',
          backgroundColor: 'rgba(13, 17, 23, 0.97)',
          borderRadius: 14,
          border: `1px solid ${Colors.border}`,
          padding: 10,
        }}>
          <div style={{ color: Colors.accent, fontSize: 11, fontWeight: 800, marginBottom: 6 }}>{text.searchTitle}</div>
          <input
            autoFocus
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={text.searchPlaceholder}
            style={{
              width: '100%',
              background: Colors.surface,
              color: Colors.text,
              border: `1px solid ${Colors.border}`,
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 12,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          <div style={{ marginTop: 8, display: 'grid', gap: 5, maxHeight: 220, overflowY: 'auto' }}>
            {searchQuery.trim().length > 0 && placeSearchResults.length === 0 && (
              <div style={{ color: Colors.textMuted, fontSize: 12 }}>{text.searchNoResults}</div>
            )}

            {placeSearchResults.map((result) => (
              <button
                key={result.id}
                onClick={() => handleSelectPlaceSearchResult(result)}
                style={{
                  textAlign: 'left',
                  background: Colors.surface,
                  border: `1px solid ${Colors.border}`,
                  color: Colors.text,
                  borderRadius: 8,
                  padding: '7px 8px',
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 700 }}>{result.kind === 'pub' ? '🍺' : '☘️'} {result.name}</div>
                {!!result.subtitle && <div style={{ color: Colors.textSecondary, fontSize: 11, marginTop: 2 }}>{result.subtitle}</div>}
              </button>
            ))}
          </div>
        </div>
      )}

      {plannerOpen && (
        <div style={{
          position: 'absolute',
          top: 84,
          right: 16,
          zIndex: 1100,
          width: 'min(420px, calc(100vw - 24px))',
          backgroundColor: 'rgba(13, 17, 23, 0.97)',
          borderRadius: 14,
          border: `1px solid ${Colors.border}`,
          padding: 10,
        }}>
          <div style={{ marginTop: 0, backgroundColor: Colors.card, borderRadius: 14, padding: 8 }}>
          <div style={{ color: Colors.accent, fontSize: 11, fontWeight: 800, marginBottom: 6 }}>{text.routeTitle}</div>
          <div style={{
            background: Colors.surface,
            border: `1px solid ${Colors.border}`,
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 12,
            color: Colors.textSecondary,
            marginBottom: 6,
          }}>
            📍 {text.routeFromMe}
          </div>
          <div style={{ color: Colors.textMuted, fontSize: 11, marginBottom: 6 }}>{text.routePickHint}</div>

          <input
            value={plannerQuery}
            onChange={(e) => setPlannerQuery(e.target.value)}
            placeholder={text.routeToSearch}
            style={{
              width: '100%',
              background: Colors.surface,
              color: Colors.text,
              border: `1px solid ${Colors.border}`,
              borderRadius: 8,
              padding: '8px 10px',
              fontSize: 12,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          {plannerQuery.trim().length > 0 && (
            <div style={{ marginTop: 6, display: 'grid', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
              {plannerSearchResults.map((result) => (
                <button
                  key={result.id}
                  onClick={() => {
                    setRouteToPoint(result);
                    setPlannerQuery('');
                    if (result.kind === 'pub' && result.pub) {
                      setSelectedVenue(result.pub);
                      setSelectedCulture(null);
                      mapRef.current?.flyTo([result.lat - 0.002, result.lon], 14, { duration: 0.45 });
                    } else if (result.kind === 'culture' && result.culture) {
                      setSelectedCulture(result.culture);
                      setSelectedVenue(null);
                      mapRef.current?.flyTo([result.lat - 0.004, result.lon], 11, { duration: 0.45 });
                    }
                  }}
                  style={{
                    textAlign: 'left',
                    background: Colors.surface,
                    border: `1px solid ${Colors.border}`,
                    color: Colors.text,
                    borderRadius: 8,
                    padding: '6px 8px',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}
                >
                  {result.kind === 'pub' ? '🍺' : '☘️'} {result.name}
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: 6, color: Colors.textSecondary, fontSize: 12 }}>
            {routeToPoint
              ? `🎯 ${text.routeSelected}: ${routeToPoint.name}`
              : `⚠️ ${text.routeNoDestination}`}
          </div>

          {!userPos && (
            <div style={{ marginTop: 4, color: Colors.error, fontSize: 12 }}>{text.routeNoGps}</div>
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button
              onClick={() => void handlePlanRoute()}
              disabled={planningRoute || !userPos || !routeToPoint}
              style={{
                flex: 1,
                background: '#7B2D00',
                border: '1px solid #D4722A',
                color: Colors.text,
                borderRadius: 9,
                padding: '8px 0',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                opacity: planningRoute || !userPos || !routeToPoint ? 0.6 : 1,
              }}
            >
              {planningRoute ? '...' : text.routePlan}
            </button>
            <button
              onClick={() => {
                clearRoutePlan();
                setRouteToPoint(null);
              }}
              style={{
                background: Colors.surface,
                border: `1px solid ${Colors.border}`,
                color: Colors.textSecondary,
                borderRadius: 9,
                padding: '8px 10px',
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {text.routeClear}
            </button>
          </div>
          {!!routeSummary && (
            <div style={{ marginTop: 6, color: Colors.textSecondary, fontSize: 12, fontWeight: 700 }}>
              {routeSummary}
            </div>
          )}
          {routePubs.length > 0 && (
            <div style={{ marginTop: 6 }}>
              <div style={{ color: Colors.accent, fontSize: 11, fontWeight: 800, marginBottom: 4 }}>{text.routeNearby}</div>
              <div style={{ display: 'grid', gap: 4, maxHeight: 88, overflowY: 'auto' }}>
                {routePubs.map((item) => (
                  <button
                    key={`route-pub-${item.pub.nfcTagId}`}
                    onClick={() => {
                      setSelectedVenue(item.pub);
                      mapRef.current?.flyTo([item.pub.latitude, item.pub.longitude], 14, { duration: 0.45 });
                      setPlannerOpen(false);
                    }}
                    style={{
                      textAlign: 'left',
                      background: Colors.surface,
                      border: `1px solid ${Colors.border}`,
                      color: Colors.text,
                      borderRadius: 8,
                      padding: '6px 8px',
                      fontSize: 11,
                      cursor: 'pointer',
                    }}
                  >
                    {item.pub.name} · {item.distanceKm.toFixed(1)}km
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      )}

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

          {!!selectedSeanfhocal && (
            <div style={{ marginTop: 10, background: Colors.background, borderRadius: 10, border: `1px solid ${Colors.border}`, padding: 10 }}>
              <div style={{ color: Colors.accent, fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                {language === 'ga' ? 'Seanfhocal an Lae' : 'Seanfhocal'}
              </div>
              <div style={{ color: Colors.irish.green, fontWeight: 700 }}>{selectedSeanfhocal.irish}</div>
              <div style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                {selectedSeanfhocal.english}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => void speakIrish(selectedSeanfhocal.irish)}
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
                    if (recording) {
                      stopRecordingRef.current?.();
                      return;
                    }
                    setRecording(true);
                    setRecognition(null);
                    try {
                      const spoken = await recordAndRecognise((stop) => {
                        stopRecordingRef.current = stop;
                      });
                      const target = selectedSeanfhocal.irish;
                      setRecognition({ text: spoken, score: similarityScore(spoken, target) });
                    } catch {
                      setRecognition({ text: language === 'ga' ? 'Theip ar aithint gutha' : 'Speech recognition failed', score: 0 });
                    }
                    stopRecordingRef.current = null;
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
                  🎤 {recording ? text.stopPractice : text.practice}
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
