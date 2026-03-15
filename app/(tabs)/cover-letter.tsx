import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { API_URL } from '@/config/api';
import { loadProfileFromStorage, type UserProfile } from '@/lib/profileStorage';
import {
  consumeDailyUsage,
  getDailyUsage,
  getLimitReachedMessage,
  releaseDailyUsage,
} from '@/lib/rateLimits';

type Tone = 'Concise' | 'Technical' | 'Impact-focused';

export default function CoverLetterScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1400;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [jobDescription, setJobDescription] = useState('');
  const [companyContext, setCompanyContext] = useState('');
  const [hiringManager, setHiringManager] = useState('');
  const [tone, setTone] = useState<Tone>('Technical');
  const [loading, setLoading] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const storedProfile = await loadProfileFromStorage();
        setProfile(storedProfile);
      } catch {
        Alert.alert('Error', 'Failed to load profile.');
      } finally {
        setProfileLoading(false);
      }
    };

    loadProfile();
  }, []);

  const reloadProfile = async () => {
    try {
      const storedProfile = await loadProfileFromStorage();
      setProfile(storedProfile);
      Alert.alert('Loaded', 'Latest profile data loaded.');
    } catch {
      Alert.alert('Error', 'Failed to reload profile.');
    }
  };

  const generateCoverLetter = async () => {
    if (!profile) {
      Alert.alert('Error', 'Profile is not loaded yet.');
      return;
    }

    if (jobDescription.trim().length < 30) {
      Alert.alert('Error', 'Please paste a longer job description.');
      return;
    }

    let usageConsumed = false;

    try {
      setLoading(true);
      setCoverLetter('');

      const usage = await getDailyUsage('cover_letter_generation');
      if (usage.remaining === 0) {
        Alert.alert(
          'Daily limit reached',
          getLimitReachedMessage('cover_letter_generation', 'cover letter generations')
        );
        return;
      }

      await consumeDailyUsage('cover_letter_generation');
      usageConsumed = true;

      const res = await fetch(`${API_URL}/generate-cover-letter`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          profile,
          jobDescription,
          companyContext,
          hiringManager,
          tone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate cover letter.');
      }

      setCoverLetter(data.coverLetter || '');
    } catch (err: any) {
      if (usageConsumed) {
        await releaseDailyUsage('cover_letter_generation');
      }
      Alert.alert('Error', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const copyCoverLetter = async () => {
    if (!coverLetter.trim()) return;
    await Clipboard.setStringAsync(coverLetter);
    Alert.alert('Copied', 'Cover letter copied to clipboard.');
  };

  const clearAll = () => {
    setJobDescription('');
    setCompanyContext('');
    setHiringManager('');
    setTone('Technical');
    setCoverLetter('');
  };

  const ToneButton = ({ value }: { value: Tone }) => {
    const active = tone === value;

    return (
      <TouchableOpacity
        style={[styles.pillButton, active && styles.pillButtonActive]}
        onPress={() => setTone(value)}
      >
        <Text style={[styles.pillButtonText, active && styles.pillButtonTextActive]}>
          {value}
        </Text>
      </TouchableOpacity>
    );
  };

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const profileLooksEmpty =
    !profile?.fullName &&
    !profile?.skills &&
    (!profile?.experience || profile.experience.every((item) => !item.company && !item.title)) &&
    (!profile?.projects || profile.projects.every((item) => !item.name));

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={[
            styles.contentContainer,
            !isDesktop && styles.contentContainerCompact,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={styles.pageHeader}>
            <Text style={styles.title}>Cover Letter</Text>
            <Text style={styles.subtitle}>
              Generate a tailored cover letter from your saved profile and a target role.
            </Text>
          </View>

          <View style={isDesktop ? styles.desktopGrid : styles.mobileStack}>
            <View style={isDesktop ? styles.desktopLeft : styles.mobileStackSection}>
              <View style={styles.sectionCard}>
                <View style={styles.profileStatusHeader}>
                  <Text style={styles.sectionTitle}>Profile Status</Text>
                  <TouchableOpacity style={styles.smallButton} onPress={reloadProfile}>
                    <Text style={styles.smallButtonText}>Reload</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.statusText}>
                  {profileLooksEmpty
                    ? 'Your profile looks mostly empty. Fill out the Profile page first for stronger cover letters.'
                    : `Using saved profile for ${profile?.fullName || 'this user'}.`}
                </Text>
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Target Job Description</Text>
                <TextInput
                  style={[styles.input, styles.jobDescriptionArea]}
                  multiline
                  value={jobDescription}
                  onChangeText={setJobDescription}
                  placeholder="Paste the target job description here..."
                  placeholderTextColor="#8C8C8C"
                  textAlignVertical="top"
                />

                <Text style={styles.label}>Company Notes (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.notesArea]}
                  multiline
                  value={companyContext}
                  onChangeText={setCompanyContext}
                  placeholder="Add anything specific you admire about the company, product, mission, or team."
                  placeholderTextColor="#8C8C8C"
                  textAlignVertical="top"
                />

                <Text style={styles.label}>Hiring Manager (Optional)</Text>
                <TextInput
                  style={styles.input}
                  value={hiringManager}
                  onChangeText={setHiringManager}
                  placeholder="e.g. Sarah Chen"
                  placeholderTextColor="#8C8C8C"
                />

                <Text style={styles.label}>Tone</Text>
                <View style={styles.pillRow}>
                  <ToneButton value="Concise" />
                  <ToneButton value="Technical" />
                  <ToneButton value="Impact-focused" />
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={[styles.primaryButtonCompact, loading && styles.disabledButton]}
                    onPress={generateCoverLetter}
                    disabled={loading}
                  >
                    <Text style={styles.primaryButtonCompactText}>
                      {loading ? 'Generating...' : 'Generate Cover Letter'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.secondaryButtonCompact} onPress={clearAll}>
                    <Text style={styles.secondaryButtonCompactText}>Clear</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={isDesktop ? styles.desktopRight : styles.mobileStackSection}>
              {loading ? (
                <View style={styles.loadingPanel}>
                  <ActivityIndicator size="large" />
                  <Text style={styles.loadingText}>Writing your cover letter...</Text>
                </View>
              ) : coverLetter ? (
                <View style={styles.sectionCard}>
                  <View style={styles.resultHeader}>
                    <Text style={styles.sectionTitle}>Generated Cover Letter</Text>
                    <TouchableOpacity style={styles.smallButton} onPress={copyCoverLetter}>
                      <Text style={styles.smallButtonText}>Copy</Text>
                    </TouchableOpacity>
                  </View>

                  <TextInput
                    style={[styles.input, styles.coverLetterArea]}
                    multiline
                    value={coverLetter}
                    onChangeText={setCoverLetter}
                    placeholderTextColor="#8C8C8C"
                    textAlignVertical="top"
                  />
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    Your generated cover letter will appear here. You can edit it directly and copy
                    it once it looks right.
                  </Text>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    width: '100%',
    maxWidth: 1240,
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 80,
  },
  contentContainerCompact: {
    paddingHorizontal: 16,
    paddingTop: 18,
  },
  pageHeader: {
    marginBottom: 24,
  },
  title: {
    color: '#1E293B',
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 10,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 16,
    lineHeight: 24,
  },
  desktopGrid: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 24,
  },
  desktopLeft: {
    flex: 0.95,
    minWidth: 0,
  },
  desktopRight: {
    flex: 1.05,
    minWidth: 0,
  },
  mobileStack: {
    width: '100%',
    flexDirection: 'column',
    gap: 20,
  },
  mobileStackSection: {
    width: '100%',
  },
  sectionCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    width: '100%',
  },
  sectionTitle: {
    color: '#1E293B',
    fontSize: 20,
    fontWeight: '800',
  },
  profileStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  smallButton: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  smallButtonText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 13,
  },
  statusText: {
    color: '#64748B',
    fontSize: 15,
    lineHeight: 22,
    marginTop: 12,
  },
  label: {
    color: '#1E293B',
    marginTop: 14,
    marginBottom: 8,
    fontWeight: '700',
    fontSize: 14,
  },
  input: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    fontSize: 16,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    width: '100%',
  },
  jobDescriptionArea: {
    minHeight: 220,
    paddingTop: 14,
    marginTop: 12,
  },
  notesArea: {
    minHeight: 130,
    paddingTop: 14,
  },
  coverLetterArea: {
    minHeight: 540,
    paddingTop: 14,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
    marginBottom: 18,
  },
  pillButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  pillButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  pillButtonText: {
    color: '#475569',
    fontWeight: '600',
  },
  pillButtonTextActive: {
    color: '#FFFFFF',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  primaryButtonCompact: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  primaryButtonCompactText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButtonCompact: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  secondaryButtonCompactText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 15,
  },
  disabledButton: {
    opacity: 0.7,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingPanel: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 28,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
    width: '100%',
  },
  loadingText: {
    color: '#64748B',
    marginTop: 12,
    fontSize: 15,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 22,
    minHeight: 220,
  },
  emptyStateText: {
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 24,
  },
});
