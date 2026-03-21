import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../constants/Colors';
import shopsData from '../../data/shops.json';

let NfcManager: any = null;
let NfcTech: any = null;
let isNfcAvailable = false;

try {
  const nfcModule = require('react-native-nfc-manager');
  NfcManager = nfcModule.default;
  NfcTech = nfcModule.NfcTech;
  isNfcAvailable = true;
} catch {
  isNfcAvailable = false;
}

type ScanState = 'idle' | 'selecting' | 'ready' | 'scanning' | 'success' | 'error';

export default function ScanScreen() {
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [selectedShop, setSelectedShop] = useState<(typeof shopsData)[number] | null>(null);
  const [nfcSupported, setNfcSupported] = useState(false);
  const [pulseAnim] = useState(new Animated.Value(1));
  const [successAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    checkNfc();
  }, []);

  useEffect(() => {
    if (scanState === 'ready' || scanState === 'scanning') {
      startPulse();
    }
  }, [scanState]);

  const checkNfc = async () => {
    if (!isNfcAvailable) {
      setNfcSupported(false);
      return;
    }
    try {
      await NfcManager.start();
      const supported = await NfcManager.isSupported();
      setNfcSupported(supported);
    } catch {
      setNfcSupported(false);
    }
  };

  const startPulse = () => {
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
  };

  const handleSelectShop = () => {
    setScanState('selecting');
  };

  const handleShopChosen = (shop: (typeof shopsData)[number]) => {
    setSelectedShop(shop);
    setScanState('ready');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleScanNfc = async () => {
    setScanState('scanning');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    if (nfcSupported && isNfcAvailable) {
      try {
        await NfcManager.requestTechnology(NfcTech.Ndef);
        const tag = await NfcManager.getTag();
        await NfcManager.cancelTechnologyRequest();

        if (tag) {
          handleScanSuccess();
        } else {
          handleScanError();
        }
      } catch {
        if (isNfcAvailable) {
          NfcManager.cancelTechnologyRequest().catch(() => {});
        }
        handleScanError();
      }
    } else {
      // Simulated NFC scan for Expo Go
      setTimeout(() => {
        handleScanSuccess();
      }, 2000);
    }
  };

  const handleSimulatedScan = () => {
    setScanState('scanning');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => {
      handleScanSuccess();
    }, 2500);
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

  const handleScanError = () => {
    setScanState('error');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
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
      <Text style={styles.title}>Scan do Lascaine</Text>
      <Text style={styles.subtitle}>Scan for your Discount</Text>
      <Text style={styles.instructions}>
        Order your coffee as Gaeilge, then scan the NFC tag at the counter to
        claim your 20% discount!
      </Text>
      <TouchableOpacity
        style={styles.primaryButton}
        onPress={handleSelectShop}
        activeOpacity={0.8}
      >
        <Text style={styles.primaryButtonText}>Roghnaigh Siopa ☕</Text>
        <Text style={styles.buttonSubtext}>Choose a Shop</Text>
      </TouchableOpacity>

      <View style={styles.stepsContainer}>
        <View style={styles.step}>
          <Text style={styles.stepNumber}>1</Text>
          <Text style={styles.stepText}>Choose your coffee shop</Text>
        </View>
        <View style={styles.step}>
          <Text style={styles.stepNumber}>2</Text>
          <Text style={styles.stepText}>Order in Irish at the counter</Text>
        </View>
        <View style={styles.step}>
          <Text style={styles.stepNumber}>3</Text>
          <Text style={styles.stepText}>Scan the NFC tag</Text>
        </View>
        <View style={styles.step}>
          <Text style={styles.stepNumber}>4</Text>
          <Text style={styles.stepText}>Enjoy 20% off! 🎉</Text>
        </View>
      </View>
    </View>
  );

  const renderSelecting = () => (
    <View style={styles.selectContent}>
      <Text style={styles.selectTitle}>Roghnaigh Siopa</Text>
      <Text style={styles.selectSubtitle}>Select a coffee shop nearby</Text>
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

      <Text style={styles.readyText}>Réidh le Scan!</Text>
      <Text style={styles.readySubtext}>Ready to Scan!</Text>

      {nfcSupported ? (
        <TouchableOpacity
          style={styles.scanButton}
          onPress={handleScanNfc}
          activeOpacity={0.8}
        >
          <Text style={styles.scanButtonText}>Scan NFC Tag 📡</Text>
        </TouchableOpacity>
      ) : (
        <View>
          <TouchableOpacity
            style={styles.scanButton}
            onPress={handleSimulatedScan}
            activeOpacity={0.8}
          >
            <Text style={styles.scanButtonText}>Scan NFC Tag 📡</Text>
          </TouchableOpacity>
          <Text style={styles.simNote}>
            Demo mode — NFC simulated in Expo Go
          </Text>
        </View>
      )}

      <TouchableOpacity style={styles.backLink} onPress={handleReset}>
        <Text style={styles.backLinkText}>← Athraigh siopa</Text>
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
      <Text style={styles.scanningText}>Ag scanáil...</Text>
      <Text style={styles.scanningSubtext}>
        {nfcSupported
          ? 'Hold your phone near the NFC tag'
          : 'Simulating NFC scan...'}
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
      <Text style={styles.successTitle}>Go hiontach!</Text>
      <Text style={styles.successSubtitle}>Fantastic!</Text>
      <View style={styles.discountCard}>
        <Text style={styles.discountAmount}>20% OFF</Text>
        <Text style={styles.discountShop}>{selectedShop?.name}</Text>
        <Text style={styles.discountCode}>
          GAEILGE-{selectedShop?.nfcTagId?.toUpperCase()}
        </Text>
        <Text style={styles.discountNote}>
          Show this to your barista
        </Text>
      </View>
      <Text style={styles.gaeilgeMessage}>
        Go raibh maith agat as Gaeilge a labhairt! 🇮🇪
      </Text>
      <Text style={styles.gaeilgeTranslation}>
        Thank you for speaking Irish!
      </Text>
      <TouchableOpacity
        style={styles.resetButton}
        onPress={handleReset}
        activeOpacity={0.8}
      >
        <Text style={styles.resetButtonText}>Déan arís ↻</Text>
      </TouchableOpacity>
    </View>
  );

  const renderError = () => (
    <View style={styles.centerContent}>
      <Text style={styles.errorEmoji}>😕</Text>
      <Text style={styles.errorTitle}>Ní raibh sé sin ceart</Text>
      <Text style={styles.errorSubtitle}>That didn't work</Text>
      <Text style={styles.errorMessage}>
        Make sure you're holding your phone near the NFC tag at the counter.
      </Text>
      <TouchableOpacity
        style={styles.retryButton}
        onPress={() => setScanState('ready')}
        activeOpacity={0.8}
      >
        <Text style={styles.retryButtonText}>Bain triail eile as</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {scanState === 'idle' && renderIdle()}
      {scanState === 'selecting' && (
        <View style={styles.scrollWrap}>
          <TouchableOpacity style={styles.backHeader} onPress={handleReset}>
            <Text style={styles.backHeaderText}>← Ar ais</Text>
          </TouchableOpacity>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
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
  // Selecting state
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
  // Ready state
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
  // Scanning state
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
  // Success state
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
  // Error state
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
