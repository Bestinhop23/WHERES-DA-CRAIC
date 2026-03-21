import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../../constants/Colors';
import MenuItem from '../../components/MenuItem';
import menuData from '../../data/menu.json';

export default function MenuScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={menuData}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerEmoji}>☘️</Text>
            <Text style={styles.title}>Cupán Caife</Text>
            <Text style={styles.subtitle}>Biachlár · Menu</Text>
            <View style={styles.banner}>
              <Text style={styles.bannerText}>
                Order as Gaeilge & get 20% off! 🇮🇪
              </Text>
              <Text style={styles.bannerSubtext}>
                Tap any item to learn the Irish phrase
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => <MenuItem item={item} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: 4,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: Colors.text,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.accent,
    fontWeight: '600',
    fontStyle: 'italic',
    marginTop: 4,
    marginBottom: 16,
  },
  banner: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryLight,
  },
  bannerText: {
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  bannerSubtext: {
    color: Colors.accentLight,
    fontSize: 13,
    marginTop: 6,
    fontWeight: '500',
  },
  list: {
    paddingBottom: 100,
  },
});
