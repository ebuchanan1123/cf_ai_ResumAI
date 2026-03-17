import React from 'react';
import { Link } from 'expo-router';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function HomePage() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.contentContainer}>
        <View style={styles.heroSection}>
          <View style={styles.heroLeft}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>AI Resume Builder</Text>
            </View>

            <Text style={styles.title}>Build one profile. Tailor every resume.</Text>

            <Text style={styles.subtitle}>
              ResumAI helps you turn your experience, projects, education, and skills into
              job-specific resumes you can edit, save, and export to PDF.
            </Text>

            <View style={styles.ctaRow}>
              <Link href="/profile" asChild>
                <TouchableOpacity style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Build Your Profile</Text>
                </TouchableOpacity>
              </Link>

              <Link href="/bullets" asChild>
                <TouchableOpacity style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Try Bullet Generator</Text>
                </TouchableOpacity>
              </Link>
            </View>
          </View>

          <View style={styles.heroRight}>
            <View style={styles.previewCard}>
              <View style={styles.previewHeader}>
                <Text style={styles.previewName}>Tailored Resume</Text>
                <View style={styles.scoreBadge}>
                  <Text style={styles.scoreBadgeText}>AI Tailored</Text>
                </View>
              </View>

              <View style={styles.previewSection}>
                <Text style={styles.previewSectionTitle}>SUMMARY</Text>
                <Text style={styles.previewText}>
                  Computer Science student building full-stack and AI-powered applications with
                  experience in TypeScript, React, Node.js, and resume optimization tools.
                </Text>
              </View>

              <View style={styles.previewSection}>
                <Text style={styles.previewSectionTitle}>SKILLS</Text>
                <Text style={styles.previewText}>
                  TypeScript, React, Node.js, REST APIs, Git, PostgreSQL
                </Text>
              </View>

              <View style={styles.previewSection}>
                <Text style={styles.previewSectionTitle}>PROJECTS</Text>
                <Text style={styles.previewBullet}>
                  • Built an AI resume platform that generates job-specific resumes from a saved
                  profile
                </Text>
                <Text style={styles.previewBullet}>
                  • Added editable output, saved versions, and PDF export with multiple styles
                </Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How it works</Text>
          <Text style={styles.sectionSubtitle}>
            A faster workflow than rewriting your resume for every application.
          </Text>

          <View style={styles.stepsGrid}>
            <View style={styles.stepCard}>
              <Text style={styles.stepNumber}>1</Text>
              <Text style={styles.stepTitle}>Build your profile</Text>
              <Text style={styles.stepText}>
                Add your experience, projects, education, certifications, and skills once.
              </Text>
            </View>

            <View style={styles.stepCard}>
              <Text style={styles.stepNumber}>2</Text>
              <Text style={styles.stepTitle}>Paste the role</Text>
              <Text style={styles.stepText}>
                Drop in any job description you want to target.
              </Text>
            </View>

            <View style={styles.stepCard}>
              <Text style={styles.stepNumber}>3</Text>
              <Text style={styles.stepTitle}>Generate and export</Text>
              <Text style={styles.stepText}>
                Edit your tailored resume, save versions, and export a polished PDF.
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.finalCtaCard}>
          <Text style={styles.finalCtaTitle}>Stop rewriting your resume from scratch.</Text>
          <Text style={styles.finalCtaSubtitle}>
            Build your profile once and generate stronger resumes every time you apply.
          </Text>

          <View style={styles.privacyCard}>
            <Text style={styles.privacyTitle}>Privacy note</Text>
            <Text style={styles.privacyText}>
              Your profile is stored locally on your device while you use ResumAI. We do not have
              access to your saved resume data.
            </Text>
          </View>

          <Link href="/profile" asChild>
            <TouchableOpacity style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </TouchableOpacity>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  contentContainer: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 80,
  },
  heroSection: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 28,
    alignItems: 'center',
    marginBottom: 42,
  },
  heroLeft: {
    flex: 1,
    minWidth: 320,
  },
  heroRight: {
    flex: 1,
    minWidth: 320,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 18,
  },
  badgeText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    color: '#1E293B',
    fontSize: 52,
    lineHeight: 58,
    fontWeight: '800',
    marginBottom: 16,
    maxWidth: 680,
  },
  subtitle: {
    color: '#64748B',
    fontSize: 18,
    lineHeight: 28,
    marginBottom: 24,
    maxWidth: 620,
  },
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 16,
  },
  secondaryButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  secondaryButtonText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 16,
  },
  previewCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 28,
    padding: 22,
    minHeight: 360,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewName: {
    color: '#1E293B',
    fontSize: 22,
    fontWeight: '800',
  },
  scoreBadge: {
    backgroundColor: '#DBEAFE',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  scoreBadgeText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '800',
  },
  previewSection: {
    marginTop: 18,
  },
  previewSectionTitle: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 0.8,
  },
  previewText: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 22,
  },
  previewBullet: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 6,
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    color: '#1E293B',
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 8,
  },
  sectionSubtitle: {
    color: '#64748B',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 18,
    maxWidth: 720,
  },
  stepsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  stepCard: {
    flexGrow: 1,
    flexBasis: 280,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 22,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  stepNumber: {
    color: '#2563EB',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  stepTitle: {
    color: '#1E293B',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  stepText: {
    color: '#64748B',
    fontSize: 15,
    lineHeight: 23,
  },
  finalCtaCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 28,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
    alignItems: 'flex-start',
  },
  finalCtaTitle: {
    color: '#1E293B',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    marginBottom: 10,
    maxWidth: 720,
  },
  finalCtaSubtitle: {
    color: '#64748B',
    fontSize: 17,
    lineHeight: 26,
    marginBottom: 20,
    maxWidth: 720,
  },
  privacyCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#DBEAFE',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 20,
    width: '100%',
    maxWidth: 720,
  },
  privacyTitle: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  privacyText: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 22,
  },
});
