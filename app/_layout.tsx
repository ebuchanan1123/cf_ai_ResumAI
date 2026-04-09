import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { Platform } from 'react-native';
import { Analytics } from '@vercel/analytics/react';

import { useColorScheme } from '@/hooks/use-color-scheme';
import Header from "../components/Header";

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Head>
        <title>ResumAI | AI Resume Builder</title>
      </Head>
      <Header />
      <Stack initialRouteName="index" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" options={{ title: 'ResumAI | AI Resume Builder' }} />
        <Stack.Screen name="(tabs)" options={{ title: 'ResumAI | AI Resume Builder' }} />
      </Stack>
      <StatusBar style="light" />
      {Platform.OS === 'web' && <Analytics />}
    </ThemeProvider>
  );
}
