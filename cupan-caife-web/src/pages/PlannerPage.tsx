import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { Colors } from '../constants/Colors';

type JourneyStop = {
  name: string;
  type: 'pub' | 'landmark';
  address: string;
  phrase_ga: string;
  phrase_en: string;
  lat: number;
  lon: number;
};

type Journey = {
  id: string;
  emoji: string;
  title: string;
  title_ga: string;
  region: string;
  region_ga: string;
  description: string;
  description_ga: string;
  distanceKm: number;
  durationMin: number;
  stops: JourneyStop[];
  coins: number;
};

const JOURNEYS: Journey[] = [
  {
    id: 'dublin-pub-trail',
    emoji: '🍺',
    title: 'Dublin Pub Trail',
    title_ga: 'Rian Tábhairní Bhaile Átha Cliath',
    region: 'Dublin City Centre',
    region_ga: 'Lár Bhaile Átha Cliath',
    description: 'Walk the oldest pubs in Dublin, each with a story older than the state itself.',
    description_ga: 'Siúl trí thithe tábhairne is sine Bhaile Átha Cliath, gach ceann acu le scéal níos sine ná an stát.',
    distanceKm: 2.8,
    durationMin: 90,
    stops: [
      { name: "Mulligan's", type: 'pub', address: '8 Poolbeg St, Dublin 2', phrase_ga: 'Pionta Guinness, le do thoil', phrase_en: 'A pint of Guinness, please', lat: 53.3452, lon: -6.2518 },
      { name: 'The Palace Bar', type: 'pub', address: 'Fleet St, Dublin 2', phrase_ga: 'Conas atá tú?', phrase_en: 'How are you?', lat: 53.3463, lon: -6.2570 },
      { name: "Kehoe's", type: 'pub', address: '9 Anne St South, Dublin 2', phrase_ga: 'Slán abhaile', phrase_en: 'Safe home', lat: 53.3395, lon: -6.2591 },
      { name: "Toner's", type: 'pub', address: '139 Baggot St Lower, Dublin 2', phrase_ga: 'Sláinte mhaith!', phrase_en: 'Good health!', lat: 53.3345, lon: -6.2484 },
      { name: 'The Long Hall', type: 'pub', address: '51 South Great George\'s St, Dublin 2', phrase_ga: 'Go raibh maith agat', phrase_en: 'Thank you', lat: 53.3413, lon: -6.2635 },
    ],
    coins: 100,
  },
  {
    id: 'wild-atlantic-pubs',
    emoji: '🌊',
    title: 'Wild Atlantic Pubs',
    title_ga: 'Tábhairní an Atlantaigh Fhiáin',
    region: 'Galway & Connemara',
    region_ga: 'Gaillimh & Conamara',
    description: 'From the cobbled lanes of Galway to the wild cliffs of Connemara — craic and culture all the way.',
    description_ga: 'Ó shráideanna clocha na Gaillimhe go haillte fiáine Chonamara — craic agus cultúr ar an mbealach ar fad.',
    distanceKm: 68,
    durationMin: 180,
    stops: [
      { name: 'Tigh Coilí', type: 'pub', address: 'Mainguard St, Galway', phrase_ga: 'An bhfuil Gaeilge agat?', phrase_en: 'Do you speak Irish?', lat: 53.2734, lon: -9.0514 },
      { name: 'The Quays Bar', type: 'pub', address: 'Quay St, Galway', phrase_ga: 'Cén chaoi a bhfuil tú?', phrase_en: 'How are you? (Connacht)', lat: 53.2705, lon: -9.0533 },
      { name: "Tigh Uí Chonghaile", type: 'pub', address: 'Roundstone, Connemara', phrase_ga: 'Tá sé go hálainn anseo', phrase_en: 'It is beautiful here', lat: 53.3958, lon: -9.9872 },
      { name: "King's Bar", type: 'pub', address: 'Main St, Clifden, Connemara', phrase_ga: 'Oíche mhaith', phrase_en: 'Good night', lat: 53.4894, lon: -10.0164 },
    ],
    coins: 80,
  },
  {
    id: 'trad-music-circuit',
    emoji: '🎵',
    title: 'Trad Music Circuit',
    title_ga: 'Ciorcad Ceoil Thraidisiúnta',
    region: 'County Clare',
    region_ga: 'Contae an Chláir',
    description: 'Clare is the heartbeat of Irish trad. Hit the session pubs of Doolin, Kilfenora, and Ballyvaughan.',
    description_ga: 'Is é an Clár croí an cheoil trad. Téigh go tithe tábhairne seisiúin Dhoilín, Chill Fhionnúrach, agus Bhaile Uí Bheacháin.',
    distanceKm: 32,
    durationMin: 150,
    stops: [
      { name: "Gus O'Connor's Pub", type: 'pub', address: 'Doolin, Co. Clare', phrase_ga: 'Seinnfidh muid ceol', phrase_en: 'We will play music', lat: 53.0235, lon: -9.3791 },
      { name: "McGann's Pub", type: 'pub', address: 'Doolin, Co. Clare', phrase_ga: 'Is breá liom ceol', phrase_en: 'I love music', lat: 53.0232, lon: -9.3786 },
      { name: "Vaughan's Pub", type: 'pub', address: 'Kilfenora, Co. Clare', phrase_ga: 'Tá an craic go hiontach', phrase_en: 'The craic is mighty', lat: 52.9914, lon: -9.2207 },
      { name: "Monk's Pub", type: 'pub', address: 'Ballyvaughan, Co. Clare', phrase_ga: 'Ní neart go cur le chéile', phrase_en: 'There is strength in unity', lat: 53.1129, lon: -9.1476 },
    ],
    coins: 75,
  },
  {
    id: 'heritage-craic',
    emoji: '🏰',
    title: 'Heritage & Craic',
    title_ga: 'Oidhreacht agus Craic',
    region: 'Kilkenny & Tipperary',
    region_ga: 'Cill Chainnigh & Tiobraid Árann',
    description: 'Medieval castles, ancient rock of Cashel, and pubs that have been pouring pints since before your granny\'s granny.',
    description_ga: 'Caisleáin meánaoiseacha, Carraig na Ríogh, agus tábhairní atá ag dáileadh piontaí ó aimsir na seanmháthairín.',
    distanceKm: 45,
    durationMin: 160,
    stops: [
      { name: "Kyteler's Inn", type: 'pub', address: 'Kieran St, Kilkenny', phrase_ga: 'Fáilte romhat', phrase_en: 'You are welcome', lat: 52.6531, lon: -7.2530 },
      { name: 'Marble City Bar', type: 'pub', address: 'High St, Kilkenny', phrase_ga: 'Bail ó Dhia ort', phrase_en: 'God\'s blessing on you', lat: 52.6540, lon: -7.2540 },
      { name: "Ryan's Bar", type: 'pub', address: 'Main St, Cashel, Co. Tipperary', phrase_ga: 'Is fearr Gaeilge briste ná Béarla cliste', phrase_en: 'Broken Irish is better than clever English', lat: 52.5192, lon: -7.8898 },
      { name: "Matt the Thresher's", type: 'pub', address: 'Birdhill, Co. Tipperary', phrase_ga: 'Slán go fóill', phrase_en: 'Goodbye for now', lat: 52.8125, lon: -8.2837 },
    ],
    coins: 85,
  },
];

function craicScoreFromName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return 65 + (Math.abs(hash) % 35);
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 90 ? Colors.irish.green : score >= 80 ? Colors.accent : Colors.irish.orange;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      background: `${color}22`,
      border: `1px solid ${color}66`,
      borderRadius: 999,
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 700,
      color,
    }}>
      🔥 {score}
    </span>
  );
}

export default function PlannerPage() {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const isGA = language === 'ga';
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div className="app-shell" style={{ overflowY: 'auto' }}>
      <div className="irish-bar" />

      <div style={{ padding: '14px 14px 6px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ color: Colors.irish.green, fontWeight: 800, fontSize: 11, letterSpacing: 1.2, textTransform: 'uppercase' }}>
          ☘️ {isGA ? 'Pleanálaí Cultúir' : 'Culture Planner'}
        </div>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 800, color: Colors.text, margin: 0 }}>
          {isGA ? 'Turas a Thógáil' : 'Build Your Journey'}
        </h1>
        <p style={{ color: Colors.textSecondary, fontSize: 13, margin: '4px 0 0' }}>
          {isGA
            ? '4 bealach curated trasna na hÉireann. Tabhair cuairt. Tuill CraicCoins.'
            : '4 curated routes across Ireland. Visit. Earn CraicCoins.'}
        </p>
      </div>

      {/* Stats bar */}
      <div style={{
        display: 'flex',
        gap: 8,
        padding: '8px 14px 12px',
        overflowX: 'auto',
      }}>
        {[
          { label: isGA ? 'Bealaí' : 'Routes', value: '4' },
          { label: isGA ? 'Zastávky' : 'Stops', value: '17' },
          { label: isGA ? 'Contaetha' : 'Counties', value: '6' },
          { label: isGA ? 'CraicCoins' : 'Max Coins', value: '340' },
        ].map((stat) => (
          <div key={stat.label} style={{
            flex: '0 0 auto',
            background: Colors.card,
            border: `1px solid ${Colors.border}`,
            borderRadius: 10,
            padding: '8px 12px',
            textAlign: 'center',
            minWidth: 70,
          }}>
            <div style={{ color: Colors.irish.green, fontWeight: 800, fontSize: 18 }}>{stat.value}</div>
            <div style={{ color: Colors.textMuted, fontSize: 10, fontWeight: 600 }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Journey cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 14px 80px' }}>
        {JOURNEYS.map((journey) => {
          const isExpanded = expandedId === journey.id;
          const score = craicScoreFromName(journey.id);
          return (
            <div
              key={journey.id}
              style={{
                background: Colors.surface,
                border: `1px solid ${isExpanded ? Colors.irish.green : Colors.border}`,
                borderRadius: 14,
                overflow: 'hidden',
                transition: 'border-color 0.2s',
              }}
            >
              {/* Card header */}
              <button
                onClick={() => setExpandedId(isExpanded ? null : journey.id)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '14px 14px 12px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 28, flexShrink: 0 }}>{journey.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ color: Colors.text, fontWeight: 800, fontSize: 15 }}>
                        {isGA ? journey.title_ga : journey.title}
                      </span>
                      <ScoreBadge score={score} />
                    </div>
                    <div style={{ color: Colors.textMuted, fontSize: 11, marginTop: 2 }}>
                      📍 {isGA ? journey.region_ga : journey.region}
                    </div>
                    <div style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 5, lineHeight: 1.4 }}>
                      {isGA ? journey.description_ga : journey.description}
                    </div>
                    <div style={{ display: 'flex', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
                      <span style={{ color: Colors.textMuted, fontSize: 11 }}>
                        🗺️ {journey.stops.length} {isGA ? 'stad' : 'stops'}
                      </span>
                      <span style={{ color: Colors.textMuted, fontSize: 11 }}>
                        📏 {journey.distanceKm} km
                      </span>
                      <span style={{ color: Colors.textMuted, fontSize: 11 }}>
                        ⏱️ ~{journey.durationMin} {isGA ? 'nóim' : 'min'}
                      </span>
                      <span style={{ color: Colors.gold, fontSize: 11, fontWeight: 700 }}>
                        🪙 +{journey.coins} {isGA ? 'boinn' : 'coins'}
                      </span>
                    </div>
                  </div>
                  <span style={{ color: Colors.textMuted, fontSize: 16, flexShrink: 0, transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    ▾
                  </span>
                </div>
              </button>

              {/* Expanded stops */}
              {isExpanded && (
                <div style={{ borderTop: `1px solid ${Colors.border}`, padding: '12px 14px 14px' }}>
                  <div style={{ color: Colors.textMuted, fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                    {isGA ? 'Na Stadanna' : 'The Stops'}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {journey.stops.map((stop, idx) => (
                      <div
                        key={stop.name}
                        style={{
                          display: 'flex',
                          gap: 10,
                          alignItems: 'flex-start',
                          background: Colors.card,
                          border: `1px solid ${Colors.border}`,
                          borderRadius: 10,
                          padding: '10px 12px',
                        }}
                      >
                        <div style={{
                          width: 24,
                          height: 24,
                          borderRadius: 12,
                          background: Colors.irish.green,
                          color: '#fff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 800,
                          fontSize: 12,
                          flexShrink: 0,
                        }}>
                          {idx + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ color: Colors.text, fontWeight: 700, fontSize: 13 }}>
                            {stop.type === 'pub' ? '🍺 ' : '🏛️ '}{stop.name}
                          </div>
                          <div style={{ color: Colors.textMuted, fontSize: 11, marginTop: 1 }}>{stop.address}</div>
                          <div style={{ marginTop: 6, background: Colors.background, borderRadius: 6, padding: '6px 8px' }}>
                            <span style={{ color: Colors.irish.green, fontWeight: 700, fontSize: 12 }}>{stop.phrase_ga}</span>
                            <span style={{ color: Colors.textMuted, fontSize: 11, marginLeft: 6 }}>// {stop.phrase_en}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => navigate('/map')}
                    style={{
                      width: '100%',
                      marginTop: 12,
                      background: Colors.irish.green,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 10,
                      padding: '12px 0',
                      fontWeight: 800,
                      fontSize: 14,
                      cursor: 'pointer',
                    }}
                  >
                    🗺️ {isGA ? 'Tosaigh an Turas' : 'Start Journey'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
