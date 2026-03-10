import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,

        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopColor: '#E2E8F0',
          borderTopWidth: 1,
          height: 74,
          paddingTop: 6,
        },

        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#64748B',

        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          marginBottom: 6,
        },

        tabBarLabelPosition: 'below-icon',
      }}
    >
      <Tabs.Screen
        name="bullets"
        options={{
          title: 'Bullets',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list" size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="index"
        options={{
          title: 'Resume',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="document-text" size={22} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}