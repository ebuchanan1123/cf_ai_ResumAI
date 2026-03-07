import React, { useState } from 'react';
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
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

const API_URL = 'http://10.198.139.105:3001';

type Tone = 'Concise' | 'Technical' | 'Impact-focused';

type TailoredResumeResponse = {
  summary: string;
  experienceBullets: string[];
  skillsToHighlight: string[];
  missingKeywords: string[];
};

export default function ResumeScreen() {
  const [resumeText, setResumeText] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [tone, setTone] = useState<Tone>('Technical');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TailoredResumeResponse | null>(null);

  const tailorResume = async () => {
    if (resumeText.trim().length < 50 || jobDescription.trim().length < 30) {
      Alert.alert(
        'Error',
        'Please paste a longer resume and a longer job description.'
      );
      return;
    }

    try {
      setLoading(true);
      setResult(null);

      const res = await fetch(`${API_URL}/tailor-resume`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resumeText,
          jobDescription,
          tone,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to tailor resume.');
      }

      setResult(data);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const copySection = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Section copied to clipboard.');
  };

  const clearAll = () => {
    setResumeText('');
    setJobDescription('');
    setTone('Technical');
    setResult(null);
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

  const joinedBullets = result?.experienceBullets.map((b) => `• ${b}`).join('\n') || '';
  const joinedSkills = result?.skillsToHighlight.join(', ') || '';
  const joinedKeywords = result?.missingKeywords.join(', ') || '';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <Text style={styles.title}>Resume Optimizer</Text>
          <Text style={styles.subtitle}>
            Paste your current resume and a target job description to generate a more tailored version.
          </Text>

          <View style={styles.section}>
            <Text style={styles.label}>Current Resume</Text>
            <TextInput
              style={[styles.input, styles.resumeArea]}
              multiline
              value={resumeText}
              onChangeText={setResumeText}
              placeholder="Paste your current resume here..."
              placeholderTextColor="#8C8C8C"
              textAlignVertical="top"
            />

            <Text style={styles.label}>Target Job Description</Text>
            <TextInput
              style={[styles.input, styles.jobDescriptionArea]}
              multiline
              value={jobDescription}
              onChangeText={setJobDescription}
              placeholder="Paste the internship job description here..."
              placeholderTextColor="#8C8C8C"
              textAlignVertical="top"
            />

            <Text style={styles.label}>Tone</Text>
            <View style={styles.toneRow}>
              <ToneButton value="Concise" />
              <ToneButton value="Technical" />
              <ToneButton value="Impact-focused" />
            </View>

            <TouchableOpacity
              style={[styles.generateButton, loading && styles.generateButtonDisabled]}
              onPress={tailorResume}
              disabled={loading}
            >
              <Text style={styles.generateButtonText}>
                {loading ? 'Tailoring...' : 'Tailor Resume'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.clearButton} onPress={clearAll}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" />
              <Text style={styles.loadingText}>Tailoring your resume...</Text>
            </View>
          ) : result ? (
            <View style={styles.resultsSection}>
              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>Tailored Summary</Text>
                  <TouchableOpacity onPress={() => copySection(result.summary)}>
                    <Text style={styles.copyText}>Copy</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.resultBody}>{result.summary}</Text>
              </View>

              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>Tailored Experience Bullets</Text>
                  <TouchableOpacity onPress={() => copySection(joinedBullets)}>
                    <Text style={styles.copyText}>Copy</Text>
                  </TouchableOpacity>
                </View>
                {result.experienceBullets.map((bullet, index) => (
                  <Text key={index} style={styles.bulletLine}>
                    • {bullet}
                  </Text>
                ))}
              </View>

              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>Skills to Highlight</Text>
                  <TouchableOpacity onPress={() => copySection(joinedSkills)}>
                    <Text style={styles.copyText}>Copy</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.resultBody}>{joinedSkills}</Text>
              </View>

              <View style={styles.resultCard}>
                <View style={styles.resultHeader}>
                  <Text style={styles.resultTitle}>Missing Keywords</Text>
                  <TouchableOpacity onPress={() => copySection(joinedKeywords)}>
                    <Text style={styles.copyText}>Copy</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.resultBody}>{joinedKeywords}</Text>
              </View>
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                Your tailored summary, improved bullets, and keyword suggestions will appear here.
              </Text>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardAvoidingContainer: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#000000',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 140,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 34,
    fontWeight: '800',
    marginBottom: 10,
  },
  subtitle: {
    color: '#A3A3A3',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 28,
  },
  section: {
    marginBottom: 28,
  },
  label: {
    color: '#FFFFFF',
    marginTop: 14,
    marginBottom: 8,
    fontWeight: '700',
    fontSize: 15,
  },
  input: {
    backgroundColor: '#F2F2F2',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    fontSize: 16,
    color: '#111111',
  },
  resumeArea: {
    minHeight: 220,
    paddingTop: 14,
  },
  jobDescriptionArea: {
    minHeight: 190,
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
    backgroundColor: '#161616',
    borderWidth: 1,
    borderColor: '#2A2A2A',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  toneButtonActive: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  toneButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  toneButtonTextActive: {
    color: '#111111',
  },
  generateButton: {
    backgroundColor: '#0F0F0F',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#1E1E1E',
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
    backgroundColor: '#141414',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#242424',
  },
  clearButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  loadingContainer: {
    paddingVertical: 28,
    alignItems: 'center',
  },
  loadingText: {
    color: '#A3A3A3',
    marginTop: 12,
    fontSize: 15,
  },
  resultsSection: {
    marginTop: 4,
  },
  resultCard: {
    backgroundColor: '#F4F4F4',
    borderRadius: 18,
    padding: 14,
    marginBottom: 14,
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resultTitle: {
    color: '#111111',
    fontWeight: '800',
    fontSize: 15,
  },
  copyText: {
    color: '#111111',
    fontWeight: '700',
    fontSize: 13,
  },
  resultBody: {
    color: '#111111',
    fontSize: 15,
    lineHeight: 23,
  },
  bulletLine: {
    color: '#111111',
    fontSize: 15,
    lineHeight: 23,
    marginBottom: 6,
  },
  emptyState: {
    backgroundColor: '#0C0C0C',
    borderWidth: 1,
    borderColor: '#1D1D1D',
    borderRadius: 18,
    padding: 18,
  },
  emptyStateText: {
    color: '#8E8E8E',
    fontSize: 15,
    lineHeight: 22,
  },
});