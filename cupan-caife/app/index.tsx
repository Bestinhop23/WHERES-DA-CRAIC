import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/Colors';
import { useLanguage } from '../contexts/LanguageContext';

export default function Index() {
  const router = useRouter();
  const { setLanguage, copy } = useLanguage();

  const handleSelectLanguage = (language: 'ga' | 'en') => {
    setLanguage(language);
    router.push('/(tabs)/map');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>{copy.home.eyebrow}</Text>
        <Text style={styles.title}>{copy.home.title}</Text>
        <Text style={styles.subtitle}>{copy.home.subtitle}</Text>
      </View>

      <View style={styles.selector}>
        <TouchableOpacity
          style={styles.card}
          onPress={() => handleSelectLanguage('ga')}
          activeOpacity={0.85}
        >
          <Text style={styles.cardTitle}>{copy.home.irishLabel}</Text>
          <Text style={styles.cardHint}>{copy.home.irishHint}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.card}
          onPress={() => handleSelectLanguage('en')}
          activeOpacity={0.85}
        >
          <Text style={styles.cardTitle}>{copy.home.englishLabel}</Text>
          <Text style={styles.cardHint}>{copy.home.englishHint}</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.preview}>
        <View style={styles.previewCard}>
          <Text style={styles.previewHeading}>{copy.home.mapPreview}</Text>
        </View>
        <View style={styles.previewCard}>
          <Text style={styles.previewHeading}>{copy.home.scanPreview}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
    paddingVertical: 24,
    justifyContent: 'space-between',
  },
  hero: {
    paddingTop: 16,
    gap: 12,
  },
  eyebrow: {
    color: Colors.accent,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  title: {
    color: Colors.text,
    fontSize: 36,
    fontWeight: '800',
    lineHeight: 42,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: 16,
    lineHeight: 24,
    maxWidth: 340,
  },
  selector: {
    gap: 16,
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '800',
  },
  cardHint: {
    color: Colors.accentLight,
    fontSize: 14,
    marginTop: 8,
    lineHeight: 20,
  },
  preview: {
    gap: 12,
  },
  previewCard: {
    backgroundColor: Colors.primary,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  previewHeading: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
});
