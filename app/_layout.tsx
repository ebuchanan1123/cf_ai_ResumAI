import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import Header from "../components/Header";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Header />
      <Stack initialRouteName="index" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ title: 'ResumAI | AI Resume Builder' }} />
        <Stack.Screen name="(tabs)" options={{ title: 'ResumAI | AI Resume Builder' }} />
      </Stack>
      <StatusBar style="light" />
    </ThemeProvider>
  );
}
