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
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  createResumeVersion,
  loadSavedResumeVersions,
  saveResumeVersions,
  type SavedResumeVersion,
} from '@/lib/resumeStorage';
import { API_URL } from '@/config/api';
import { loadProfileFromStorage, type UserProfile } from '@/lib/profileStorage';

type Tone = 'Concise' | 'Technical' | 'Impact-focused';
type ResumeStyle = 'Classic' | 'Modern' | 'Compact';

type TailoredResumeResponse = {
  summary: string;
  skills: string[];
  experience: {
    company: string;
    title: string;
    startDate: string;
    endDate: string;
    location: string;
    bullets: string[];
  }[];
  projects: {
    name: string;
    role: string;
    bullets: string[];
  }[];
  education: {
    school: string;
    degree: string;
    fieldOfStudy: string;
    startDate: string;
    endDate: string;
    details: string;
  }[];
  certifications: {
    name: string;
    issuer: string;
    issueDate: string;
    expiryDate: string;
    credentialId: string;
    details: string;
  }[];
  missingKeywords: string[];
};

type ResultSectionKey =
  | 'saved'
  | 'summary'
  | 'education'
  | 'skills'
  | 'projects'
  | 'experience'
  | 'certifications'
  | 'keywords';

export default function ResumeScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1400;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [jobDescription, setJobDescription] = useState('');
  const [tone, setTone] = useState<Tone>('Technical');
  const [resumeStyle, setResumeStyle] = useState<ResumeStyle>('Classic');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TailoredResumeResponse | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [savedVersions, setSavedVersions] = useState<SavedResumeVersion[]>([]);
  const [saveTitle, setSaveTitle] = useState('');
  const [savingVersion, setSavingVersion] = useState(false);

  const [expandedSections, setExpandedSections] = useState<Record<ResultSectionKey, boolean>>({
    saved: true,
    summary: true,
    education: true,
    skills: true,
    projects: true,
    experience: true,
    certifications: true,
    keywords: true,
  });

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [storedProfile, storedVersions] = await Promise.all([
          loadProfileFromStorage(),
          loadSavedResumeVersions(),
        ]);

        setProfile(storedProfile);
        setSavedVersions(storedVersions);
      } catch {
        Alert.alert('Error', 'Failed to load profile or saved resumes.');
      } finally {
        setProfileLoading(false);
      }
    };

    loadInitialData();
  }, []);

  const toggleSection = (key: ResultSectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const reloadProfile = async () => {
    try {
      const storedProfile = await loadProfileFromStorage();
      setProfile(storedProfile);
      Alert.alert('Loaded', 'Latest profile data loaded.');
    } catch {
      Alert.alert('Error', 'Failed to reload profile.');
    }
  };

  const tailorResume = async () => {
    if (!profile) {
      Alert.alert('Error', 'Profile is not loaded yet.');
      return;
    }

    if (jobDescription.trim().length < 30) {
      Alert.alert('Error', 'Please paste a longer job description.');
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
          profile,
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

  const saveCurrentVersion = async () => {
    if (!result || !profile) {
      Alert.alert('Error', 'Generate a resume first before saving.');
      return;
    }

    try {
      setSavingVersion(true);

      const versionTitle =
        saveTitle.trim() ||
        `Resume for ${jobDescription.split('\n')[0].slice(0, 40) || 'New Role'}`;

      const newVersion = createResumeVersion({
        title: versionTitle,
        tone,
        jobDescription,
        profile,
        result,
      });

      const updated = [newVersion, ...savedVersions];
      setSavedVersions(updated);
      await saveResumeVersions(updated);

      setSaveTitle('');
      Alert.alert('Saved', 'Resume version saved locally.');
    } catch {
      Alert.alert('Error', 'Failed to save resume version.');
    } finally {
      setSavingVersion(false);
    }
  };

  const loadVersionIntoEditor = (version: SavedResumeVersion) => {
    setResult(version.result);
    setJobDescription(version.jobDescription);
    setTone(version.tone as Tone);
    Alert.alert('Loaded', 'Saved resume version loaded into the editor.');
  };

  const deleteVersion = async (id: string) => {
    try {
      const updated = savedVersions.filter((version) => version.id !== id);
      setSavedVersions(updated);
      await saveResumeVersions(updated);
    } catch {
      Alert.alert('Error', 'Failed to delete saved version.');
    }
  };

  const copySection = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Section copied to clipboard.');
  };

  const updateSummary = (text: string) => {
    if (!result) return;
    setResult({ ...result, summary: text });
  };

  const updateSkills = (text: string) => {
    if (!result) return;
    const skills = text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setResult({ ...result, skills });
  };

  const updateMissingKeywords = (text: string) => {
    if (!result) return;
    const missingKeywords = text
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setResult({ ...result, missingKeywords });
  };

  const updateEducationField = (
    index: number,
    field: keyof TailoredResumeResponse['education'][number],
    value: string
  ) => {
    if (!result) return;
    const updated = [...result.education];
    updated[index] = { ...updated[index], [field]: value };
    setResult({ ...result, education: updated });
  };

  const updateExperienceField = (
    index: number,
    field: keyof TailoredResumeResponse['experience'][number],
    value: string
  ) => {
    if (!result) return;
    const updated = [...result.experience];
    updated[index] = { ...updated[index], [field]: value };
    setResult({ ...result, experience: updated });
  };

  const updateExperienceBullet = (expIndex: number, bulletIndex: number, value: string) => {
    if (!result) return;
    const updated = [...result.experience];
    const bullets = [...updated[expIndex].bullets];
    bullets[bulletIndex] = value;
    updated[expIndex] = { ...updated[expIndex], bullets };
    setResult({ ...result, experience: updated });
  };

  const updateProjectField = (
    index: number,
    field: keyof TailoredResumeResponse['projects'][number],
    value: string
  ) => {
    if (!result) return;
    const updated = [...result.projects];
    updated[index] = { ...updated[index], [field]: value };
    setResult({ ...result, projects: updated });
  };

  const updateProjectBullet = (projectIndex: number, bulletIndex: number, value: string) => {
    if (!result) return;
    const updated = [...result.projects];
    const bullets = [...updated[projectIndex].bullets];
    bullets[bulletIndex] = value;
    updated[projectIndex] = { ...updated[projectIndex], bullets };
    setResult({ ...result, projects: updated });
  };

  const updateCertificationField = (
    index: number,
    field: keyof TailoredResumeResponse['certifications'][number],
    value: string
  ) => {
    if (!result) return;
    const updated = [...result.certifications];
    updated[index] = { ...updated[index], [field]: value };
    setResult({ ...result, certifications: updated });
  };

  const fullResumeText = useMemo(() => {
    if (!result || !profile) return '';

    const headerLine = [profile.email?.trim(), profile.phone?.trim(), profile.location?.trim()]
      .filter(Boolean)
      .join(' | ');

    return `
${profile.fullName || 'Your Name'}
${headerLine}

SUMMARY
${result.summary}

EDUCATION
${result.education
  .map(
    (edu) =>
      `${edu.school}
${edu.degree}${edu.fieldOfStudy ? `, ${edu.fieldOfStudy}` : ''}
${edu.startDate} - ${edu.endDate}
${edu.details || ''}`.trim()
  )
  .join('\n\n')}

SKILLS
${result.skills.join(', ')}

PROJECTS
${result.projects
  .map(
    (project) =>
      `${project.name}
${project.role}
${project.bullets.map((b) => `• ${b}`).join('\n')}`.trim()
  )
  .join('\n\n')}

EXPERIENCE
${result.experience
  .map(
    (exp) =>
      `${exp.company}
${exp.title}
${exp.startDate} - ${exp.endDate}${exp.location ? ` | ${exp.location}` : ''}
${exp.bullets.map((b) => `• ${b}`).join('\n')}`.trim()
  )
  .join('\n\n')}

${
  result.certifications.length > 0
    ? `CERTIFICATIONS
${result.certifications
  .map(
    (cert) =>
      `${cert.name}
${cert.issuer}${cert.issueDate ? ` | ${cert.issueDate}` : ''}${
        cert.expiryDate ? ` | Expires ${cert.expiryDate}` : ''
      }
${cert.credentialId ? `Credential ID: ${cert.credentialId}` : ''}
${cert.details || ''}`.trim()
  )
  .join('\n\n')}

`
    : ''
}MISSING KEYWORDS
${result.missingKeywords.join(', ')}
`.trim();
  }, [profile, result]);

  const copyFullResume = async () => {
    if (!fullResumeText) return;
    await Clipboard.setStringAsync(fullResumeText);
    Alert.alert('Copied', 'Full tailored resume copied to clipboard.');
  };

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const buildResumeHtml = () => {
    if (!result || !profile) return '';

    const styleMap: Record<
      ResumeStyle,
      {
        fontFamily: string;
        bodyFontSize: string;
        bodyLineHeight: string;
        textColor: string;
        headingSize: string;
        headingWeight: string;
        headingColor: string;
        sectionSpacing: string;
        sectionBorder: string;
        itemSpacing: string;
        subtitleStyle: string;
        metaFontSize: string;
      }
    > = {
      Classic: {
        fontFamily: '"Times New Roman", serif',
        bodyFontSize: '11pt',
        bodyLineHeight: '1.4',
        textColor: '#000000',
        headingSize: '20pt',
        headingWeight: '700',
        headingColor: '#000000',
        sectionSpacing: '14px',
        sectionBorder: '1px solid #000000',
        itemSpacing: '10px',
        subtitleStyle: 'normal',
        metaFontSize: '10pt',
      },
      Modern: {
        fontFamily: 'Helvetica, Arial, sans-serif',
        bodyFontSize: '11pt',
        bodyLineHeight: '1.5',
        textColor: '#111111',
        headingSize: '22pt',
        headingWeight: '700',
        headingColor: '#1A1A1A',
        sectionSpacing: '18px',
        sectionBorder: 'none',
        itemSpacing: '12px',
        subtitleStyle: 'normal',
        metaFontSize: '10pt',
      },
      Compact: {
        fontFamily: 'Arial, sans-serif',
        bodyFontSize: '10pt',
        bodyLineHeight: '1.3',
        textColor: '#000000',
        headingSize: '18pt',
        headingWeight: '700',
        headingColor: '#000000',
        sectionSpacing: '10px',
        sectionBorder: 'none',
        itemSpacing: '4px',
        subtitleStyle: 'italic',
        metaFontSize: '9pt',
      },
    };

    const currentStyle = styleMap[resumeStyle];

    const headerLine = [
      profile.email?.trim(),
      profile.phone?.trim(),
      profile.location?.trim(),
    ]
      .filter(Boolean)
      .join(' | ');

    return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page {
        size: letter;
        margin: 0.5in;
      }

      body {
        margin: 0;
        padding: 0;
        font-family: ${currentStyle.fontFamily};
        color: ${currentStyle.textColor};
        font-size: ${currentStyle.bodyFontSize};
        line-height: ${currentStyle.bodyLineHeight};
      }

      .section-heading-block,
      .item,
      .item-title,
      .item-subtitle,
      .meta,
      ul,
      li,
      p,
      div {
        break-inside: avoid;
        page-break-inside: avoid;
      }

      h1 {
        font-size: ${currentStyle.headingSize};
        font-weight: ${currentStyle.headingWeight};
        color: ${currentStyle.headingColor};
        margin: 0 0 4px 0;
      }

      .contact {
        font-size: 11px;
        color: #444;
        margin-bottom: 16px;
      }

      .section-title {
        font-size: 12pt;
        font-weight: 700;
        color: ${currentStyle.headingColor};
        margin: ${currentStyle.sectionSpacing} 0 8px 0;
        letter-spacing: 0.4px;
        break-after: avoid;
        page-break-after: avoid;
        ${currentStyle.sectionBorder !== 'none' ? `border-bottom: ${currentStyle.sectionBorder}; padding-bottom: 3px;` : ''}
      }

      .item {
        margin-bottom: ${currentStyle.itemSpacing};
      }

      .item-title {
        font-weight: 700;
      }

      .item-subtitle {
        font-weight: 600;
        font-style: ${currentStyle.subtitleStyle};
      }

      .meta {
        color: #555;
        margin: 2px 0 4px 0;
        font-size: ${currentStyle.metaFontSize};
      }

      ul {
        margin: 4px 0 0 18px;
        padding: 0;
      }

      li {
        margin-bottom: 4px;
      }

      .para {
        margin: 0;
      }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(profile.fullName || 'Your Name')}</h1>
    <div class="contact">${escapeHtml(headerLine)}</div>

    <div class="section-title">SUMMARY</div>
    <p class="para">${escapeHtml(result.summary)}</p>

    <div class="resume-section">
      ${
        result.education.length > 0
          ? `
      <div class="section-heading-block">
        <div class="section-title">EDUCATION</div>
        <div class="item">
          <div class="item-title">${escapeHtml(result.education[0].school)}</div>
          <div class="item-subtitle">${escapeHtml(
            `${result.education[0].degree}${
              result.education[0].fieldOfStudy ? `, ${result.education[0].fieldOfStudy}` : ''
            }`
          )}</div>
          <div class="meta">${escapeHtml(
            `${result.education[0].startDate} - ${result.education[0].endDate}`
          )}</div>
          ${result.education[0].details ? `<div>${escapeHtml(result.education[0].details)}</div>` : ''}
        </div>
      </div>

      ${result.education
        .slice(1)
        .map(
          (edu) => `
        <div class="item">
          <div class="item-title">${escapeHtml(edu.school)}</div>
          <div class="item-subtitle">${escapeHtml(
            `${edu.degree}${edu.fieldOfStudy ? `, ${edu.fieldOfStudy}` : ''}`
          )}</div>
          <div class="meta">${escapeHtml(`${edu.startDate} - ${edu.endDate}`)}</div>
          ${edu.details ? `<div>${escapeHtml(edu.details)}</div>` : ''}
        </div>
      `
        )
        .join('')}
      `
          : ''
      }
    </div>

    <div class="section-title">SKILLS</div>
    <p class="para">${escapeHtml(result.skills.join(', '))}</p>

    <div class="resume-section">
      ${
        result.projects.length > 0
          ? `
      <div class="section-heading-block">
        <div class="section-title">PROJECTS</div>
        <div class="item">
          <div class="item-title">${escapeHtml(result.projects[0].name)}</div>
          <div class="item-subtitle">${escapeHtml(result.projects[0].role)}</div>
          <ul>
            ${result.projects[0].bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
          </ul>
        </div>
      </div>

      ${result.projects
        .slice(1)
        .map(
          (project) => `
        <div class="item">
          <div class="item-title">${escapeHtml(project.name)}</div>
          <div class="item-subtitle">${escapeHtml(project.role)}</div>
          <ul>
            ${project.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
          </ul>
        </div>
      `
        )
        .join('')}
      `
          : ''
      }
    </div>

    <div class="resume-section">
      ${
        result.experience.length > 0
          ? `
      <div class="section-heading-block">
        <div class="section-title">EXPERIENCE</div>
        <div class="item">
          <div class="item-title">${escapeHtml(result.experience[0].company)}</div>
          <div class="item-subtitle">${escapeHtml(result.experience[0].title)}</div>
          <div class="meta">${escapeHtml(
            `${result.experience[0].startDate} - ${result.experience[0].endDate}${
              result.experience[0].location ? ` | ${result.experience[0].location}` : ''
            }`
          )}</div>
          <ul>
            ${result.experience[0].bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
          </ul>
        </div>
      </div>

      ${result.experience
        .slice(1)
        .map(
          (exp) => `
        <div class="item">
          <div class="item-title">${escapeHtml(exp.company)}</div>
          <div class="item-subtitle">${escapeHtml(exp.title)}</div>
          <div class="meta">${escapeHtml(
            `${exp.startDate} - ${exp.endDate}${exp.location ? ` | ${exp.location}` : ''}`
          )}</div>
          <ul>
            ${exp.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
          </ul>
        </div>
      `
        )
        .join('')}
      `
          : ''
      }
    </div>

    ${
      result.certifications.length > 0
        ? `
    <div class="resume-section">
      <div class="section-heading-block">
        <div class="section-title">CERTIFICATIONS</div>
        <div class="item">
          <div class="item-title">${escapeHtml(result.certifications[0].name)}</div>
          <div class="item-subtitle">${escapeHtml(result.certifications[0].issuer)}</div>
          <div class="meta">${escapeHtml(
            `${result.certifications[0].issueDate || ''}${
              result.certifications[0].expiryDate
                ? ` | Expires ${result.certifications[0].expiryDate}`
                : ''
            }`
          )}</div>
          ${
            result.certifications[0].credentialId
              ? `<div>${escapeHtml(`Credential ID: ${result.certifications[0].credentialId}`)}</div>`
              : ''
          }
          ${result.certifications[0].details ? `<div>${escapeHtml(result.certifications[0].details)}</div>` : ''}
        </div>
      </div>

      ${result.certifications
        .slice(1)
        .map(
          (cert) => `
        <div class="item">
          <div class="item-title">${escapeHtml(cert.name)}</div>
          <div class="item-subtitle">${escapeHtml(cert.issuer)}</div>
          <div class="meta">${escapeHtml(
            `${cert.issueDate || ''}${cert.expiryDate ? ` | Expires ${cert.expiryDate}` : ''}`
          )}</div>
          ${cert.credentialId ? `<div>${escapeHtml(`Credential ID: ${cert.credentialId}`)}</div>` : ''}
          ${cert.details ? `<div>${escapeHtml(cert.details)}</div>` : ''}
        </div>
      `
        )
        .join('')}
    </div>
    `
        : ''
    }
  </body>
</html>
    `.trim();
  };

  const exportPdf = async () => {
    if (!result || !profile) return;

    try {
      setExportingPdf(true);

      const html = buildResumeHtml();

      if (Platform.OS === 'web') {
        const html2pdf = (await import('html2pdf.js')).default;
        const container = document.createElement('div');
        container.innerHTML = html;
        const element = container.querySelector('body') || container;

        const pdfOptions = {
          margin: 0.4,
          filename: `${(profile.fullName || 'resume')
            .replace(/\s+/g, '_')
            .toLowerCase()}_resume.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true },
          jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        };

        await html2pdf().from(element).set(pdfOptions as any).save();
        return;
      }

      const { uri } = await Print.printToFileAsync({ html });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert('PDF created', `Saved PDF at: ${uri}`);
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share your tailored resume',
        UTI: 'com.adobe.pdf',
      });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to export PDF.');
    } finally {
      setExportingPdf(false);
    }
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

  const ResumeStyleButton = ({ value }: { value: ResumeStyle }) => {
    const active = resumeStyle === value;

    return (
      <TouchableOpacity
        style={[styles.pillButton, active && styles.pillButtonActive]}
        onPress={() => setResumeStyle(value)}
      >
        <Text style={[styles.pillButtonText, active && styles.pillButtonTextActive]}>
          {value}
        </Text>
      </TouchableOpacity>
    );
  };

  const SectionShell = ({
    title,
    sectionKey,
    rightAction,
    children,
  }: {
    title: string;
    sectionKey: ResultSectionKey;
    rightAction?: React.ReactNode;
    children: React.ReactNode;
  }) => {
    const expanded = expandedSections[sectionKey];

    return (
      <View style={styles.resultCard}>
        <View style={styles.resultHeader}>
          <TouchableOpacity
            style={styles.resultHeaderLeft}
            onPress={() => toggleSection(sectionKey)}
            activeOpacity={0.8}
          >
            <Text style={styles.resultTitle}>{title}</Text>
            <Text style={styles.collapseText}>{expanded ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
          {rightAction}
        </View>

        {expanded ? children : null}
      </View>
    );
  };

  const renderResultContent = () => {
    if (loading) {
      return (
        <View style={styles.loadingPanel}>
          <ActivityIndicator size="large" />
          <Text style={styles.loadingText}>Building your tailored resume...</Text>
        </View>
      );
    }

    if (!result) {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>
            Your generated summary, skills, experience, projects, and keyword suggestions will appear here.
          </Text>
        </View>
      );
    }

    return (
      <>
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Save This Version</Text>
          <TextInput
            style={[styles.editInput, { marginTop: 12 }]}
            value={saveTitle}
            onChangeText={setSaveTitle}
            placeholder="e.g. Shopify SWE Intern Resume"
            placeholderTextColor="#8C8C8C"
          />

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.primaryButtonCompact, savingVersion && styles.disabledButton]}
              onPress={saveCurrentVersion}
              disabled={savingVersion}
            >
              <Text style={styles.primaryButtonCompactText}>
                {savingVersion ? 'Saving...' : 'Save Version'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButtonCompact}
              onPress={copyFullResume}
            >
              <Text style={styles.secondaryButtonCompactText}>Copy Resume</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryButtonCompact, exportingPdf && styles.disabledButton]}
              onPress={exportPdf}
              disabled={exportingPdf}
            >
              <Text style={styles.secondaryButtonCompactText}>
                {exportingPdf ? 'Exporting...' : 'Download PDF'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        <SectionShell title="Saved Resume Versions" sectionKey="saved">
          {savedVersions.length === 0 ? (
            <Text style={[styles.resultBody, { marginTop: 10 }]}>
              No saved resume versions yet.
            </Text>
          ) : (
            savedVersions.map((version) => (
              <View key={version.id} style={styles.savedVersionCard}>
                <Text style={styles.savedVersionTitle}>{version.title}</Text>
                <Text style={styles.savedVersionMeta}>
                  {version.profileName} • {version.tone} •{' '}
                  {new Date(version.createdAt).toLocaleDateString()}
                </Text>

                <View style={styles.savedVersionActions}>
                  <TouchableOpacity
                    style={styles.savedVersionButton}
                    onPress={() => loadVersionIntoEditor(version)}
                  >
                    <Text style={styles.savedVersionButtonText}>Load</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.savedVersionDeleteButton}
                    onPress={() => deleteVersion(version.id)}
                  >
                    <Text style={styles.savedVersionDeleteButtonText}>Delete</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </SectionShell>

        <SectionShell
          title="Summary"
          sectionKey="summary"
          rightAction={
            <TouchableOpacity onPress={() => copySection(result.summary)}>
              <Text style={styles.copyText}>Copy</Text>
            </TouchableOpacity>
          }
        >
          <TextInput
            style={[styles.editInput, styles.editTextArea]}
            multiline
            value={result.summary}
            onChangeText={updateSummary}
            textAlignVertical="top"
          />
        </SectionShell>

        <SectionShell title="Education" sectionKey="education">
          {result.education.map((edu, index) => (
            <View key={index} style={styles.blockItem}>
              <TextInput
                style={styles.editInput}
                value={edu.school}
                onChangeText={(value) => updateEducationField(index, 'school', value)}
                placeholder="School"
                placeholderTextColor="#8C8C8C"
              />
              <TextInput
                style={styles.editInput}
                value={edu.degree}
                onChangeText={(value) => updateEducationField(index, 'degree', value)}
                placeholder="Degree"
                placeholderTextColor="#8C8C8C"
              />
              <TextInput
                style={styles.editInput}
                value={edu.fieldOfStudy}
                onChangeText={(value) => updateEducationField(index, 'fieldOfStudy', value)}
                placeholder="Field of study"
                placeholderTextColor="#8C8C8C"
              />
              <TextInput
                style={styles.editInput}
                value={edu.startDate}
                onChangeText={(value) => updateEducationField(index, 'startDate', value)}
                placeholder="Start date"
                placeholderTextColor="#8C8C8C"
              />
              <TextInput
                style={styles.editInput}
                value={edu.endDate}
                onChangeText={(value) => updateEducationField(index, 'endDate', value)}
                placeholder="End date"
                placeholderTextColor="#8C8C8C"
              />
              <TextInput
                style={[styles.editInput, styles.editTextArea]}
                multiline
                value={edu.details}
                onChangeText={(value) => updateEducationField(index, 'details', value)}
                placeholder="Details"
                placeholderTextColor="#8C8C8C"
                textAlignVertical="top"
              />
            </View>
          ))}
        </SectionShell>

        <SectionShell
          title="Skills"
          sectionKey="skills"
          rightAction={
            <TouchableOpacity onPress={() => copySection(result.skills.join(', '))}>
              <Text style={styles.copyText}>Copy</Text>
            </TouchableOpacity>
          }
        >
          <TextInput
            style={[styles.editInput, styles.editTextArea]}
            multiline
            value={result.skills.join(', ')}
            onChangeText={updateSkills}
            placeholder="Comma-separated skills"
            placeholderTextColor="#8C8C8C"
            textAlignVertical="top"
          />
        </SectionShell>

        <SectionShell title="Projects" sectionKey="projects">
          {result.projects.map((project, index) => (
            <View key={index} style={styles.blockItem}>
              <TextInput
                style={styles.editInput}
                value={project.name}
                onChangeText={(value) => updateProjectField(index, 'name', value)}
                placeholder="Project name"
                placeholderTextColor="#8C8C8C"
              />
              <TextInput
                style={styles.editInput}
                value={project.role}
                onChangeText={(value) => updateProjectField(index, 'role', value)}
                placeholder="Role"
                placeholderTextColor="#8C8C8C"
              />
              {project.bullets.map((bullet, bulletIndex) => (
                <TextInput
                  key={bulletIndex}
                  style={[styles.editInput, styles.editTextArea]}
                  multiline
                  value={bullet}
                  onChangeText={(value) =>
                    updateProjectBullet(index, bulletIndex, value)
                  }
                  placeholder={`Project bullet ${bulletIndex + 1}`}
                  placeholderTextColor="#8C8C8C"
                  textAlignVertical="top"
                />
              ))}
            </View>
          ))}
        </SectionShell>

        <SectionShell title="Experience" sectionKey="experience">
          {result.experience.map((exp, index) => (
            <View key={index} style={styles.blockItem}>
              <TextInput
                style={styles.editInput}
                value={exp.company}
                onChangeText={(value) => updateExperienceField(index, 'company', value)}
                placeholder="Company"
                placeholderTextColor="#8C8C8C"
              />
              <TextInput
                style={styles.editInput}
                value={exp.title}
                onChangeText={(value) => updateExperienceField(index, 'title', value)}
                placeholder="Title"
                placeholderTextColor="#8C8C8C"
              />
              <TextInput
                style={styles.editInput}
                value={exp.startDate}
                onChangeText={(value) => updateExperienceField(index, 'startDate', value)}
                placeholder="Start date"
                placeholderTextColor="#8C8C8C"
              />
              <TextInput
                style={styles.editInput}
                value={exp.endDate}
                onChangeText={(value) => updateExperienceField(index, 'endDate', value)}
                placeholder="End date"
                placeholderTextColor="#8C8C8C"
              />
              <TextInput
                style={styles.editInput}
                value={exp.location}
                onChangeText={(value) => updateExperienceField(index, 'location', value)}
                placeholder="Location"
                placeholderTextColor="#8C8C8C"
              />
              {exp.bullets.map((bullet, bulletIndex) => (
                <TextInput
                  key={bulletIndex}
                  style={[styles.editInput, styles.editTextArea]}
                  multiline
                  value={bullet}
                  onChangeText={(value) =>
                    updateExperienceBullet(index, bulletIndex, value)
                  }
                  placeholder={`Experience bullet ${bulletIndex + 1}`}
                  placeholderTextColor="#8C8C8C"
                  textAlignVertical="top"
                />
              ))}
            </View>
          ))}
        </SectionShell>

        {result.certifications.length > 0 && (
          <SectionShell title="Certifications" sectionKey="certifications">
            {result.certifications.map((cert, index) => (
              <View key={index} style={styles.blockItem}>
                <TextInput
                  style={styles.editInput}
                  value={cert.name}
                  onChangeText={(value) => updateCertificationField(index, 'name', value)}
                  placeholder="Certification name"
                  placeholderTextColor="#8C8C8C"
                />
                <TextInput
                  style={styles.editInput}
                  value={cert.issuer}
                  onChangeText={(value) => updateCertificationField(index, 'issuer', value)}
                  placeholder="Issuer"
                  placeholderTextColor="#8C8C8C"
                />
                <TextInput
                  style={styles.editInput}
                  value={cert.issueDate}
                  onChangeText={(value) => updateCertificationField(index, 'issueDate', value)}
                  placeholder="Issue date"
                  placeholderTextColor="#8C8C8C"
                />
                <TextInput
                  style={styles.editInput}
                  value={cert.expiryDate}
                  onChangeText={(value) => updateCertificationField(index, 'expiryDate', value)}
                  placeholder="Expiry date"
                  placeholderTextColor="#8C8C8C"
                />
                <TextInput
                  style={styles.editInput}
                  value={cert.credentialId}
                  onChangeText={(value) => updateCertificationField(index, 'credentialId', value)}
                  placeholder="Credential ID"
                  placeholderTextColor="#8C8C8C"
                />
                <TextInput
                  style={[styles.editInput, styles.editTextArea]}
                  multiline
                  value={cert.details}
                  onChangeText={(value) => updateCertificationField(index, 'details', value)}
                  placeholder="Details"
                  placeholderTextColor="#8C8C8C"
                  textAlignVertical="top"
                />
              </View>
            ))}
          </SectionShell>
        )}

        <SectionShell
          title="Missing Keywords"
          sectionKey="keywords"
          rightAction={
            <TouchableOpacity onPress={() => copySection(result.missingKeywords.join(', '))}>
              <Text style={styles.copyText}>Copy</Text>
            </TouchableOpacity>
          }
        >
          <TextInput
            style={[styles.editInput, styles.editTextArea]}
            multiline
            value={result.missingKeywords.join(', ')}
            onChangeText={updateMissingKeywords}
            placeholder="Comma-separated keywords"
            placeholderTextColor="#8C8C8C"
            textAlignVertical="top"
          />
        </SectionShell>
      </>
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

  const contentContainerStyles = [
    styles.contentContainer,
    !isDesktop && styles.contentContainerCompact,
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={contentContainerStyles}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <View style={styles.pageHeader}>
            <Text style={styles.title}>Resume</Text>
            <Text style={styles.subtitle}>
              Generate a tailored resume from your saved profile and a target job description.
            </Text>
          </View>

          {isDesktop ? (
            <View style={styles.desktopGrid}>
              <View style={styles.desktopLeft}>
                <View style={styles.sectionCard}>
                  <View style={styles.profileStatusHeader}>
                    <Text style={styles.sectionTitle}>Profile Status</Text>
                    <TouchableOpacity style={styles.smallButton} onPress={reloadProfile}>
                      <Text style={styles.smallButtonText}>Reload</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.statusText}>
                    {profileLooksEmpty
                      ? 'Your profile looks mostly empty. Fill out the Profile page first for better results.'
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
                    placeholder="Paste the internship job description here..."
                    placeholderTextColor="#8C8C8C"
                    textAlignVertical="top"
                  />

                  <Text style={styles.label}>Tone</Text>
                  <View style={styles.pillRow}>
                    <ToneButton value="Concise" />
                    <ToneButton value="Technical" />
                    <ToneButton value="Impact-focused" />
                  </View>

                  <Text style={styles.label}>Resume Style</Text>
                  <View style={styles.pillRow}>
                    <ResumeStyleButton value="Classic" />
                    <ResumeStyleButton value="Modern" />
                    <ResumeStyleButton value="Compact" />
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.primaryButtonCompact, loading && styles.disabledButton]}
                      onPress={tailorResume}
                      disabled={loading}
                    >
                      <Text style={styles.primaryButtonCompactText}>
                        {loading ? 'Generating...' : 'Generate Resume'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.desktopRight}>{renderResultContent()}</View>
            </View>
          ) : (
            <View style={styles.mobileStack}>
              <View style={styles.mobileStackSection}>
                <View style={styles.sectionCard}>
                  <View style={styles.profileStatusHeader}>
                    <Text style={styles.sectionTitle}>Profile Status</Text>
                    <TouchableOpacity style={styles.smallButton} onPress={reloadProfile}>
                      <Text style={styles.smallButtonText}>Reload</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.statusText}>
                    {profileLooksEmpty
                      ? 'Your profile looks mostly empty. Fill out the Profile page first for better results.'
                      : `Using saved profile for ${profile?.fullName || 'this user'}.`}
                  </Text>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Target Job Description</Text>
                  <TextInput
                    style={[styles.input, styles.jobDescriptionArea, styles.jobDescriptionAreaCompact]}
                    multiline
                    value={jobDescription}
                    onChangeText={setJobDescription}
                    placeholder="Paste the internship job description here..."
                    placeholderTextColor="#8C8C8C"
                    textAlignVertical="top"
                  />

                  <Text style={styles.label}>Tone</Text>
                  <View style={styles.pillRow}>
                    <ToneButton value="Concise" />
                    <ToneButton value="Technical" />
                    <ToneButton value="Impact-focused" />
                  </View>

                  <Text style={styles.label}>Resume Style</Text>
                  <View style={styles.pillRow}>
                    <ResumeStyleButton value="Classic" />
                    <ResumeStyleButton value="Modern" />
                    <ResumeStyleButton value="Compact" />
                  </View>

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.primaryButtonCompact, loading && styles.disabledButton]}
                      onPress={tailorResume}
                      disabled={loading}
                    >
                      <Text style={styles.primaryButtonCompactText}>
                        {loading ? 'Generating...' : 'Generate Resume'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>

              <View style={styles.mobileStackSection}>{renderResultContent()}</View>
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
    flex: 1.1,
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
  loadingWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
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
    marginBottom: 0,
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
  jobDescriptionAreaCompact: {
    minHeight: 160,
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
  resultCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
    width: '100%',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  resultHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  resultTitle: {
    color: '#1E293B',
    fontWeight: '800',
    fontSize: 15,
  },
  collapseText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 12,
  },
  copyText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 13,
  },
  resultBody: {
    color: '#1E293B',
    fontSize: 15,
    lineHeight: 23,
  },
  blockItem: {
    marginTop: 12,
  },
  editInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1E293B',
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    width: '100%',
  },
  editTextArea: {
    minHeight: 78,
    paddingTop: 12,
  },
  emptyState: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 24,
    minHeight: 180,
    justifyContent: 'center',
    width: '100%',
  },
  emptyStateText: {
    color: '#94A3B8',
    fontSize: 15,
    lineHeight: 22,
  },
  savedVersionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  savedVersionTitle: {
    color: '#1E293B',
    fontSize: 15,
    fontWeight: '800',
  },
  savedVersionMeta: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 4,
  },
  savedVersionActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  savedVersionButton: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  savedVersionButtonText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 13,
  },
  savedVersionDeleteButton: {
    backgroundColor: '#FEF2F2',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  savedVersionDeleteButtonText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 13,
  },
});