import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';

import { Link, useFocusEffect } from 'expo-router';
import { loadProfileFromStorage, type UserProfile } from '@/lib/profileStorage';
import { loadCurrentResumeDraft, type ResumeDraft } from '@/lib/resumeStorage';

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }

  Alert.alert(title, message);
};

const dedupeCaseInsensitive = (items: string[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const normalized = item.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
};

const TECHNICAL_KEYWORD_PATTERN =
  /\b(api|apis|backend|frontend|full[\s-]?stack|react|react native|next\.?js|node|node\.?js|nest|nest\.?js|typescript|javascript|python|java|postgres|postgresql|sql|mongodb|docker|kubernetes|aws|azure|gcp|cloud|deployment|graphql|rest|ai|openai|llm)\b/i;

const formatKeywordLabel = (keyword: string) =>
  keyword
    .split(/[\s-]+/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');

const extractImportantKeywords = (text: string) => {
  const matches =
    text.toLowerCase().match(
      /\b(?:react|react native|next\.?js|node\.?js|nest\.?js|typescript|javascript|python|postgresql|sql|docker|kubernetes|aws|azure|gcp|graphql|rest api|apis|backend|frontend|full-stack|ai|openai|llm|deployment|cloud|analytics)\b/g
    ) || [];

  return dedupeCaseInsensitive(matches);
};

const normalizeForSearch = (value: string) =>
  ` ${value.toLowerCase().replace(/[^a-z0-9+#./-]+/g, ' ')} `;

const containsKeyword = (corpus: string, keyword: string) =>
  corpus.includes(` ${keyword.toLowerCase()} `);

export default function InterviewPrepScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1100;

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [resumeDraft, setResumeDraft] = useState<ResumeDraft | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [storedProfile, storedDraft] = await Promise.all([
        loadProfileFromStorage(),
        loadCurrentResumeDraft(),
      ]);
      setProfile(storedProfile);
      setResumeDraft(storedDraft);
    } catch {
      showAlert('Error', 'Failed to load your interview prep data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      void loadData();
    }, [loadData])
  );

  const prep = useMemo(() => {
    if (!resumeDraft?.result || !profile) return null;

    const result = resumeDraft.result;
    const projectLead = result.projects[0] || null;
    const experienceLead = result.experience[0] || null;
    const keywordPool = extractImportantKeywords(resumeDraft.jobDescription || '');
    const normalizedCorpus = normalizeForSearch(
      [
        result.summary,
        result.skills.join(' '),
        result.projects.flatMap((project) => [project.name, project.role, ...project.bullets]).join(' '),
        result.experience.flatMap((exp) => [exp.company, exp.title, ...exp.bullets]).join(' '),
      ].join(' ')
    );

    const matchedKeywords = keywordPool.filter((keyword) => containsKeyword(normalizedCorpus, keyword));
    const missingKeywords = keywordPool.filter((keyword) => !containsKeyword(normalizedCorpus, keyword));

    const topTalkingPoints = dedupeCaseInsensitive([
      projectLead
        ? `Lead with ${projectLead.name} as a real product story: what you built, why it mattered, and what technical decisions you made.`
        : '',
      experienceLead
        ? `Use ${experienceLead.company} to show you can contribute in a real team environment, not just on side projects.`
        : '',
      matchedKeywords[0]
        ? `Connect your background directly to ${formatKeywordLabel(matchedKeywords[0])}, because it is clearly important in this role.`
        : '',
      matchedKeywords[1]
        ? `Bring one concrete example of ${formatKeywordLabel(matchedKeywords[1])} from a project or internship.`
        : '',
      !/\d/.test(`${result.projects.map((project) => project.bullets.join(' ')).join(' ')} ${result.experience.map((exp) => exp.bullets.join(' ')).join(' ')}`)
        ? 'Have one truthful metric or scope detail ready, because interviewers will likely probe for impact.'
        : '',
    ]).slice(0, 5);

    const likelyTechnicalQuestions = dedupeCaseInsensitive([
      ...matchedKeywords
        .filter((keyword) => TECHNICAL_KEYWORD_PATTERN.test(keyword))
        .slice(0, 3)
        .map((keyword) => `How have you used ${formatKeywordLabel(keyword)} in practice?`),
      projectLead ? `What was the architecture behind ${projectLead.name}?` : '',
      experienceLead ? `Tell me about a technical challenge you handled at ${experienceLead.company}.` : '',
    ]).slice(0, 5);

    const whyFit = `${profile.fullName || 'I'} bring hands-on experience in ${
      matchedKeywords.length > 0 ? matchedKeywords.slice(0, 3).map(formatKeywordLabel).join(', ') : 'full-stack development and product delivery'
    }. My projects and recent work show that I can build real solutions, adapt quickly, and contribute to the kind of technical work this role is focused on.`;

    const strongestProject = projectLead
      ? `${projectLead.name}${projectLead.role ? ` (${projectLead.role})` : ''} is your strongest project to mention because it is the clearest proof that you build real products and not just class assignments.`
      : 'Generate a tailored resume first to unlock project-specific prep.';

    const biggestGap = missingKeywords[0]
      ? `The biggest likely gap is ${formatKeywordLabel(
          missingKeywords[0]
        )}. If it comes up, be honest, then explain the closest adjacent experience you do have and how you would ramp up quickly.`
      : 'There is no major visible gap right now. Focus on clarity, confidence, and concrete examples.';

    const resources = [
      'Practice a 60-second introduction that connects your strongest project to this role.',
      'Prepare one STAR answer from internship or project work for teamwork, problem-solving, and ownership.',
      'Review the job description once more and pick 3 keywords you want to echo naturally in conversation.',
      'Have one honest answer ready for your biggest gap so you do not sound defensive if asked.',
    ];

    return {
      topTalkingPoints,
      likelyTechnicalQuestions,
      whyFit,
      strongestProject,
      biggestGap,
      resources,
      company: resumeDraft.importedJobPreview?.company || '',
      roleTitle: resumeDraft.importedJobPreview?.title || '',
    };
  }, [profile, resumeDraft]);

  const copyText = async (text: string) => {
    if (!text.trim()) return;
    await Clipboard.setStringAsync(text);
    showAlert('Copied', 'Interview prep text copied to clipboard.');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading interview prep...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!prep) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <Text style={styles.emptyTitle}>No tailored resume found yet</Text>
          <Text style={styles.emptyText}>
            Generate a tailored resume first, then come back here for role-specific interview prep.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.screen} contentContainerStyle={styles.contentContainer}>
          <Link href="/resume" asChild>
            <TouchableOpacity style={styles.backButton}>
              <Text style={styles.backButtonText}>Back to Resume Generator</Text>
            </TouchableOpacity>
          </Link>

          <View style={styles.pageHeader}>
            <Text style={styles.eyebrow}>Interview Prep</Text>
            <Text style={styles.title}>Prep for this job application with a clearer story</Text>
            <Text style={styles.subtitle}>
              {prep.roleTitle || 'This role'} {prep.company ? `at ${prep.company}` : ''} now has a dedicated prep workspace built from your tailored resume and target job description.
            </Text>
          </View>

          <View style={isDesktop ? styles.grid : styles.stack}>
            <View style={[styles.primaryColumn, !isDesktop && styles.stackColumn]}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Top 5 Talking Points</Text>
                {prep.topTalkingPoints.map((point, index) => (
                  <Text key={`point-${index}`} style={styles.listItem}>
                    {`\u2022 ${point}`}
                  </Text>
                ))}
                <TouchableOpacity style={styles.smallButton} onPress={() => copyText(prep.topTalkingPoints.map((point) => `• ${point}`).join('\n'))}>
                  <Text style={styles.smallButtonText}>Copy</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Likely Technical Questions</Text>
                {prep.likelyTechnicalQuestions.map((question, index) => (
                  <Text key={`question-${index}`} style={styles.listItem}>
                    {`\u2022 ${question}`}
                  </Text>
                ))}
              </View>
            </View>

            <View style={[styles.secondaryColumn, !isDesktop && styles.stackColumn]}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Why You’re a Fit</Text>
                <Text style={styles.bodyText}>{prep.whyFit}</Text>
                <TouchableOpacity style={styles.smallButton} onPress={() => copyText(prep.whyFit)}>
                  <Text style={styles.smallButtonText}>Copy</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Strongest Project To Mention</Text>
                <Text style={styles.bodyText}>{prep.strongestProject}</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Biggest Gap And How To Explain It</Text>
                <Text style={styles.bodyText}>{prep.biggestGap}</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Prep Resources</Text>
                {prep.resources.map((resource, index) => (
                  <Text key={`resource-${index}`} style={styles.listItem}>
                    {`\u2022 ${resource}`}
                  </Text>
                ))}
              </View>
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
  pageHeader: {
    marginBottom: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 16,
  },
  backButtonText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '800',
  },
  eyebrow: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  title: {
    color: '#1E293B',
    fontSize: 40,
    fontWeight: '800',
    lineHeight: 46,
    marginBottom: 12,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 17,
    lineHeight: 26,
    maxWidth: 860,
  },
  grid: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stack: {
    flexDirection: 'column',
  },
  primaryColumn: {
    flex: 1.05,
    minWidth: 0,
    marginRight: 18,
  },
  secondaryColumn: {
    flex: 0.95,
    minWidth: 0,
  },
  stackColumn: {
    marginRight: 0,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  cardTitle: {
    color: '#1E293B',
    fontSize: 24,
    fontWeight: '800',
    lineHeight: 30,
    marginBottom: 12,
  },
  bodyText: {
    color: '#475569',
    fontSize: 15,
    lineHeight: 23,
  },
  listItem: {
    color: '#334155',
    fontSize: 15,
    lineHeight: 23,
    marginTop: 10,
  },
  smallButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
  },
  smallButtonText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '800',
  },
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 15,
    marginTop: 12,
  },
  emptyTitle: {
    color: '#1E293B',
    fontSize: 24,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    maxWidth: 560,
    marginTop: 10,
  },
});
