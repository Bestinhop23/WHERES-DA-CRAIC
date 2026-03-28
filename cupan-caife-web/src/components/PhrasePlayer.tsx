import { useState } from 'react';

type PhrasePlayerProps = {
  phraseGa: string;
  phraseEn: string;
  pronunciation: string;
};

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

    if (!response.ok) {
      throw new Error('abair-unavailable');
    }

    const data = (await response.json()) as { audioContent?: string };
    if (!data.audioContent) {
      throw new Error('empty-audio');
    }

    const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
    await audio.play();
  } catch {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ga-IE';
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }
}

export default function PhrasePlayer({ phraseGa, phraseEn, pronunciation }: PhrasePlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="phrase-card">
      <div className="phrase-title">Irish phrase to order</div>
      <div className="phrase-ga">{phraseGa}</div>
      <div className="phrase-meta">{pronunciation}</div>
      <div className="phrase-en">{phraseEn}</div>
      <button
        className="btn btn-ghost"
        onClick={async () => {
          setIsPlaying(true);
          await speakIrish(phraseGa);
          window.setTimeout(() => setIsPlaying(false), 500);
        }}
      >
        {isPlaying ? 'Playing...' : 'Tap to hear'}
      </button>
    </div>
  );
}
