import { useState } from 'react';
import { Colors } from '../constants/Colors';

type MenuItemData = {
  id: string;
  name: string;
  nameIrish: string;
  description: string;
  price: number;
  discountPrice: number;
  emoji: string;
  orderPhrase: string;
  pronunciation: string;
};

function speakIrish(text: string) {
  const audio = new Audio(
    `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=ga&client=tw-ob`
  );
  audio.play().catch(() => {
    // Fallback to Web Speech API if Google TTS blocked
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ga-IE';
    utterance.rate = 0.85;
    window.speechSynthesis.speak(utterance);
  });
}

export default function MenuItem({ item }: { item: MenuItemData }) {
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const discount = Math.round((1 - item.discountPrice / item.price) * 100);

  return (
    <div
      onClick={() => setExpanded(!expanded)}
      style={{
        backgroundColor: Colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        border: `1px solid ${Colors.border}`,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ fontSize: 40, marginRight: 14 }}>{item.emoji}</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: Colors.text, fontSize: 18, fontWeight: 700 }}>{item.name}</div>
          <div style={{ color: Colors.accent, fontSize: 14, fontWeight: 600, fontStyle: 'italic', marginTop: 2 }}>{item.nameIrish}</div>
          <div style={{ color: Colors.textSecondary, fontSize: 13, marginTop: 4 }}>{item.description}</div>
        </div>
        <div style={{ textAlign: 'right', marginLeft: 8 }}>
          <div style={{ color: Colors.textMuted, fontSize: 14, textDecoration: 'line-through' }}>
            €{item.price.toFixed(2)}
          </div>
          <div style={{
            backgroundColor: Colors.primary,
            borderRadius: 8,
            padding: '4px 8px',
            marginTop: 4,
          }}>
            <span style={{ color: Colors.text, fontSize: 16, fontWeight: 800 }}>€{item.discountPrice.toFixed(2)}</span>
          </div>
          <div style={{ color: Colors.accent, fontSize: 10, fontWeight: 600, marginTop: 4 }}>-{discount}% as Gaeilge</div>
        </div>
      </div>

      {expanded && (
        <div style={{ marginTop: 12 }}>
          <div style={{ height: 1, backgroundColor: Colors.border, marginBottom: 12 }} />
          <div style={{ color: Colors.textSecondary, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>🗣️ Order as Gaeilge:</div>
          <div style={{ color: Colors.accent, fontSize: 17, fontWeight: 700, fontStyle: 'italic', marginBottom: 8, lineHeight: 1.4 }}>
            "{item.orderPhrase}"
          </div>
          <div style={{ color: Colors.textMuted, fontSize: 12, marginBottom: 4 }}>Pronunciation:</div>
          <div style={{ color: Colors.text, fontSize: 15, fontWeight: 500, lineHeight: 1.5, marginBottom: 10 }}>
            🔊 {item.pronunciation}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setPlaying(true);
              speakIrish(item.orderPhrase);
              setTimeout(() => setPlaying(false), 2500);
            }}
            style={{
              width: '100%',
              backgroundColor: Colors.primary,
              borderRadius: 12,
              padding: '10px 16px',
              border: `1px solid ${Colors.primaryLight}`,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <span style={{ fontSize: 18 }}>{playing ? '🔊' : '▶️'}</span>
            <span style={{ color: Colors.text, fontSize: 14, fontWeight: 700 }}>
              {playing ? 'Playing...' : 'Hear it spoken'}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
