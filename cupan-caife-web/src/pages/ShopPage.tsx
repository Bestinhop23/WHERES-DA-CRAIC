import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Colors } from '../constants/Colors';
import { useLanguage } from '../contexts/LanguageContext';
import shopsData from '../data/shops.json';
import menuData from '../data/menu.json';

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
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ga-IE';
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  }
}

export default function ShopPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { copy } = useLanguage();
  const [playingId, setPlayingId] = useState<string | null>(null);
  const shop = shopsData.find(s => s.id === id);

  if (!shop) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: Colors.text }}>
        {copy.shop.notFound}
      </div>
    );
  }

  const featuredItems = menuData.slice(0, 5);

  return (
    <div style={{ height: '100%', overflow: 'auto', backgroundColor: Colors.background }}>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '16px 20px', color: Colors.accent, fontSize: 16, fontWeight: 600 }}
      >
        ← Back
      </button>

      {/* Header */}
      <div style={{
        textAlign: 'center', padding: 24, backgroundColor: Colors.surface,
        borderBottom: `1px solid ${Colors.border}`,
      }}>
        <span style={{ fontSize: 56, display: 'block', marginBottom: 12 }}>☕</span>
        <h1 style={{ color: Colors.text, fontSize: 26, fontWeight: 800, margin: 0 }}>{shop.name}</h1>
        <p style={{ color: Colors.textSecondary, fontSize: 14, marginTop: 6 }}>{shop.address}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16 }}>
          <span style={{ backgroundColor: Colors.card, borderRadius: 10, padding: '8px 14px', color: Colors.textSecondary, fontSize: 13, fontWeight: 600 }}>
            🕐 {shop.hours}
          </span>
          <span style={{ backgroundColor: Colors.primary + '30', borderRadius: 10, padding: '8px 14px', color: Colors.primaryLight, fontSize: 13, fontWeight: 600 }}>
            📱 {copy.shop.nfcReady}
          </span>
        </div>
      </div>

      {/* About */}
      <div style={{ padding: 20, borderBottom: `1px solid ${Colors.border}` }}>
        <h2 style={{ color: Colors.text, fontSize: 20, fontWeight: 800, margin: 0 }}>{copy.shop.aboutTitle}</h2>
        <p style={{ color: Colors.accent, fontSize: 13, fontStyle: 'italic', marginBottom: 14 }}>{copy.shop.aboutSubtitle}</p>
        <p style={{ color: Colors.textSecondary, fontSize: 15, lineHeight: 1.5 }}>{shop.description}</p>
      </div>

      {/* How it works */}
      <div style={{ padding: 20, borderBottom: `1px solid ${Colors.border}` }}>
        <h2 style={{ color: Colors.text, fontSize: 20, fontWeight: 800, margin: 0 }}>{copy.shop.howTitle}</h2>
        <p style={{ color: Colors.accent, fontSize: 13, fontStyle: 'italic', marginBottom: 14 }}>{copy.shop.howSubtitle}</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {['🗣️', '📱', '💰'].map((emoji, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', backgroundColor: Colors.surface,
              borderRadius: 14, padding: 16, border: `1px solid ${Colors.border}`,
            }}>
              <span style={{ fontSize: 28, marginRight: 14 }}>{emoji}</span>
              <span style={{ color: Colors.text, fontSize: 14, fontWeight: 500, lineHeight: 1.4 }}>{copy.shop.howSteps[i]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Phrases */}
      <div style={{ padding: 20, borderBottom: `1px solid ${Colors.border}` }}>
        <h2 style={{ color: Colors.text, fontSize: 20, fontWeight: 800, margin: 0 }}>{copy.shop.phrasesTitle}</h2>
        <p style={{ color: Colors.accent, fontSize: 13, fontStyle: 'italic', marginBottom: 14 }}>{copy.shop.phrasesSubtitle}</p>
        {featuredItems.map(item => (
          <div key={item.id} style={{
            backgroundColor: Colors.surface,
            borderRadius: 14, padding: 14, marginBottom: 8, border: `1px solid ${Colors.border}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 32, marginRight: 14 }}>{item.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ color: Colors.text, fontSize: 15, fontWeight: 700 }}>{item.name}</div>
                <div style={{ color: Colors.accent, fontSize: 13, fontWeight: 600, fontStyle: 'italic', marginTop: 4 }}>
                  "{item.orderPhrase}"
                </div>
                <div style={{ color: Colors.textSecondary, fontSize: 12, marginTop: 4 }}>🔊 {item.pronunciation}</div>
              </div>
              <button
                onClick={() => {
                  setPlayingId(item.id);
                  speakIrish(item.orderPhrase);
                  setTimeout(() => setPlayingId(null), 2500);
                }}
                style={{
                  width: 40, height: 40, borderRadius: 20,
                  backgroundColor: Colors.primary, border: `1px solid ${Colors.primaryLight}`,
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0, marginLeft: 8,
                }}
              >{playingId === item.id ? '🔊' : '🔈'}</button>
            </div>
          </div>
        ))}
      </div>

      {/* Scan CTA */}
      <button
        onClick={() => navigate('/scan')}
        style={{
          display: 'block', width: 'calc(100% - 40px)', margin: '20px auto',
          backgroundColor: Colors.primary, borderRadius: 20, padding: 28,
          border: `2px solid ${Colors.primaryLight}`, cursor: 'pointer', textAlign: 'center',
        }}
      >
        <span style={{ fontSize: 48, display: 'block', marginBottom: 12 }}>📱</span>
        <div style={{ color: Colors.text, fontSize: 22, fontWeight: 800 }}>{copy.shop.scanTitle}</div>
        <div style={{ color: Colors.accentLight, fontSize: 14, fontWeight: 600, marginTop: 6 }}>{copy.shop.scanSubtitle}</div>
      </button>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '20px 32px 40px' }}>
        <p style={{ color: Colors.accent, fontSize: 15, fontWeight: 700, fontStyle: 'italic' }}>☘️ {copy.shop.footerText}</p>
        <p style={{ color: Colors.textMuted, fontSize: 12, fontStyle: 'italic', marginTop: 4 }}>{copy.shop.footerTranslation}</p>
      </div>
    </div>
  );
}
