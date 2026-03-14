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
} from 'react-native';
import { API_URL } from '@/config/api';
import {
  createEmptyCertification,
  createEmptyEducation,
  createEmptyExperience,
  createEmptyProfile,
  createEmptyProject,
  loadProfileFromStorage,
  saveProfileToStorage,
  type UserProfile,
} from '@/lib/profileStorage';

type SectionOption = 'experience' | 'project' | 'education' | 'certification';

export default function ProfileScreen() {
  const [profile, setProfile] = useState<UserProfile>(createEmptyProfile());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [importingProfile, setImportingProfile] = useState(false);

  const [resumeImportText, setResumeImportText] = useState('');

  const [expandedBasicInfo, setExpandedBasicInfo] = useState(true);
  const [expandedSummarySkills, setExpandedSummarySkills] = useState(false);
  const [expandedImport, setExpandedImport] = useState(false);
  const [expandedItemKey, setExpandedItemKey] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);

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

  const toggleItem = (key: string) => {
    setExpandedItemKey((prev) => (prev === key ? null : key));
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
      setExpandedItemKey(`experience-${newIndex}`);
    }

    if (type === 'project') {
      const newIndex = profile.projects.length;
      setProfile((prev) => ({
        ...prev,
        projects: [...prev.projects, createEmptyProject()],
      }));
      setExpandedItemKey(`project-${newIndex}`);
    }

    if (type === 'education') {
      const newIndex = profile.education.length;
      setProfile((prev) => ({
        ...prev,
        education: [...prev.education, createEmptyEducation()],
      }));
      setExpandedItemKey(`education-${newIndex}`);
    }

    if (type === 'certification') {
      const newIndex = profile.certifications.length;
      setProfile((prev) => ({
        ...prev,
        certifications: [...prev.certifications, createEmptyCertification()],
      }));
      setExpandedItemKey(`certification-${newIndex}`);
    }

    setShowAddMenu(false);
  };

  const removeEducation = (index: number) => {
    setProfile((prev) => ({
        ...prev,
        education: prev.education.filter((_, i) => i !== index),
    }));
    setExpandedItemKey(null);
  };

  const removeExperience = (index: number) => {
    setProfile((prev) => ({
        ...prev,
        experience: prev.experience.filter((_, i) => i !== index),
    }));
    setExpandedItemKey(null);
  };

  const removeProject = (index: number) => {
    setProfile((prev) => ({
        ...prev,
        projects: prev.projects.filter((_, i) => i !== index),
    }));
    setExpandedItemKey(null);
  };

  const removeCertification = (index: number) => {
    setProfile((prev) => ({
      ...prev,
      certifications: prev.certifications.filter((_, i) => i !== index),
    }));
    setExpandedItemKey(null);
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
          onPress: () => {
            setProfile(createEmptyProfile());
            setExpandedItemKey(null);
            setExpandedBasicInfo(true);
            setExpandedSummarySkills(false);
            setExpandedImport(false);
            setShowAddMenu(false);
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
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>
            Build your full background here. Keep more detail than a normal resume so ResumAI can
            tailor stronger applications later.
          </Text>

          

          <TouchableOpacity
            style={styles.compactCard}
            onPress={() => setExpandedBasicInfo((prev) => !prev)}
          >
            <View style={styles.compactCardHeader}>
              <View>
                <Text style={styles.compactCardTitle}>Basic Info</Text>
                <Text style={styles.compactCardSubtitle}>
                  {profile.fullName || 'Your name'}
                  {profile.email ? ` • ${profile.email}` : ''}
                </Text>
              </View>
              <Text style={styles.expandText}>{expandedBasicInfo ? 'Hide' : 'Edit'}</Text>
            </View>

            {expandedBasicInfo && (
              <View style={styles.expandedSection}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                  style={styles.input}
                  value={profile.fullName}
                  onChangeText={(value) => updateField('fullName', value)}
                  placeholder="e.g. Evan Buchanan"
                  placeholderTextColor="#8C8C8C"
                />

                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={profile.email}
                  onChangeText={(value) => updateField('email', value)}
                  placeholder="e.g. ebuchanan1123@gmail.com"
                  placeholderTextColor="#8C8C8C"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />

                <Text style={styles.label}>Phone</Text>
                <TextInput
                  style={styles.input}
                  value={profile.phone}
                  onChangeText={(value) => updateField('phone', value)}
                  placeholder="e.g. (647) 355-6678"
                  placeholderTextColor="#8C8C8C"
                />

                <Text style={styles.label}>Address</Text>
                <TextInput
                  style={styles.input}
                  value={profile.location}
                  onChangeText={(value) => updateField('location', value)}
                  placeholder="e.g. Ottawa, Ontario"
                  placeholderTextColor="#8C8C8C"
                />
              </View>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.compactCard}
            onPress={() => setExpandedSummarySkills((prev) => !prev)}
          >
            <View style={styles.compactCardHeader}>
              <View>
                <Text style={styles.compactCardTitle}>Summary & Skills</Text>
                <Text style={styles.compactCardSubtitle}>
                  {profile.skills
                    ? profile.skills.split(',').slice(0, 4).join(', ')
                    : 'No skills added yet'}
                </Text>
              </View>
              <Text style={styles.expandText}>{expandedSummarySkills ? 'Hide' : 'Edit'}</Text>
            </View>

            {expandedSummarySkills && (
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
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.compactCard}
            onPress={() => setExpandedImport((prev) => !prev)}
          >
            <View style={styles.compactCardHeader}>
              <View>
                <Text style={styles.compactCardTitle}>Import From Pasted Resume</Text>
                <Text style={styles.compactCardSubtitle}>
                  Paste an existing resume and merge it into your profile
                </Text>
              </View>
              <Text style={styles.expandText}>{expandedImport ? 'Hide' : 'Open'}</Text>
            </View>

            {expandedImport && (
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
          </TouchableOpacity>

          <Text style={styles.groupHeading}>Experience</Text>
            {profile.experience.length === 0 ? (
            <View style={styles.emptyMiniCard}>
                <Text style={styles.emptyMiniCardText}>No experience added yet.</Text>
            </View>
            ) : (
            profile.experience.map((item, index) => {
                const key = `experience-${index}`;
                const expanded = expandedItemKey === key;

                return (
                <TouchableOpacity
                    key={key}
                    style={styles.compactCard}
                    activeOpacity={0.95}
                    onPress={() => toggleItem(key)}
                >
                    <View style={styles.compactCardHeader}>
                    <View style={styles.compactCardTextWrap}>
                        <Text style={styles.compactCardTitle}>{item.title}</Text>
                        <Text style={styles.compactCardSubtitle}>
                        {renderCollapsedMeta([
                            item.company,
                            `${item.startDate || 'Start'} - ${item.endDate || 'End'}`,
                        ])}
                        </Text>
                    </View>
                    <Text style={styles.expandText}>{expanded ? 'Hide' : 'Edit'}</Text>
                    </View>

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
                </TouchableOpacity>
                );
            })
            )}

          <Text style={styles.groupHeading}>Projects</Text>
          {profile.projects.length === 0 ? (
            <View style={styles.emptyMiniCard}>
                <Text style={styles.emptyMiniCardText}>No projects added yet.</Text>
            </View>
            ) : (
            profile.projects.map((item, index) => {
                const key = `project-${index}`;
                const expanded = expandedItemKey === key;

                return (
                <TouchableOpacity
                    key={key}
                    style={styles.compactCard}
                    activeOpacity={0.95}
                    onPress={() => toggleItem(key)}
                >
                    <View style={styles.compactCardHeader}>
                    <View style={styles.compactCardTextWrap}>
                        <Text style={styles.compactCardTitle}>{item.name}</Text>
                        <Text style={styles.compactCardSubtitle}>
                        {item.role || item.technologies || 'No details yet'}
                        </Text>
                    </View>
                    <Text style={styles.expandText}>{expanded ? 'Hide' : 'Edit'}</Text>
                    </View>

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
                </TouchableOpacity>
                );
            })
            )}

          <Text style={styles.groupHeading}>Education</Text>
            {profile.education.length === 0 ? (
            <View style={styles.emptyMiniCard}>
                <Text style={styles.emptyMiniCardText}>No education added yet.</Text>
            </View>
            ) : (
            profile.education.map((item, index) => {
                const key = `education-${index}`;
                const expanded = expandedItemKey === key;

                return (
                <TouchableOpacity
                    key={key}
                    style={styles.compactCard}
                    activeOpacity={0.95}
                    onPress={() => toggleItem(key)}
                >
                    <View style={styles.compactCardHeader}>
                    <View style={styles.compactCardTextWrap}>
                        <Text style={styles.compactCardTitle}>{item.school}</Text>
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
                </TouchableOpacity>
                );
            })
            )}

          <Text style={styles.groupHeading}>Certifications</Text>
          {profile.certifications.length === 0 ? (
            <View style={styles.emptyMiniCard}>
              <Text style={styles.emptyMiniCardText}>No certifications added yet.</Text>
            </View>
          ) : (
            profile.certifications.map((item, index) => {
              const key = `certification-${index}`;
              const expanded = expandedItemKey === key;

              return (
                <TouchableOpacity
                  key={key}
                  style={styles.compactCard}
                  activeOpacity={0.95}
                  onPress={() => toggleItem(key)}
                >
                  <View style={styles.compactCardHeader}>
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
                </TouchableOpacity>
              );
            })
          )}

          <View style={styles.addSectionWrap}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => setShowAddMenu((prev) => !prev)}
            >
              <Text style={styles.primaryButtonText}>
                {showAddMenu ? 'Close Add Menu' : 'Add Section'}
              </Text>
            </TouchableOpacity>

            {showAddMenu && (
              <View style={styles.addMenu}>
                <TouchableOpacity
                  style={styles.addMenuItem}
                  onPress={() => addSection('experience')}
                >
                  <Text style={styles.addMenuItemText}>Add Work Experience</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addMenuItem}
                  onPress={() => addSection('project')}
                >
                  <Text style={styles.addMenuItemText}>Add Project</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addMenuItem}
                  onPress={() => addSection('education')}
                >
                  <Text style={styles.addMenuItemText}>Add Education</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.addMenuItem}
                  onPress={() => addSection('certification')}
                >
                  <Text style={styles.addMenuItemText}>Add Certification</Text>
                </TouchableOpacity>
              </View>
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
    fontSize: 20,
    fontWeight: '800',
    marginTop: 10,
    marginBottom: 10,
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
    addSectionWrap: {
    marginTop: 8,
    marginBottom: 4,
    },
    addMenu: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    marginTop: 10,
    overflow: 'hidden',
    },
    addMenuItem: {
    paddingHorizontal: 16,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    },
    addMenuItemText: {
    color: '#1E293B',
    fontSize: 15,
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