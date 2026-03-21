import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import shopsData from '../../data/shops.json';
import menuData from '../../data/menu.json';

export default function ShopDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const shop = shopsData.find((s) => s.id === id);

  if (!shop) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Shop not found</Text>
      </View>
    );
  }

  const featuredItems = menuData.slice(0, 5);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Shop Header */}
      <View style={styles.header}>
        <Text style={styles.headerEmoji}>☕</Text>
        <Text style={styles.shopName}>{shop.name}</Text>
        <Text style={styles.shopAddress}>{shop.address}</Text>
        <View style={styles.tagRow}>
          <View style={styles.hoursTag}>
            <Text style={styles.hoursText}>🕐 {shop.hours}</Text>
          </View>
          <View style={styles.nfcTag}>
            <Text style={styles.nfcText}>📱 NFC Ready</Text>
          </View>
        </View>
      </View>

      {/* Description */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Faoin Siopa</Text>
        <Text style={styles.sectionSubtitle}>About the Shop</Text>
        <Text style={styles.description}>{shop.description}</Text>
      </View>

      {/* How it works */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conas a oibríonn sé</Text>
        <Text style={styles.sectionSubtitle}>How it Works</Text>
        <View style={styles.howItWorks}>
          <View style={styles.howStep}>
            <Text style={styles.howStepEmoji}>🗣️</Text>
            <Text style={styles.howStepText}>
              Order your coffee in Irish at the counter
            </Text>
          </View>
          <View style={styles.howStep}>
            <Text style={styles.howStepEmoji}>📱</Text>
            <Text style={styles.howStepText}>
              Scan the NFC tag with your phone
            </Text>
          </View>
          <View style={styles.howStep}>
            <Text style={styles.howStepEmoji}>💰</Text>
            <Text style={styles.howStepText}>
              Get 20% off your order — go raibh maith agat!
            </Text>
          </View>
        </View>
      </View>

      {/* Useful phrases */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Frásaí Úsáideacha</Text>
        <Text style={styles.sectionSubtitle}>Useful Phrases</Text>
        {featuredItems.map((item) => (
          <View key={item.id} style={styles.phraseCard}>
            <Text style={styles.phraseEmoji}>{item.emoji}</Text>
            <View style={styles.phraseInfo}>
              <Text style={styles.phraseName}>{item.name}</Text>
              <Text style={styles.phraseIrish}>"{item.orderPhrase}"</Text>
              <Text style={styles.phrasePronunciation}>
                🔊 {item.pronunciation}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {/* Scan CTA */}
      <TouchableOpacity
        style={styles.scanCta}
        onPress={() => router.push('/(tabs)/scan')}
        activeOpacity={0.8}
      >
        <Text style={styles.scanCtaEmoji}>📱</Text>
        <Text style={styles.scanCtaText}>Scan do Lascaine</Text>
        <Text style={styles.scanCtaSubtext}>Scan for your Discount</Text>
      </TouchableOpacity>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          ☘️ Mol an óige agus tiocfaidh sí
        </Text>
        <Text style={styles.footerTranslation}>
          Praise the young and they will flourish
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  errorText: {
    color: Colors.text,
    fontSize: 18,
    textAlign: 'center',
    marginTop: 40,
  },
  header: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerEmoji: {
    fontSize: 56,
    marginBottom: 12,
  },
  shopName: {
    fontSize: 26,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  shopAddress: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  tagRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  hoursTag: {
    backgroundColor: Colors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  hoursText: {
    color: Colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  nfcTag: {
    backgroundColor: Colors.primary + '30',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  nfcText: {
    color: Colors.primaryLight,
    fontSize: 13,
    fontWeight: '600',
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.text,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: Colors.accent,
    fontStyle: 'italic',
    marginBottom: 14,
  },
  description: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  howItWorks: {
    gap: 12,
  },
  howStep: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  howStepEmoji: {
    fontSize: 28,
    marginRight: 14,
  },
  howStepText: {
    flex: 1,
    color: Colors.text,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
  },
  phraseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  phraseEmoji: {
    fontSize: 32,
    marginRight: 14,
  },
  phraseInfo: {
    flex: 1,
  },
  phraseName: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '700',
  },
  phraseIrish: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600',
    fontStyle: 'italic',
    marginTop: 4,
  },
  phrasePronunciation: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  scanCta: {
    backgroundColor: Colors.primary,
    margin: 20,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.primaryLight,
  },
  scanCtaEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  scanCtaText: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
  },
  scanCtaSubtext: {
    color: Colors.accentLight,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 6,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 32,
  },
  footerText: {
    color: Colors.accent,
    fontSize: 15,
    fontWeight: '700',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  footerTranslation: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
});
