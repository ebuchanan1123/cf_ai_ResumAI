import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  findNodeHandle,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { API_URL } from '@/config/api';
import { loadBulletDraft, saveBulletDraft } from '@/lib/generationDraftStorage';
import {
  consumeDailyUsage,
  getDailyUsage,
  getLimitReachedMessage,
  releaseDailyUsage,
} from '@/lib/rateLimits';

type Tone = 'Concise' | 'Technical' | 'Impact-focused';

export default function HomeScreen() {
  const [jobTitle, setJobTitle] = useState('');
  const [experience, setExperience] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [tone, setTone] = useState<Tone>('Technical');
  const [bullets, setBullets] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [draftHydrated, setDraftHydrated] = useState(false);

  const scrollViewRef = useRef<ScrollView | null>(null);
  const bulletRefs = useRef<Record<number, View | null>>({});

  useEffect(() => {
    const loadDraft = async () => {
      try {
        const storedDraft = await loadBulletDraft();
        setJobTitle(storedDraft.jobTitle || '');
        setExperience(storedDraft.experience || '');
        setJobDescription(storedDraft.jobDescription || '');
        if (storedDraft.tone === 'Concise' || storedDraft.tone === 'Technical' || storedDraft.tone === 'Impact-focused') {
          setTone(storedDraft.tone);
        }
        setBullets(Array.isArray(storedDraft.bullets) ? storedDraft.bullets : []);
      } catch {
        Alert.alert('Error', 'Failed to load your saved bullet draft.');
      } finally {
        setDraftHydrated(true);
      }
    };

    void loadDraft();
  }, []);

  useEffect(() => {
    if (!draftHydrated) return;

    const timeoutId = setTimeout(() => {
      void saveBulletDraft({
        jobTitle,
        experience,
        jobDescription,
        tone,
        bullets,
      });
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [draftHydrated, jobTitle, experience, jobDescription, tone, bullets]);

  const generate = async () => {
    if (!jobTitle.trim() || experience.trim().length < 20) {
      Alert.alert('Error', 'Please enter a job title and a longer experience description.');
      return;
    }

    const usage = await getDailyUsage('bullet_generation');
    if (usage.remaining === 0) {
      Alert.alert(
        'Daily limit reached',
        getLimitReachedMessage('bullet_generation', 'bullet generations')
      );
      return;
    }

    let usageConsumed = false;

    try {
      await consumeDailyUsage('bullet_generation');
      usageConsumed = true;
      setLoading(true);
      setBullets([]);

      const res = await fetch(`${API_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobTitle,
          experience,
          tone,
          jobDescription,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed request');
      }

      setBullets(data.bullets || []);

      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 700, animated: true });
      }, 250);
    } catch (err: any) {
      if (usageConsumed) {
        await releaseDailyUsage('bullet_generation');
      }
      Alert.alert('Error', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const regenerateBullet = async (index: number) => {
    if (!jobTitle.trim() || experience.trim().length < 20) {
      Alert.alert('Error', 'Please enter a job title and a longer experience description.');
      return;
    }

    const usage = await getDailyUsage('bullet_generation');
    if (usage.remaining === 0) {
      Alert.alert(
        'Daily limit reached',
        getLimitReachedMessage('bullet_generation', 'bullet generations')
      );
      return;
    }

    let usageConsumed = false;

    try {
      await consumeDailyUsage('bullet_generation');
      usageConsumed = true;
      const res = await fetch(`${API_URL}/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobTitle,
          experience,
          tone,
          jobDescription,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to regenerate bullet.');
      }

      const newBullets = data.bullets || [];
      if (!newBullets.length) {
        throw new Error('No bullets returned.');
      }

      const updated = [...bullets];
      updated[index] = newBullets[index] || newBullets[0];
      setBullets(updated);
    } catch (err: any) {
      if (usageConsumed) {
        await releaseDailyUsage('bullet_generation');
      }
      Alert.alert('Error', err.message || 'Failed to regenerate bullet.');
    }
  };

  const copyBullet = async (bullet: string) => {
    await Clipboard.setStringAsync(bullet);
    Alert.alert('Copied', 'Bullet copied to clipboard.');
  };

  const copyAllBullets = async () => {
    if (!bullets.length) return;

    const text = bullets.map((bullet) => `• ${bullet}`).join('\n');
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'All bullets copied to clipboard.');
  };

  const clearAll = () => {
    setJobTitle('');
    setExperience('');
    setJobDescription('');
    setBullets([]);
    setTone('Technical');
    bulletRefs.current = {};
  };

  const scrollToBullet = (index: number) => {
    const target = bulletRefs.current[index];
    const scrollNode = scrollViewRef.current;

    if (!target || !scrollNode) return;

    const targetHandle = findNodeHandle(target);
    const scrollHandle = findNodeHandle(scrollNode);

    if (!targetHandle || !scrollHandle) return;

    UIManager.measureLayout(
        targetHandle,
        scrollHandle,
        () => {},
        (_left, top) => {
        scrollViewRef.current?.scrollTo({
            y: Math.max(top - 12, 0),
            animated: true,
        });
        }
    );
  };

  const ToneButton = ({ value }: { value: Tone }) => {
    const active = tone === value;

    return (
      <TouchableOpacity
        style={[styles.toneButton, active && styles.toneButtonActive]}
        onPress={() => setTone(value)}
      >
        <Text style={[styles.toneButtonText, active && styles.toneButtonTextActive]}>
          {value}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      

        <KeyboardAvoidingView
          style={styles.keyboardAvoidingContainer}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            ref={scrollViewRef}
            style={styles.screen}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            <Text style={styles.title}>Bullets</Text>
            <Text style={styles.subtitle}>
              Turn rough experience into polished, stronger resume bullet points.
            </Text>

            <View style={styles.section}>
              <Text style={styles.label}>Job Title</Text>
              <TextInput
                style={styles.input}
                value={jobTitle}
                onChangeText={setJobTitle}
                placeholder="e.g. Software Developer Intern"
                placeholderTextColor="#8C8C8C"
              />

              <Text style={styles.label}>Raw Experience</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                multiline
                value={experience}
                onChangeText={setExperience}
                placeholder="e.g. Built responsive web pages using React, worked with APIs, fixed bugs, and improved usability."
                placeholderTextColor="#8C8C8C"
                textAlignVertical="top"
              />

              <Text style={styles.label}>Target Job Description (Optional but powerful)</Text>
              <TextInput
                style={[styles.input, styles.jobDescriptionArea]}
                multiline
                value={jobDescription}
                onChangeText={setJobDescription}
                placeholder="Paste the internship job description here to tailor the bullets to the role."
                placeholderTextColor="#8C8C8C"
                textAlignVertical="top"
              />

              <Text style={styles.helperText}>
                Add a job description to make the bullets match recruiter keywords more closely.
              </Text>

              <Text style={styles.label}>Tone</Text>
              <View style={styles.toneRow}>
                <ToneButton value="Concise" />
                <ToneButton value="Technical" />
                <ToneButton value="Impact-focused" />
              </View>

              <TouchableOpacity
                style={[styles.generateButton, loading && styles.generateButtonDisabled]}
                onPress={generate}
                disabled={loading}
              >
                <Text style={styles.generateButtonText}>
                  {loading ? 'Generating...' : 'Generate Resume Bullets'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.clearButton} onPress={clearAll}>
                <Text style={styles.clearButtonText}>Clear</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.resultsSection}>
              <View style={styles.resultsHeader}>
                <Text style={styles.resultsTitle}>Generated Bullets</Text>
                {!!bullets.length && (
                  <TouchableOpacity onPress={copyAllBullets}>
                    <Text style={styles.copyAllText}>Copy All</Text>
                  </TouchableOpacity>
                )}
              </View>

              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" />
                  <Text style={styles.loadingText}>Generating your bullets...</Text>
                </View>
              ) : bullets.length > 0 ? (
                bullets.map((bullet, index) => (
                  <View
                    key={index}
                    style={styles.bulletCard}
                    ref={(ref) => {
                        bulletRefs.current[index] = ref;
                    }}
                    >
                    <View style={styles.bulletCardHeader}>
                      <Text style={styles.bulletCardTitle}>Bullet {index + 1}</Text>

                      <View style={styles.bulletActions}>
                        <TouchableOpacity
                          style={styles.regenButton}
                          onPress={() => regenerateBullet(index)}
                        >
                          <Text style={styles.regenButtonText}>Regenerate</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.copyButton}
                          onPress={() => copyBullet(bullet)}
                        >
                          <Text style={styles.copyButtonText}>Copy</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    <TextInput
                      style={styles.bulletText}
                      multiline
                      value={bullet}
                      onFocus={() => scrollToBullet(index)}
                      onChangeText={(text) => {
                        const updated = [...bullets];
                        updated[index] = text;
                        setBullets(updated);
                      }}
                      textAlignVertical="top"
                    />
                  </View>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    Your polished resume bullets will appear here.
                  </Text>
                </View>
              )}
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
  mainContainer: {
    flex: 1,
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 220,
  },
  splashContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    zIndex: 10,
  },
  splashInner: {
    alignItems: 'center',
  },
  splashTitle: {
    color: '#1E293B',
    fontSize: 42,
    fontWeight: '800',
    marginBottom: 10,
  },
  splashSubtitle: {
    color: '#64748B',
    fontSize: 16,
    textAlign: 'center',
  },
  splashSpinner: {
    marginTop: 28,
  },
  title: {
    color: '#1E293B',
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 10,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 17,
    lineHeight: 25,
    marginBottom: 28,
  },
  section: {
    marginBottom: 28,
  },
  label: {
    color: '#1E293B',
    marginTop: 14,
    marginBottom: 8,
    fontWeight: '700',
    fontSize: 15,
  },
  helperText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
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
  },
  textArea: {
    minHeight: 150,
    paddingTop: 14,
  },
  jobDescriptionArea: {
    minHeight: 170,
    paddingTop: 14,
  },
  toneRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 2,
    marginBottom: 18,
  },
  toneButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  toneButtonActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  toneButtonText: {
    color: '#475569',
    fontWeight: '600',
  },
  toneButtonTextActive: {
    color: '#FFFFFF',
  },
  generateButton: {
    backgroundColor: '#2563EB',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  generateButtonDisabled: {
    opacity: 0.7,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
  },
  clearButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  clearButtonText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 16,
  },
  resultsSection: {
    marginTop: 4,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  resultsTitle: {
    color: '#1E293B',
    fontSize: 22,
    fontWeight: '800',
  },
  copyAllText: {
    color: '#2563EB',
    fontSize: 14,
    fontWeight: '700',
  },
  loadingContainer: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  loadingText: {
    color: '#64748B',
    marginTop: 12,
    fontSize: 15,
  },
  bulletCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  bulletCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  bulletCardTitle: {
    color: '#1E293B',
    fontWeight: '800',
    fontSize: 14,
  },
  bulletActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  regenButton: {
    backgroundColor: '#F0FDFA',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  regenButtonText: {
    color: '#0F766E',
    fontWeight: '700',
    fontSize: 13,
  },
  copyButton: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  copyButtonText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 13,
  },
  bulletText: {
    color: '#1E293B',
    fontSize: 16,
    lineHeight: 24,
    padding: 5,
    minHeight: 110,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 18,
  },
  emptyStateText: {
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 22,
  },
});
