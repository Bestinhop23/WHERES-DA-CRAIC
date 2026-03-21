import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/Colors';
import { darkMapStyle } from '../../constants/MapStyle';
import shopsData from '../../data/shops.json';

const { width, height } = Dimensions.get('window');

type Shop = (typeof shopsData)[number];

export default function MapScreen() {
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const mapRef = useRef<MapView>(null);
  const router = useRouter();

  const handleMarkerPress = (shop: Shop) => {
    setSelectedShop(shop);
    mapRef.current?.animateToRegion(
      {
        latitude: shop.latitude - 0.003,
        longitude: shop.longitude,
        latitudeDelta: 0.015,
        longitudeDelta: 0.015,
      },
      500
    );
  };

  const handleShopPress = (shop: Shop) => {
    router.push(`/shop/${shop.id}`);
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        customMapStyle={darkMapStyle}
        initialRegion={{
          latitude: 53.3438,
          longitude: -6.2588,
          latitudeDelta: 0.04,
          longitudeDelta: 0.04,
        }}
        userInterfaceStyle="dark"
      >
        {shopsData.map((shop) => (
          <Marker
            key={shop.id}
            coordinate={{
              latitude: shop.latitude,
              longitude: shop.longitude,
            }}
            onPress={() => handleMarkerPress(shop)}
          >
            <View style={[
              styles.markerContainer,
              selectedShop?.id === shop.id && styles.markerSelected,
            ]}>
              <Text style={styles.markerEmoji}>☕</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Header overlay */}
      <View style={styles.headerOverlay}>
        <Text style={styles.headerTitle}>☘️ Léarscáil Caife</Text>
        <Text style={styles.headerSubtitle}>
          {shopsData.length} shops in Dublin
        </Text>
      </View>

      {/* Bottom sheet for selected shop */}
      {selectedShop && (
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHandle} />
          <TouchableOpacity
            onPress={() => handleShopPress(selectedShop)}
            activeOpacity={0.8}
          >
            <View style={styles.sheetContent}>
              <View style={styles.sheetHeader}>
                <Text style={styles.shopEmoji}>☕</Text>
                <View style={styles.shopInfo}>
                  <Text style={styles.shopName}>{selectedShop.name}</Text>
                  <Text style={styles.shopAddress}>{selectedShop.address}</Text>
                </View>
              </View>
              <Text style={styles.shopDescription}>
                {selectedShop.description}
              </Text>
              <View style={styles.shopMeta}>
                <View style={styles.metaTag}>
                  <Text style={styles.metaText}>🕐 {selectedShop.hours}</Text>
                </View>
                <View style={styles.nfcTag}>
                  <Text style={styles.nfcText}>📱 NFC Ready</Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.orderButton}
                onPress={() => handleShopPress(selectedShop)}
                activeOpacity={0.8}
              >
                <Text style={styles.orderButtonText}>
                  Ordaigh as Gaeilge →
                </Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setSelectedShop(null)}
          >
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  map: {
    width: width,
    height: height,
  },
  markerContainer: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 8,
    borderWidth: 2,
    borderColor: Colors.primary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  markerSelected: {
    borderColor: Colors.accent,
    backgroundColor: Colors.card,
    transform: [{ scale: 1.2 }],
  },
  markerEmoji: {
    fontSize: 20,
  },
  headerOverlay: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(13, 17, 23, 0.92)',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  headerTitle: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 100,
    left: 16,
    right: 16,
    backgroundColor: Colors.surface,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: Colors.textMuted,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetContent: {},
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  shopEmoji: {
    fontSize: 36,
    marginRight: 14,
  },
  shopInfo: {
    flex: 1,
  },
  shopName: {
    color: Colors.text,
    fontSize: 20,
    fontWeight: '800',
  },
  shopAddress: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  shopDescription: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  shopMeta: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  metaTag: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  nfcTag: {
    backgroundColor: Colors.primary + '30',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  nfcText: {
    color: Colors.primaryLight,
    fontSize: 12,
    fontWeight: '600',
  },
  orderButton: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  orderButtonText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  closeButton: {
    position: 'absolute',
    top: 12,
    right: 16,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: Colors.textMuted,
    fontSize: 14,
    fontWeight: '700',
  },
});
