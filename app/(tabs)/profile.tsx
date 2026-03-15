import React, { useEffect, useMemo, useState } from 'react';
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
import { API_URL } from '@/config/api';
import {
  createEmptyCertification,
  createEmptyEducation,
  createEmptyExperience,
  createEmptyProfile,
  createEmptyProject,
  clearProfileFromStorage,
  loadProfileFromStorage,
  saveProfileToStorage,
  type UserProfile,
} from '@/lib/profileStorage';

type SectionOption = 'experience' | 'project' | 'education' | 'certification';
type ExpandedPanel = 'basic' | 'summary' | 'import' | `item:${string}` | null;
type CollectionSectionKey = 'experience' | 'projects' | 'education' | 'certifications';

export default function ProfileScreen() {
  const { width } = useWindowDimensions();
  const isNarrowScreen = width < 430;
  const [profile, setProfile] = useState<UserProfile>(createEmptyProfile());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importingProfile, setImportingProfile] = useState(false);

  const [resumeImportText, setResumeImportText] = useState('');
  const [expandedPanel, setExpandedPanel] = useState<ExpandedPanel>('basic');
  const [expandedSections, setExpandedSections] = useState<Record<CollectionSectionKey, boolean>>({
    experience: false,
    projects: false,
    education: false,
    certifications: false,
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const storedProfile = await loadProfileFromStorage();
        setProfile(storedProfile);
      } catch {
        Alert.alert('Error', 'Failed to load profile data.');
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const profileCompletionText = useMemo(() => {
    let count = 0;
    if (profile.fullName.trim()) count++;
    if (profile.email.trim()) count++;
    if (profile.location.trim()) count++;
    if (profile.skills.trim()) count++;
    if (profile.education.some((item) => item.school.trim() || item.degree.trim())) count++;
    if (profile.experience.some((item) => item.company.trim() || item.title.trim())) count++;
    if (profile.projects.some((item) => item.name.trim() || item.role.trim())) count++;

    if (count <= 2) return 'Getting started';
    if (count <= 4) return 'Partially complete';
    if (count <= 6) return 'Strong profile';
    return 'Very complete';
  }, [profile]);

  const dashboardStats = useMemo(
    () => [
      { label: 'Experience', value: profile.experience.length },
      { label: 'Projects', value: profile.projects.length },
      { label: 'Education', value: profile.education.length },
      { label: 'Certs', value: profile.certifications.length },
    ],
    [profile]
  );

  const togglePanel = (panel: ExpandedPanel) => {
    setExpandedPanel((prev) => (prev === panel ? null : panel));
  };

  const toggleSection = (section: CollectionSectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const toggleItem = (key: string) => {
    togglePanel(`item:${key}`);
  };

  const updateField = (field: keyof UserProfile, value: string) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateEducationField = (
    index: number,
    field: keyof UserProfile['education'][number],
    value: string
  ) => {
    const updated = [...profile.education];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };

    setProfile((prev) => ({
      ...prev,
      education: updated,
    }));
  };

  const updateExperienceField = (
    index: number,
    field: keyof UserProfile['experience'][number],
    value: string
  ) => {
    const updated = [...profile.experience];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };

    setProfile((prev) => ({
      ...prev,
      experience: updated,
    }));
  };

  const updateProjectField = (
    index: number,
    field: keyof UserProfile['projects'][number],
    value: string
  ) => {
    const updated = [...profile.projects];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };

    setProfile((prev) => ({
      ...prev,
      projects: updated,
    }));
  };

  const updateCertificationField = (
    index: number,
    field: keyof UserProfile['certifications'][number],
    value: string
  ) => {
    const updated = [...profile.certifications];
    updated[index] = {
      ...updated[index],
      [field]: value,
    };

    setProfile((prev) => ({
      ...prev,
      certifications: updated,
    }));
  };

  const addSection = (type: SectionOption) => {
    if (type === 'experience') {
      const newIndex = profile.experience.length;
      setProfile((prev) => ({
        ...prev,
        experience: [...prev.experience, createEmptyExperience()],
      }));
      setExpandedSections((prev) => ({ ...prev, experience: true }));
      setExpandedPanel(`item:experience-${newIndex}`);
    }

    if (type === 'project') {
      const newIndex = profile.projects.length;
      setProfile((prev) => ({
        ...prev,
        projects: [...prev.projects, createEmptyProject()],
      }));
      setExpandedSections((prev) => ({ ...prev, projects: true }));
      setExpandedPanel(`item:project-${newIndex}`);
    }

    if (type === 'education') {
      const newIndex = profile.education.length;
      setProfile((prev) => ({
        ...prev,
        education: [...prev.education, createEmptyEducation()],
      }));
      setExpandedSections((prev) => ({ ...prev, education: true }));
      setExpandedPanel(`item:education-${newIndex}`);
    }

    if (type === 'certification') {
      const newIndex = profile.certifications.length;
      setProfile((prev) => ({
        ...prev,
        certifications: [...prev.certifications, createEmptyCertification()],
      }));
      setExpandedSections((prev) => ({ ...prev, certifications: true }));
      setExpandedPanel(`item:certification-${newIndex}`);
    }
  };

  const removeEducation = (index: number) => {
    setProfile((prev) => ({
        ...prev,
        education: prev.education.filter((_, i) => i !== index),
    }));
    setExpandedPanel(null);
  };

  const removeExperience = (index: number) => {
    setProfile((prev) => ({
        ...prev,
        experience: prev.experience.filter((_, i) => i !== index),
    }));
    setExpandedPanel(null);
  };

  const removeProject = (index: number) => {
    setProfile((prev) => ({
        ...prev,
        projects: prev.projects.filter((_, i) => i !== index),
    }));
    setExpandedPanel(null);
  };

  const removeCertification = (index: number) => {
    setProfile((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index),
    }));
    setExpandedPanel(null);
  };

  const saveProfile = async () => {
    try {
      setSaving(true);
      await saveProfileToStorage(profile);
      Alert.alert('Saved', 'Your profile was saved locally on this device.');
    } catch {
      Alert.alert('Error', 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const resetProfile = () => {
    Alert.alert(
      'Reset profile',
      'This will erase your current profile fields on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await clearProfileFromStorage();
              setProfile(createEmptyProfile());
              setResumeImportText('');
              setExpandedPanel('basic');
              setExpandedSections({
                experience: false,
                projects: false,
                education: false,
                certifications: false,
              });
              Alert.alert('Reset', 'Your profile has been cleared from this device.');
            } catch {
              Alert.alert('Error', 'Failed to reset profile.');
            }
          },
        },
      ]
    );
  };

  const mergeCommaSeparated = (a: string, b: string) => {
    const items = [...a.split(','), ...b.split(',')]
      .map((item) => item.trim())
      .filter(Boolean);

    const seen = new Set<string>();
    const result: string[] = [];

    for (const item of items) {
      const normalized = item.toLowerCase();
      if (!seen.has(normalized)) {
        seen.add(normalized);
        result.push(item);
      }
    }

    return result.join(', ');
  };

  const mergeEducation = (current: UserProfile['education'], incoming: UserProfile['education']) => {
    const cleanCurrent = current.filter(
      (item) => item.school.trim() || item.degree.trim() || item.fieldOfStudy.trim()
    );
    const merged = [...cleanCurrent];

    incoming.forEach((item) => {
      const exists = merged.some(
        (existing) =>
          existing.school.trim().toLowerCase() === item.school.trim().toLowerCase() &&
          existing.degree.trim().toLowerCase() === item.degree.trim().toLowerCase()
      );

      if (!exists && (item.school.trim() || item.degree.trim() || item.fieldOfStudy.trim())) {
        merged.push(item);
      }
    });

    return merged;
  };

  const mergeExperience = (
    current: UserProfile['experience'],
    incoming: UserProfile['experience']
  ) => {
    const cleanCurrent = current.filter(
      (item) => item.company.trim() || item.title.trim() || item.description.trim()
    );
    const merged = [...cleanCurrent];

    incoming.forEach((item) => {
      const exists = merged.some(
        (existing) =>
          existing.company.trim().toLowerCase() === item.company.trim().toLowerCase() &&
          existing.title.trim().toLowerCase() === item.title.trim().toLowerCase()
      );

      if (!exists && (item.company.trim() || item.title.trim() || item.description.trim())) {
        merged.push(item);
      }
    });

    return merged;
  };

  const mergeProjects = (current: UserProfile['projects'], incoming: UserProfile['projects']) => {
    const cleanCurrent = current.filter(
      (item) => item.name.trim() || item.role.trim() || item.description.trim()
    );
    const merged = [...cleanCurrent];

    incoming.forEach((item) => {
      const exists = merged.some(
        (existing) => existing.name.trim().toLowerCase() === item.name.trim().toLowerCase()
      );

      if (!exists && (item.name.trim() || item.role.trim() || item.description.trim())) {
        merged.push(item);
      }
    });

    return merged;
  };

  const mergeCertifications = (
    current: UserProfile['certifications'],
    incoming: UserProfile['certifications']
  ) => {
    const merged = [...current];

    incoming.forEach((item) => {
      const exists = merged.some(
        (existing) =>
          existing.name.trim().toLowerCase() === item.name.trim().toLowerCase() &&
          existing.issuer.trim().toLowerCase() === item.issuer.trim().toLowerCase()
      );

      if (!exists && (item.name.trim() || item.issuer.trim())) {
        merged.push(item);
      }
    });

    return merged;
  };

  const importFromResumeText = async () => {
    if (resumeImportText.trim().length < 50) {
      Alert.alert('Error', 'Please paste a longer resume first.');
      return;
    }

    try {
      setImportingProfile(true);

      const res = await fetch(`${API_URL}/parse-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          resumeText: resumeImportText,
          existingProfile: profile,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to import profile.');
      }

      const mergedProfile: UserProfile = {
        ...profile,
        fullName: profile.fullName || data.fullName || '',
        email: profile.email || data.email || '',
        phone: profile.phone || data.phone || '',
        location: profile.location || data.location || '',
        summaryHint: profile.summaryHint || data.summaryHint || '',
        skills: mergeCommaSeparated(profile.skills || '', data.skills || ''),
        education: mergeEducation(profile.education, data.education || []),
        experience: mergeExperience(profile.experience, data.experience || []),
        projects: mergeProjects(profile.projects, data.projects || []),
        certifications: mergeCertifications(profile.certifications, data.certifications || []),
      };

      setProfile(mergedProfile);
      setResumeImportText('');
      Alert.alert(
        'Imported',
        'Resume content was merged into your profile. Save your profile to keep it.'
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to import profile.');
    } finally {
      setImportingProfile(false);
    }
  };

  const renderCollapsedMeta = (parts: (string | undefined)[]) =>
    parts.filter((part) => part && part.trim()).join(' • ');

  const renderCountLabel = (count: number, singular: string, plural = `${singular}s`) =>
    `${count} ${count === 1 ? singular : plural}`;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

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
            isNarrowScreen && styles.contentContainerNarrow,
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>
            Build your full background here. Keep more detail than a normal resume so ResumAI can
            tailor stronger applications later.
          </Text>

          <View style={[styles.overviewCard, isNarrowScreen && styles.overviewCardNarrow]}>
            <View style={[styles.overviewMain, isNarrowScreen && styles.overviewMainNarrow]}>
              <Text style={styles.overviewEyebrow}>Profile Dashboard</Text>
              <Text style={styles.overviewTitle}>
                {profile.fullName || 'Start building your profile'}
              </Text>
              <Text style={styles.overviewText}>
                {profileCompletionText} with {renderCountLabel(profile.experience.length, 'role')},{' '}
                {renderCountLabel(profile.projects.length, 'project')}, and{' '}
                {renderCountLabel(profile.education.length, 'education entry')}.
              </Text>
            </View>
            <View style={[styles.overviewBadge, isNarrowScreen && styles.overviewBadgeNarrow]}>
              <Text style={styles.overviewBadgeNumber}>
                {dashboardStats.reduce((sum, item) => sum + item.value, 0)}
              </Text>
              <Text style={styles.overviewBadgeLabel}>Saved items</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            {dashboardStats.map((item) => (
              <View
                key={item.label}
                style={[styles.statChip, isNarrowScreen && styles.statChipNarrow]}
              >
                <Text style={styles.statChipValue}>{item.value}</Text>
                <Text style={styles.statChipLabel}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.compactCard}>
            <TouchableOpacity
              style={styles.compactCardHeaderButton}
              onPress={() => togglePanel('import')}
            >
              <View style={[styles.compactCardHeader, isNarrowScreen && styles.compactCardHeaderNarrow]}>
                <View>
                  <Text style={styles.compactCardTitle}>Import From Pasted Resume</Text>
                  <Text style={styles.compactCardSubtitle}>
                    Paste an existing resume and merge it into your profile
                  </Text>
                </View>
                <Text style={styles.expandText}>{expandedPanel === 'import' ? 'Hide' : 'Open'}</Text>
              </View>
            </TouchableOpacity>

            {expandedPanel === 'import' && (
              <View style={styles.expandedSection}>
                <TextInput
                  style={[styles.input, styles.largeTextArea]}
                  multiline
                  value={resumeImportText}
                  onChangeText={setResumeImportText}
                  placeholder="Paste your existing resume here..."
                  placeholderTextColor="#8C8C8C"
                  textAlignVertical="top"
                />

                <TouchableOpacity
                  style={[styles.primaryButton, importingProfile && styles.disabledButton]}
                  onPress={importFromResumeText}
                  disabled={importingProfile}
                >
                  <Text style={styles.primaryButtonText}>
                    {importingProfile ? 'Importing...' : 'Import Into Profile'}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={styles.sectionShell}>
            <View style={styles.sectionHeaderRow}>
              <View>
                <Text style={styles.groupHeading}>Core Profile</Text>
                <Text style={styles.groupCaption}>Personal details, strengths, and resume import</Text>
              </View>
            </View>
            <View style={styles.compactCard}>
              <TouchableOpacity
                style={styles.compactCardHeaderButton}
                onPress={() => togglePanel('basic')}
              >
                <View style={[styles.compactCardHeader, isNarrowScreen && styles.compactCardHeaderNarrow]}>
                  <View>
                    <Text style={styles.compactCardTitle}>Basic Info</Text>
                    <Text style={styles.compactCardSubtitle}>
                      {profile.fullName || 'Your name'}
                      {profile.email ? ` • ${profile.email}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.expandText}>{expandedPanel === 'basic' ? 'Hide' : 'Edit'}</Text>
                </View>
              </TouchableOpacity>

              {expandedPanel === 'basic' && (
                <View style={styles.expandedSection}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={profile.fullName}
                  onChangeText={(value) => updateField('fullName', value)}
                  placeholder="e.g. John Doe"
                  placeholderTextColor="#8C8C8C"
                />

                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={profile.email}
                  onChangeText={(value) => updateField('email', value)}
                  placeholder="e.g. johndoe123@gmail.com"
                  placeholderTextColor="#8C8C8C"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={styles.label}>Phone</Text>
                <TextInput
                  style={styles.input}
                  value={profile.phone}
                  onChangeText={(value) => updateField('phone', value)}
                  placeholder="e.g. (123) 456-7890"
                  placeholderTextColor="#8C8C8C"
                />

                <Text style={styles.label}>Address</Text>
                <TextInput
                  style={styles.input}
                  value={profile.location}
                  onChangeText={(value) => updateField('location', value)}
                  placeholder="e.g. Toronto, Ontario, Canada"
                  placeholderTextColor="#8C8C8C"
                />
                </View>
              )}
            </View>

            <View style={styles.compactCard}>
              <TouchableOpacity
                style={styles.compactCardHeaderButton}
                onPress={() => togglePanel('summary')}
              >
                <View style={[styles.compactCardHeader, isNarrowScreen && styles.compactCardHeaderNarrow]}>
                  <View>
                    <Text style={styles.compactCardTitle}>Summary & Skills</Text>
                    <Text style={styles.compactCardSubtitle}>
                      {profile.skills
                        ? profile.skills.split(',').slice(0, 4).join(', ')
                        : 'No skills added yet'}
                    </Text>
                  </View>
                  <Text style={styles.expandText}>{expandedPanel === 'summary' ? 'Hide' : 'Edit'}</Text>
                </View>
              </TouchableOpacity>

              {expandedPanel === 'summary' && (
                <View style={styles.expandedSection}>
                <Text style={styles.label}>Skills</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  multiline
                  value={profile.skills}
                  onChangeText={(value) => updateField('skills', value)}
                  placeholder="e.g. JavaScript, TypeScript, React, Node.js, PostgreSQL, Git"
                  placeholderTextColor="#8C8C8C"
                  textAlignVertical="top"
                />

                <Text style={styles.label}>Summary Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  multiline
                  value={profile.summaryHint}
                  onChangeText={(value) => updateField('summaryHint', value)}
                  placeholder="Add extra context about your strengths, goals, industries, or the type of work you want."
                  placeholderTextColor="#8C8C8C"
                  textAlignVertical="top"
                />
                </View>
              )}
            </View>

          </View>

          <View style={styles.addActionsCard}>
            <Text style={styles.addActionsTitle}>Add section</Text>
            <Text style={styles.addActionsSubtitle}>Create a new profile entry in one tap</Text>
            <View style={styles.addActionsGrid}>
              <TouchableOpacity style={styles.addActionButton} onPress={() => addSection('experience')}>
                <Text style={styles.addActionButtonText}>+ Experience</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addActionButton} onPress={() => addSection('project')}>
                <Text style={styles.addActionButtonText}>+ Project</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addActionButton} onPress={() => addSection('education')}>
                <Text style={styles.addActionButtonText}>+ Education</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.addActionButton} onPress={() => addSection('certification')}>
                <Text style={styles.addActionButtonText}>+ Certification</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionShell}>
          <TouchableOpacity
            style={styles.collectionSectionHeader}
            onPress={() => toggleSection('experience')}
          >
            <View>
              <Text style={styles.groupHeading}>Experience</Text>
              <Text style={styles.groupCaption}>Roles, internships, part-time work, and impact</Text>
            </View>
            <View style={[styles.collectionSectionMeta, isNarrowScreen && styles.collectionSectionMetaNarrow]}>
              <Text style={styles.sectionCount}>{renderCountLabel(profile.experience.length, 'entry', 'entries')}</Text>
              <Text style={styles.expandText}>{expandedSections.experience ? 'Hide' : 'Show'}</Text>
            </View>
          </TouchableOpacity>
          {expandedSections.experience && (
            <>
            {profile.experience.length === 0 ? (
            <View style={styles.emptyMiniCard}>
                <Text style={styles.emptyMiniCardText}>No experience added yet.</Text>
            </View>
            ) : (
            profile.experience.map((item, index) => {
                const key = `experience-${index}`;
                const expanded = expandedPanel === `item:${key}`;

                return (
                <View
                    key={key}
                    style={styles.compactCard}
                >
                    <TouchableOpacity
                      style={styles.compactCardHeaderButton}
                      activeOpacity={0.95}
                      onPress={() => toggleItem(key)}
                    >
                      <View style={[styles.compactCardHeader, isNarrowScreen && styles.compactCardHeaderNarrow]}>
                      <View style={styles.compactCardTextWrap}>
                          <Text style={styles.compactCardTitle}>{item.title || 'Untitled Role'}</Text>
                          <Text style={styles.compactCardSubtitle}>
                          {renderCollapsedMeta([
                              item.company,
                              `${item.startDate || 'Start'} - ${item.endDate || 'End'}`,
                          ]) || 'No details yet'}
                          </Text>
                      </View>
                      <Text style={styles.expandText}>{expanded ? 'Hide' : 'Edit'}</Text>
                      </View>
                    </TouchableOpacity>

                    {expanded && (
                    <View style={styles.expandedSection}>
                        <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeExperience(index)}
                        >
                        <Text style={styles.removeButtonText}>Remove Experience</Text>
                        </TouchableOpacity>

                        <Text style={styles.label}>Job Title</Text>
                        <TextInput
                        style={styles.input}
                        value={item.title}
                        onChangeText={(value) => updateExperienceField(index, 'title', value)}
                        placeholder="Web Developer"
                        placeholderTextColor="#8C8C8C"
                        />

                        <Text style={styles.label}>Company</Text>
                        <TextInput
                        style={styles.input}
                        value={item.company}
                        onChangeText={(value) => updateExperienceField(index, 'company', value)}
                        placeholder="University of Ottawa"
                        placeholderTextColor="#8C8C8C"
                        />

                        <Text style={styles.label}>Start Date</Text>
                        <TextInput
                        style={styles.input}
                        value={item.startDate}
                        onChangeText={(value) => updateExperienceField(index, 'startDate', value)}
                        placeholder="Jan 2024"
                        placeholderTextColor="#8C8C8C"
                        />

                        <Text style={styles.label}>End Date</Text>
                        <TextInput
                        style={styles.input}
                        value={item.endDate}
                        onChangeText={(value) => updateExperienceField(index, 'endDate', value)}
                        placeholder="Dec 2024"
                        placeholderTextColor="#8C8C8C"
                        />

                        <Text style={styles.label}>Location</Text>
                        <TextInput
                        style={styles.input}
                        value={item.location}
                        onChangeText={(value) => updateExperienceField(index, 'location', value)}
                        placeholder="Ottawa, Ontario"
                        placeholderTextColor="#8C8C8C"
                        />

                        <Text style={styles.label}>Technologies / Tools</Text>
                        <TextInput
                        style={styles.input}
                        value={item.technologies}
                        onChangeText={(value) => updateExperienceField(index, 'technologies', value)}
                        placeholder="React, Node.js, Git, REST APIs"
                        placeholderTextColor="#8C8C8C"
                        />

                        <Text style={styles.label}>Detailed Description</Text>
                        <TextInput
                        style={[styles.input, styles.largeTextArea]}
                        multiline
                        value={item.description}
                        onChangeText={(value) => updateExperienceField(index, 'description', value)}
                        placeholder="Describe responsibilities, collaboration, impact, debugging, tools used, and achievements."
                        placeholderTextColor="#8C8C8C"
                        textAlignVertical="top"
                        />
                    </View>
                    )}
                </View>
                );
            })
            )}
            </>
          )}
          </View>

          <View style={styles.sectionShell}>
          <TouchableOpacity
            style={styles.collectionSectionHeader}
            onPress={() => toggleSection('projects')}
          >
            <View>
              <Text style={styles.groupHeading}>Projects</Text>
              <Text style={styles.groupCaption}>Personal builds, course work, and shipped ideas</Text>
            </View>
            <View style={[styles.collectionSectionMeta, isNarrowScreen && styles.collectionSectionMetaNarrow]}>
              <Text style={styles.sectionCount}>{renderCountLabel(profile.projects.length, 'entry', 'entries')}</Text>
              <Text style={styles.expandText}>{expandedSections.projects ? 'Hide' : 'Show'}</Text>
            </View>
          </TouchableOpacity>
          {expandedSections.projects && (
            <>
          {profile.projects.length === 0 ? (
            <View style={styles.emptyMiniCard}>
                <Text style={styles.emptyMiniCardText}>No projects added yet.</Text>
            </View>
            ) : (
            profile.projects.map((item, index) => {
                const key = `project-${index}`;
                const expanded = expandedPanel === `item:${key}`;

                return (
                <View
                    key={key}
                    style={styles.compactCard}
                >
                    <TouchableOpacity
                      style={styles.compactCardHeaderButton}
                      activeOpacity={0.95}
                      onPress={() => toggleItem(key)}
                    >
                      <View style={[styles.compactCardHeader, isNarrowScreen && styles.compactCardHeaderNarrow]}>
                      <View style={styles.compactCardTextWrap}>
                          <Text style={styles.compactCardTitle}>{item.name || 'Untitled Project'}</Text>
                          <Text style={styles.compactCardSubtitle}>
                          {item.role || item.technologies || 'No details yet'}
                          </Text>
                      </View>
                      <Text style={styles.expandText}>{expanded ? 'Hide' : 'Edit'}</Text>
                      </View>
                    </TouchableOpacity>

                    {expanded && (
                    <View style={styles.expandedSection}>
                        <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeProject(index)}
                        >
                        <Text style={styles.removeButtonText}>Remove Project</Text>
                        </TouchableOpacity>

                        <Text style={styles.label}>Project Name</Text>
                        <TextInput
                        style={styles.input}
                        value={item.name}
                        onChangeText={(value) => updateProjectField(index, 'name', value)}
                        placeholder="ResumAI"
                        placeholderTextColor="#8C8C8C"
                        />

                        <Text style={styles.label}>Role</Text>
                        <TextInput
                        style={styles.input}
                        value={item.role}
                        onChangeText={(value) => updateProjectField(index, 'role', value)}
                        placeholder="Principal Developer"
                        placeholderTextColor="#8C8C8C"
                        />

                        <Text style={styles.label}>Technologies</Text>
                        <TextInput
                        style={styles.input}
                        value={item.technologies}
                        onChangeText={(value) => updateProjectField(index, 'technologies', value)}
                        placeholder="React Native, Expo, Node.js, OpenAI API"
                        placeholderTextColor="#8C8C8C"
                        />

                        <Text style={styles.label}>Link</Text>
                        <TextInput
                        style={styles.input}
                        value={item.link}
                        onChangeText={(value) => updateProjectField(index, 'link', value)}
                        placeholder="GitHub or demo link"
                        placeholderTextColor="#8C8C8C"
                        autoCapitalize="none"
                        />

                        <Text style={styles.label}>Detailed Description</Text>
                        <TextInput
                        style={[styles.input, styles.largeTextArea]}
                        multiline
                        value={item.description}
                        onChangeText={(value) => updateProjectField(index, 'description', value)}
                        placeholder="Describe what you built, why it matters, major technical details, and challenges."
                        placeholderTextColor="#8C8C8C"
                        textAlignVertical="top"
                        />
                    </View>
                    )}
                </View>
                );
            })
            )}
            </>
          )}
          </View>

          <View style={styles.sectionShell}>
          <TouchableOpacity
            style={styles.collectionSectionHeader}
            onPress={() => toggleSection('education')}
          >
            <View>
              <Text style={styles.groupHeading}>Education</Text>
              <Text style={styles.groupCaption}>Schools, degrees, coursework, and academic context</Text>
            </View>
            <View style={[styles.collectionSectionMeta, isNarrowScreen && styles.collectionSectionMetaNarrow]}>
              <Text style={styles.sectionCount}>{renderCountLabel(profile.education.length, 'entry', 'entries')}</Text>
              <Text style={styles.expandText}>{expandedSections.education ? 'Hide' : 'Show'}</Text>
            </View>
          </TouchableOpacity>
          {expandedSections.education && (
            <>
            {profile.education.length === 0 ? (
            <View style={styles.emptyMiniCard}>
                <Text style={styles.emptyMiniCardText}>No education added yet.</Text>
            </View>
            ) : (
            profile.education.map((item, index) => {
                const key = `education-${index}`;
                const expanded = expandedPanel === `item:${key}`;

                return (
                <View
                    key={key}
                    style={styles.compactCard}
                >
                    <TouchableOpacity
                      style={styles.compactCardHeaderButton}
                      activeOpacity={0.95}
                      onPress={() => toggleItem(key)}
                    >
                      <View style={[styles.compactCardHeader, isNarrowScreen && styles.compactCardHeaderNarrow]}>
                      <View style={styles.compactCardTextWrap}>
                          <Text style={styles.compactCardTitle}>{item.school || 'Untitled Education'}</Text>
                          <Text style={styles.compactCardSubtitle}>
                          {renderCollapsedMeta([
                              item.degree,
                              item.fieldOfStudy,
                              `${item.startDate || 'Start'} - ${item.endDate || 'End'}`,
                          ]) || 'No details yet'}
                          </Text>
                      </View>
                      <Text style={styles.expandText}>{expanded ? 'Hide' : 'Edit'}</Text>
                      </View>
                    </TouchableOpacity>

                    {expanded && (
                    <View style={styles.expandedSection}>
                        <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeEducation(index)}
                        >
                        <Text style={styles.removeButtonText}>Remove Education</Text>
                        </TouchableOpacity>

                        <Text style={styles.label}>School</Text>
                        <TextInput
                        style={styles.input}
                        value={item.school}
                        onChangeText={(value) => updateEducationField(index, 'school', value)}
                        placeholder="University of Ottawa"
                        placeholderTextColor="#8C8C8C"
                        />

                        <Text style={styles.label}>Degree</Text>
                        <TextInput
                        style={styles.input}
                        value={item.degree}
                        onChangeText={(value) => updateEducationField(index, 'degree', value)}
                        placeholder="Honours BSc"
                        placeholderTextColor="#8C8C8C"
                        />

                        <Text style={styles.label}>Field of Study</Text>
                        <TextInput
                        style={styles.input}
                        value={item.fieldOfStudy}
                        onChangeText={(value) => updateEducationField(index, 'fieldOfStudy', value)}
                        placeholder="Computer Science"
                        placeholderTextColor="#8C8C8C"
                        />

                        <Text style={styles.label}>Start Date</Text>
                        <TextInput
                        style={styles.input}
                        value={item.startDate}
                        onChangeText={(value) => updateEducationField(index, 'startDate', value)}
                        placeholder="Sep 2022"
                        placeholderTextColor="#8C8C8C"
                        />

                        <Text style={styles.label}>End Date</Text>
                        <TextInput
                        style={styles.input}
                        value={item.endDate}
                        onChangeText={(value) => updateEducationField(index, 'endDate', value)}
                        placeholder="Expected 2027"
                        placeholderTextColor="#8C8C8C"
                        />

                        <Text style={styles.label}>Details</Text>
                        <TextInput
                        style={[styles.input, styles.textArea]}
                        multiline
                        value={item.details}
                        onChangeText={(value) => updateEducationField(index, 'details', value)}
                        placeholder="Relevant coursework, GPA, awards, notable details..."
                        placeholderTextColor="#8C8C8C"
                        textAlignVertical="top"
                        />
                    </View>
                    )}
                </View>
                );
            })
            )}
            </>
          )}
          </View>

          <View style={styles.sectionShell}>
          <TouchableOpacity
            style={styles.collectionSectionHeader}
            onPress={() => toggleSection('certifications')}
          >
            <View>
              <Text style={styles.groupHeading}>Certifications</Text>
              <Text style={styles.groupCaption}>Credentials, licenses, and validation signals</Text>
            </View>
            <View style={[styles.collectionSectionMeta, isNarrowScreen && styles.collectionSectionMetaNarrow]}>
              <Text style={styles.sectionCount}>
                {renderCountLabel(profile.certifications.length, 'entry', 'entries')}
              </Text>
              <Text style={styles.expandText}>{expandedSections.certifications ? 'Hide' : 'Show'}</Text>
            </View>
          </TouchableOpacity>
          {expandedSections.certifications && (
            <>
          {profile.certifications.length === 0 ? (
            <View style={styles.emptyMiniCard}>
              <Text style={styles.emptyMiniCardText}>No certifications added yet.</Text>
            </View>
          ) : (
            profile.certifications.map((item, index) => {
              const key = `certification-${index}`;
              const expanded = expandedPanel === `item:${key}`;

              return (
                <View
                  key={key}
                  style={styles.compactCard}
                >
                  <TouchableOpacity
                    style={styles.compactCardHeaderButton}
                    activeOpacity={0.95}
                    onPress={() => toggleItem(key)}
                  >
                    <View style={[styles.compactCardHeader, isNarrowScreen && styles.compactCardHeaderNarrow]}>
                      <View style={styles.compactCardTextWrap}>
                        <Text style={styles.compactCardTitle}>
                          {item.name || 'Untitled Certification'}
                        </Text>
                        <Text style={styles.compactCardSubtitle}>
                          {renderCollapsedMeta([
                            item.issuer,
                            item.issueDate,
                            item.expiryDate ? `Expires ${item.expiryDate}` : undefined,
                          ]) || 'No details yet'}
                        </Text>
                      </View>
                      <Text style={styles.expandText}>{expanded ? 'Hide' : 'Edit'}</Text>
                    </View>
                  </TouchableOpacity>

                  {expanded && (
                    <View style={styles.expandedSection}>
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() => removeCertification(index)}
                      >
                        <Text style={styles.removeButtonText}>Remove Certification</Text>
                      </TouchableOpacity>

                      <Text style={styles.label}>Certification Name</Text>
                      <TextInput
                        style={styles.input}
                        value={item.name}
                        onChangeText={(value) =>
                          updateCertificationField(index, 'name', value)
                        }
                        placeholder="AZ-400 DevOps Engineer Expert"
                        placeholderTextColor="#8C8C8C"
                      />

                      <Text style={styles.label}>Issuer</Text>
                      <TextInput
                        style={styles.input}
                        value={item.issuer}
                        onChangeText={(value) =>
                          updateCertificationField(index, 'issuer', value)
                        }
                        placeholder="Microsoft"
                        placeholderTextColor="#8C8C8C"
                      />

                      <Text style={styles.label}>Issue Date</Text>
                      <TextInput
                        style={styles.input}
                        value={item.issueDate}
                        onChangeText={(value) =>
                          updateCertificationField(index, 'issueDate', value)
                        }
                        placeholder="2025"
                        placeholderTextColor="#8C8C8C"
                      />

                      <Text style={styles.label}>Expiry Date</Text>
                      <TextInput
                        style={styles.input}
                        value={item.expiryDate}
                        onChangeText={(value) =>
                          updateCertificationField(index, 'expiryDate', value)
                        }
                        placeholder="Optional"
                        placeholderTextColor="#8C8C8C"
                      />

                      <Text style={styles.label}>Credential ID</Text>
                      <TextInput
                        style={styles.input}
                        value={item.credentialId}
                        onChangeText={(value) =>
                          updateCertificationField(index, 'credentialId', value)
                        }
                        placeholder="Optional"
                        placeholderTextColor="#8C8C8C"
                      />

                      <Text style={styles.label}>Details</Text>
                      <TextInput
                        style={[styles.input, styles.textArea]}
                        multiline
                        value={item.details}
                        onChangeText={(value) =>
                          updateCertificationField(index, 'details', value)
                        }
                        placeholder="Optional details about the certification."
                        placeholderTextColor="#8C8C8C"
                        textAlignVertical="top"
                      />
                    </View>
                  )}
                </View>
              );
            })
          )}
          </>
          )}
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, saving && styles.disabledButton]}
            onPress={saveProfile}
            disabled={saving}
          >
            <Text style={styles.primaryButtonText}>
              {saving ? 'Saving...' : 'Save Profile'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.secondaryButton} onPress={resetProfile}>
            <Text style={styles.secondaryButtonText}>Reset Profile</Text>
          </TouchableOpacity>
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
    padding: 20,
    paddingBottom: 180,
    },
    contentContainerNarrow: {
    paddingHorizontal: 14,
    paddingBottom: 140,
    },
    loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    },
    loadingText: {
    color: '#64748B',
    marginTop: 12,
    fontSize: 15,
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
    marginBottom: 20,
    },
    overviewCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    },
    overviewCardNarrow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    },
    overviewMain: {
    flex: 1,
    paddingRight: 12,
    },
    overviewMainNarrow: {
    paddingRight: 0,
    },
    overviewEyebrow: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    },
    overviewTitle: {
    color: '#1E293B',
    fontSize: 18,
    fontWeight: '800',
    },
    overviewText: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 4,
    },
    overviewBadge: {
    minWidth: 96,
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    },
    overviewBadgeNarrow: {
    marginTop: 14,
    alignSelf: 'flex-start',
    },
    overviewBadgeNumber: {
    color: '#1D4ED8',
    fontSize: 28,
    fontWeight: '800',
    },
    overviewBadgeLabel: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
    },
    statsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
    gap: 8,
    },
    statChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    minWidth: '23%',
    },
    statChipNarrow: {
    width: '48%',
    minWidth: 0,
    },
    statChipValue: {
    color: '#1E293B',
    fontSize: 18,
    fontWeight: '800',
    },
    statChipLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    },
    sectionShell: {
    marginBottom: 16,
    },
    sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginBottom: 10,
    gap: 12,
    },
    compactCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
    },
    compactCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    },
    compactCardHeaderNarrow: {
    alignItems: 'flex-start',
    },
    compactCardHeaderButton: {
    borderRadius: 12,
    },
    compactCardTextWrap: {
    flex: 1,
    paddingRight: 12,
    },
    compactCardTitle: {
    color: '#1E293B',
    fontSize: 17,
    fontWeight: '800',
    },
    compactCardSubtitle: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 4,
    lineHeight: 20,
    },
    expandText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '700',
    },
    expandedSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    },
    groupHeading: {
    color: '#1E293B',
    fontSize: 21,
    fontWeight: '800',
    },
    groupCaption: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 4,
    },
    sectionCount: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
    },
    collectionSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: 12,
    marginBottom: 10,
    paddingVertical: 4,
    },
    collectionSectionMeta: {
    alignItems: 'flex-end',
    gap: 4,
    },
    collectionSectionMetaNarrow: {
    flexShrink: 0,
    marginLeft: 8,
    },
    label: {
    color: '#1E293B',
    marginTop: 12,
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
    },
    textArea: {
    minHeight: 110,
    paddingTop: 14,
    },
    largeTextArea: {
    minHeight: 170,
    paddingTop: 14,
    },
    emptyMiniCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    },
    emptyMiniCardText: {
    color: '#94A3B8',
    fontSize: 14,
    },
    addActionsCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    },
    addActionsTitle: {
    color: '#1E293B',
    fontSize: 17,
    fontWeight: '800',
    },
    addActionsSubtitle: {
    color: '#64748B',
    fontSize: 14,
    marginTop: 4,
    marginBottom: 14,
    },
    addActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    },
    addActionButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    flexShrink: 1,
    },
    addActionButtonText: {
    color: '#1D4ED8',
    fontSize: 14,
    fontWeight: '600',
    },
    primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 12,
    },
    primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 18,
    },
    primaryButtonSmall: {
    backgroundColor: '#2563EB',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    },
    primaryButtonSmallText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 14,
    },
    secondaryButton: {
    backgroundColor: '#EFF6FF',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    },
    secondaryButtonText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 16,
    },
    removeButton: {
    backgroundColor: '#FEF2F2',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignSelf: 'flex-start',
    marginBottom: 4,
    borderWidth: 1,
    borderColor: '#FECACA',
    },
    removeButtonText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 13,
    },
    disabledButton: {
    opacity: 0.7,
    },
});
