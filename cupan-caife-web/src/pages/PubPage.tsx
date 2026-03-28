import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import PhrasePlayer from '../components/PhrasePlayer';
import { createCheckin, fetchPub } from '../lib/api';
import { getOrCreateUserID } from '../lib/user';
import { useLanguage } from '../contexts/LanguageContext';
import type { PubDetails } from '../types/craic';

export default function PubPage() {
  const { pubID } = useParams<{ pubID: string }>();
  const navigate = useNavigate();
  const { language } = useLanguage();
  const [pub, setPub] = useState<PubDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkinState, setCheckinState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');

  useEffect(() => {
    if (!pubID) return;
    const load = async () => {
      try {
        setLoading(true);
        setPub(await fetchPub(pubID));
      } catch {
        setPub(null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [pubID]);

  const handleCheckin = async () => {
    if (!pubID) return;
    setCheckinState('saving');
    try {
      await createCheckin(getOrCreateUserID(), pubID, 'Checked in from pub page');
      setCheckinState('done');
    } catch {
      setCheckinState('error');
    }
  };

  if (loading) {
    return <div className="app-shell"><div className="card">Loading pub...</div></div>;
  }

  if (!pub) {
    return <div className="app-shell"><div className="card">Pub not found.</div></div>;
  }

  return (
    <div className="app-shell">
      <button className="btn btn-ghost" onClick={() => navigate('/')}>
        {language === 'ga' ? 'Ar ais chuig tithe tábhairne' : 'Back to pubs'}
      </button>

      <div className="hero-card">
        <div className="hero-eyebrow">Pub profile</div>
        <h1>{pub.name}</h1>
        <p>{pub.address ?? 'Galway'}</p>
      </div>

      <div className="card">
        <div className="section-title">{language === 'ga' ? 'Tapáil chun CraicCoins a fháil' : 'Tap to earn CraicCoins'}</div>
        <p>{language === 'ga' ? 'Úsáid clib NFC an tábhairne nó tástáil go díreach leis an bhfuascailt:' : 'Use the pub NFC tag or test directly with redeem:'}</p>
        <button className="btn" onClick={() => navigate(`/redeem?pubID=${encodeURIComponent(pub.pubID)}`)}>
          {language === 'ga' ? 'Oscail an Sreabhadh Fuascailte' : 'Open Redeem Flow'}
        </button>
      </div>

      <PhrasePlayer
        phraseGa={pub.phrase.ga}
        phraseEn={pub.phrase.en}
        pronunciation={pub.phrase.pronunciation}
      />

      <div className="card">
        <div className="section-title">{language === 'ga' ? 'Imeachtaí' : 'Events'}</div>
        <ul className="plain-list">
          {pub.events.map(event => <li key={event}>{event}</li>)}
        </ul>
      </div>

      <div className="card">
        <div className="section-title">{language === 'ga' ? 'Suaitheantais' : 'Badges'}</div>
        <div className="pub-card-badges">
          {pub.badges.map(badge => <span key={badge} className="badge">{badge}</span>)}
        </div>
      </div>

      <div className="card">
        <div className="section-title">{language === 'ga' ? 'Seiceáil Isteach' : 'Check in'}</div>
        <p>{language === 'ga' ? 'Seiceáil isteach chun do chuairt a logáil agus méadrachtaí an deais a threisiú.' : 'Check in to log your visit and boost dashboard metrics.'}</p>
        <button className="btn btn-secondary" onClick={handleCheckin} disabled={checkinState === 'saving'}>
          {checkinState === 'saving'
            ? (language === 'ga' ? 'Ag seiceáil isteach...' : 'Checking in...')
            : (language === 'ga' ? 'Seiceáil isteach anois' : 'Check in now')}
        </button>
        {checkinState === 'done' && <div className="status-success">{language === 'ga' ? 'D’éirigh leis an tseiceáil isteach.' : 'Checked in successfully.'}</div>}
        {checkinState === 'error' && <div className="status-error">{language === 'ga' ? 'Theip ar an tseiceáil isteach. Bain triail eile as.' : 'Check-in failed. Try again.'}</div>}
      </div>
    </div>
  );
}
