import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { Colors } from '../../constants/Colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: 88,
          paddingBottom: 24,
          paddingTop: 8,
        },
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 0.5,
        },
      }}
    >
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Biachlár',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 24 }}>☕</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Léarscáil',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 24 }}>🗺️</Text>
          ),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan NFC',
          tabBarIcon: ({ color }) => (
            <Text style={{ fontSize: 24 }}>📱</Text>
          ),
        }}
      />
    </Tabs>
  );
}
