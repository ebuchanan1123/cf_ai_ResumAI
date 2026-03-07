import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0A0A0A',
          borderTopColor: '#1E1E1E',
          height: 86,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: '#8C8C8C',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '700',
          paddingBottom: 8,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Bullets',
        }}
      />
      <Tabs.Screen
        name="resume"
        options={{
          title: 'Resume',
        }}
      />
    </Tabs>
  );
}