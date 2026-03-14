import React from 'react';
import { Link } from 'expo-router';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

export default function Header() {
  const { width } = useWindowDimensions();
  const isSmall = width < 900;
  const isVerySmall = width < 700;

  if (isSmall) {
    return (
      <View style={styles.header}>
        <View style={styles.inner}>
          <View style={styles.mobileTopRow}>
            <Link href="/" asChild>
              <TouchableOpacity style={styles.logoWrap}>
                <Image
                  source={require('../assets/logo.png')}
                  style={isVerySmall ? styles.logoSmall : styles.logo}
                />
              </TouchableOpacity>
            </Link>

            <Link href="/profile" asChild>
              <TouchableOpacity style={isVerySmall ? styles.ctaSmall : styles.cta}>
                <Text style={isVerySmall ? styles.ctaTextSmall : styles.ctaText}>
                  Create Resume
                </Text>
              </TouchableOpacity>
            </Link>
          </View>

          <View style={styles.mobileNavRowPlain}>
            <Link href="/bullets" asChild>
              <TouchableOpacity style={styles.mobilePlainNavItem}>
                <Text style={styles.mobilePlainNavText}>Bullet AI</Text>
              </TouchableOpacity>
            </Link>

            <Link href="/(tabs)" asChild>
              <TouchableOpacity style={styles.mobilePlainNavItem}>
                <Text style={styles.mobilePlainNavText}>Resume Generator</Text>
              </TouchableOpacity>
            </Link>

            <Link href="/profile" asChild>
              <TouchableOpacity style={styles.mobilePlainNavItem}>
                <Text style={styles.mobilePlainNavText}>Profile</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.header}>
      <View style={styles.inner}>
        <View style={styles.desktopRow}>
          <Link href="/" asChild>
            <TouchableOpacity style={styles.logoWrap}>
              <Image
                source={require('../assets/logo.png')}
                style={styles.logo}
              />
            </TouchableOpacity>
          </Link>

          <View style={styles.desktopCenterNav}>
            <Link href="/bullets" asChild>
              <TouchableOpacity style={styles.navItem}>
                <Text style={styles.navText}>Bullet AI</Text>
              </TouchableOpacity>
            </Link>

            <Link href="/(tabs)" asChild>
              <TouchableOpacity style={styles.navItem}>
                <Text style={styles.navText}>Resume Generator</Text>
              </TouchableOpacity>
            </Link>

            <Link href="/profile" asChild>
              <TouchableOpacity style={styles.navItem}>
                <Text style={styles.navText}>Profile</Text>
              </TouchableOpacity>
            </Link>
          </View>

          <Link href="/profile" asChild>
            <TouchableOpacity style={styles.cta}>
              <Text style={styles.ctaText}>Create Resume</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  inner: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
  },

  desktopRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  desktopCenterNav: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },

  mobileTopRow: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mobileNavRowPlain: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingTop: 8,
  },

  logoWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 220,
    height: 60,
    resizeMode: 'contain',
  },
  logoSmall: {
    width: 180,
    height: 50,
    resizeMode: 'contain',
  },

  navItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  navText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },

  mobilePlainNavItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mobilePlainNavText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },

  cta: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
  },
  ctaSmall: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  ctaText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  ctaTextSmall: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
});