import React, { useEffect, useState } from 'react';
import {
  Animated,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/Colors';
import { useLanguage } from '../../contexts/LanguageContext';
import shopsData from '../../data/shops.json';

type ScanState =
  | 'idle'
  | 'selecting'
  | 'ready'
  | 'scanning'
  | 'success'
  | 'error';

export default function ScanScreen() {
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [selectedShop, setSelectedShop] = useState<
    (typeof shopsData)[number] | null
  >(null);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [successAnim] = useState(new Animated.Value(0));
  const { copy } = useLanguage();

  useEffect(() => {
    setNfcSupported(false);
  }, []);

  useEffect(() => {
    if (scanState === 'ready' || scanState === 'scanning') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.15,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    }
  }, [pulseAnim, scanState]);

  const handleShopChosen = (shop: (typeof shopsData)[number]) => {
    setSelectedShop(shop);
    setScanState('ready');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleScanSuccess = () => {
    setScanState('success');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Animated.spring(successAnim, {
      toValue: 1,
      tension: 50,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const handleScan = () => {
    setScanState('scanning');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(handleScanSuccess, nfcSupported ? 2000 : 2500);
  };

  const handleReset = () => {
    setScanState('idle');
    setSelectedShop(null);
    successAnim.setValue(0);
    pulseAnim.setValue(1);
  };

  const renderIdle = () => (
    <View style={styles.centerContent}>
      <Text style={styles.scanIcon}>📱</Text>
      <Text style={styles.title}>{copy.scan.title}</Text>
      <Text style={styles.subtitle}>{copy.scan.subtitle}</Text>
      <Text style={styles.instructions}>{copy.scan.instructions}</Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={() => setScanState('selecting')}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>{copy.scan.chooseShop} ☕</Text>
        <Text style={styles.buttonSubtext}>{copy.scan.chooseShopSubtext}</Text>
      </TouchableOpacity>

      <View style={styles.stepsContainer}>
        {copy.scan.steps.map((step, index) => (
          <View key={step} style={styles.step}>
            <Text style={styles.stepNumber}>{index + 1}</Text>
            <Text style={styles.stepText}>
              {step}
              {index === copy.scan.steps.length - 1 ? ' 🎉' : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );

  const renderSelecting = () => (
    <View style={styles.selectContent}>
      <Text style={styles.selectTitle}>{copy.scan.selectingTitle}</Text>
      <Text style={styles.selectSubtitle}>{copy.scan.selectingSubtitle}</Text>
      {shopsData.map((shop) => (
        <TouchableOpacity
          key={shop.id}
          style={styles.shopOption}
          onPress={() => handleShopChosen(shop)}
          activeOpacity={0.7}
        >
          <Text style={styles.shopOptionEmoji}>☕</Text>
          <View style={styles.shopOptionInfo}>
            <Text style={styles.shopOptionName}>{shop.name}</Text>
            <Text style={styles.shopOptionAddress}>{shop.address}</Text>
          </View>
          <Text style={styles.shopOptionArrow}>→</Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderReady = () => (
    <View style={styles.centerContent}>
      <Text style={styles.readyShop}>{selectedShop?.name}</Text>
      <Text style={styles.readyAddress}>{selectedShop?.address}</Text>

      <Animated.View
        style={[styles.scanCircle, { transform: [{ scale: pulseAnim }] }]}
      >
        <Text style={styles.scanCircleEmoji}>📱</Text>
      </Animated.View>

      <Text style={styles.readyText}>{copy.scan.readyTitle}</Text>
      <Text style={styles.readySubtext}>{copy.scan.readySubtitle}</Text>

      <View>
        <TouchableOpacity
          style={styles.scanButton}
          onPress={handleScan}
          activeOpacity={0.8}
        >
          <Text style={styles.scanButtonText}>{copy.scan.scanButton} 📡</Text>
        </TouchableOpacity>
        {!nfcSupported && <Text style={styles.simNote}>{copy.scan.simNote}</Text>}
      </View>

      <TouchableOpacity style={styles.backLink} onPress={handleReset}>
        <Text style={styles.backLinkText}>← {copy.scan.changeShop}</Text>
      </TouchableOpacity>
    </View>
  );

  const renderScanning = () => (
    <View style={styles.centerContent}>
      <Animated.View
        style={[styles.scanCircleLarge, { transform: [{ scale: pulseAnim }] }]}
      >
        <Text style={styles.scanningEmoji}>📡</Text>
      </Animated.View>
      <Text style={styles.scanningText}>{copy.scan.scanningTitle}</Text>
      <Text style={styles.scanningSubtext}>
        {nfcSupported
          ? copy.scan.scanningSupported
          : copy.scan.scanningDemo}
      </Text>
    </View>
  );

  const renderSuccess = () => (
    <View style={styles.centerContent}>
      <Animated.View
        style={[
          styles.successCircle,
          {
            transform: [
              {
                scale: successAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.3, 1],
                }),
              },
            ],
          },
        ]}
      >
        <Text style={styles.successEmoji}>🎉</Text>
      </Animated.View>
      <Text style={styles.successTitle}>{copy.scan.successTitle}</Text>
      <Text style={styles.successSubtitle}>{copy.scan.successSubtitle}</Text>
      <View style={styles.discountCard}>
        <Text style={styles.discountAmount}>20% OFF</Text>
        <Text style={styles.discountShop}>{selectedShop?.name}</Text>
        <Text style={styles.discountCode}>
          GAEILGE-{selectedShop?.nfcTagId?.toUpperCase()}
        </Text>
        <Text style={styles.discountNote}>{copy.scan.discountNote}</Text>
      </View>
      <Text style={styles.gaeilgeMessage}>{copy.scan.thankYou} 🇮🇪</Text>
      <Text style={styles.gaeilgeTranslation}>
        {copy.scan.thankYouTranslation}
      </Text>
      <TouchableOpacity
        style={styles.resetButton}
        onPress={handleReset}
        activeOpacity={0.8}
      >
        <Text style={styles.resetButtonText}>{copy.scan.reset} ↻</Text>
      </TouchableOpacity>
    </View>
  );

  const renderError = () => (
    <View style={styles.centerContent}>
      <Text style={styles.errorEmoji}>😕</Text>
      <Text style={styles.errorTitle}>{copy.scan.errorTitle}</Text>
      <Text style={styles.errorSubtitle}>{copy.scan.errorSubtitle}</Text>
      <Text style={styles.errorMessage}>{copy.scan.errorMessage}</Text>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={() => setScanState('ready')}
        activeOpacity={0.8}
      >
        <Text style={styles.retryButtonText}>{copy.scan.retry}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {scanState === 'idle' && renderIdle()}
      {scanState === 'selecting' && (
        <View style={styles.scrollWrap}>
          <TouchableOpacity style={styles.backHeader} onPress={handleReset}>
            <Text style={styles.backHeaderText}>← {copy.scan.back}</Text>
          </TouchableOpacity>
          <ScrollView
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
          >
            {renderSelecting()}
          </ScrollView>
        </View>
      )}
      {scanState === 'ready' && renderReady()}
      {scanState === 'scanning' && renderScanning()}
      {scanState === 'success' && renderSuccess()}
      {scanState === 'error' && renderError()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollWrap: {
    flex: 1,
  },
  backHeader: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  backHeaderText: {
    color: Colors.accent,
    fontSize: 16,
    fontWeight: '600',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  scanIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: Colors.accent,
    fontWeight: '600',
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 16,
  },
  instructions: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 40,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryLight,
    marginBottom: 32,
    width: '100%',
  },
  primaryButtonText: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  buttonSubtext: {
    color: Colors.accentLight,
    fontSize: 13,
    marginTop: 4,
    fontWeight: '500',
  },
  stepsContainer: {
    width: '100%',
    gap: 12,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 28,
    fontSize: 14,
    fontWeight: '800',
    marginRight: 14,
    overflow: 'hidden',
  },
  stepText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
  },
  selectContent: {
    flex: 1,
    paddingHorizontal: 16,
  },
  selectTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  selectSubtitle: {
    fontSize: 14,
    color: Colors.accent,
    textAlign: 'center',
    marginBottom: 20,
    fontStyle: 'italic',
  },
  shopOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shopOptionEmoji: {
    fontSize: 28,
    marginRight: 14,
  },
  shopOptionInfo: {
    flex: 1,
  },
  shopOptionName: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  shopOptionAddress: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  shopOptionArrow: {
    color: Colors.accent,
    fontSize: 20,
    fontWeight: '700',
  },
  readyShop: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.text,
    marginBottom: 4,
  },
  readyAddress: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 32,
  },
  scanCircle: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: Colors.primary + '20',
    borderWidth: 3,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  scanCircleEmoji: {
    fontSize: 48,
  },
  readyText: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  readySubtext: {
    fontSize: 14,
    color: Colors.accent,
    fontStyle: 'italic',
    marginBottom: 28,
  },
  scanButton: {
    backgroundColor: Colors.accent,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 48,
    alignItems: 'center',
  },
  scanButtonText: {
    color: Colors.background,
    fontSize: 18,
    fontWeight: '800',
  },
  simNote: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
  backLink: {
    marginTop: 24,
  },
  backLinkText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  scanCircleLarge: {
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: Colors.accent + '20',
    borderWidth: 3,
    borderColor: Colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  scanningEmoji: {
    fontSize: 64,
  },
  scanningText: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.text,
  },
  scanningSubtext: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  successCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.success + '20',
    borderWidth: 3,
    borderColor: Colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  successEmoji: {
    fontSize: 56,
  },
  successTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
  },
  successSubtitle: {
    fontSize: 16,
    color: Colors.accent,
    fontStyle: 'italic',
    marginBottom: 24,
  },
  discountCard: {
    backgroundColor: Colors.primary,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    width: '100%',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: Colors.primaryLight,
  },
  discountAmount: {
    fontSize: 42,
    fontWeight: '900',
    color: Colors.accent,
    letterSpacing: 2,
  },
  discountShop: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    marginTop: 8,
  },
  discountCode: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.accentLight,
    marginTop: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 2,
  },
  discountNote: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  gaeilgeMessage: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  gaeilgeTranslation: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    marginBottom: 24,
  },
  resetButton: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  resetButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  errorEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: Colors.text,
  },
  errorSubtitle: {
    fontSize: 14,
    color: Colors.accent,
    fontStyle: 'italic',
    marginBottom: 16,
  },
  errorMessage: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 32,
  },
  retryButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
});
