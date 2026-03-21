import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Voice from 'react-native-voice';
import Tts from 'react-native-tts';

export default function IrishSpeech({ targetPhrase, onSuccess }: { targetPhrase: string, onSuccess: () => void }) {
  const [listening, setListening] = useState(false);
  const [result, setResult] = useState('');
  const [match, setMatch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Voice.onSpeechResults = (e) => {
      const transcript = (e.value && e.value[0]) || '';
      setResult(transcript);
      if (transcript.trim().toLowerCase() === targetPhrase.trim().toLowerCase()) {
        setMatch(true);
        onSuccess();
      }
    };
    Voice.onSpeechError = (e) => setError(e.error.message);
    return () => {
      Voice.destroy().then(Voice.removeAllListeners);
    };
  }, [targetPhrase, onSuccess]);

  const startListening = async () => {
    setListening(true);
    setResult('');
    setMatch(false);
    setError(null);
    try {
      await Voice.start('ga-IE');
    } catch (e) {
      setError('Could not start voice recognition');
    }
  };

  const stopListening = async () => {
    setListening(false);
    try {
      await Voice.stop();
    } catch {}
  };

  const speak = () => {
    Tts.setDefaultLanguage('ga-IE');
    Tts.speak(targetPhrase);
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.speakButton} onPress={speak}>
        <Text style={styles.speakText}>🔊 Éist leis an Seanfhocal</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.listenButton, listening && styles.listenButtonActive]}
        onPress={listening ? stopListening : startListening}
      >
        <Text style={styles.listenText}>{listening ? '⏹ Stop' : '🎤 Abair an Seanfhocal'}</Text>
      </TouchableOpacity>
      {result ? (
        <Text style={styles.resultText}>Tú: {result}</Text>
      ) : null}
      {match ? (
        <Text style={styles.matchText}>✔️ Ceart go leor! Craic coins earned!</Text>
      ) : null}
      {error ? (
        <Text style={styles.errorText}>⚠️ {error}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', marginTop: 16 },
  speakButton: { backgroundColor: '#1a5e3c', padding: 12, borderRadius: 8, marginBottom: 10 },
  speakText: { color: 'white', fontWeight: '700' },
  listenButton: { backgroundColor: '#e67e22', padding: 12, borderRadius: 8 },
  listenButtonActive: { backgroundColor: '#cf6d17' },
  listenText: { color: 'white', fontWeight: '700' },
  resultText: { marginTop: 10, fontSize: 16 },
  matchText: { marginTop: 10, color: '#1a5e3c', fontWeight: 'bold', fontSize: 16 },
  errorText: { marginTop: 10, color: 'red' },
});
