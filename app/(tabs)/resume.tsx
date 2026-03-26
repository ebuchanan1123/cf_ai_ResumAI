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
  type ViewStyle,
  useWindowDimensions,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import {
  createResumeVersion,
  loadCurrentResumeDraft,
  loadSavedResumeVersions,
  saveCurrentResumeDraft,
  saveResumeVersions,
  type SavedResumeVersion,
} from '@/lib/resumeStorage';
import {
  consumeDailyUsage,
  getDailyUsage,
  getLimitReachedMessage,
  releaseDailyUsage,
} from '@/lib/rateLimits';
import { API_URL } from '@/config/api';
import { loadProfileFromStorage, type UserProfile } from '@/lib/profileStorage';

type Tone = 'Concise' | 'Technical' | 'Impact-focused';
type ResumeStyle =
  | 'Classic'
  | 'Modern'
  | 'Compact'
  | 'Executive'
  | 'Spotlight'
  | 'Nordic'
  | 'Mono'
  | 'Canvas';

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
  | 'ats'
  | 'summary'
  | 'education'
  | 'skills'
  | 'projects'
  | 'experience'
  | 'certifications';

const RESUME_STYLE_OPTIONS: {
  value: ResumeStyle;
  label: string;
  description: string;
  accent: string;
  previewBackground: string;
  previewInk: string;
}[] = [
  {
    value: 'Classic',
    label: 'Classic Serif',
    description: 'Traditional and understated',
    accent: '#64748B',
    previewBackground: '#FFFFFF',
    previewInk: '#111827',
  },
  {
    value: 'Modern',
    label: 'Modern Clean',
    description: 'Minimal and recruiter-friendly',
    accent: '#2563EB',
    previewBackground: '#FFFFFF',
    previewInk: '#0F172A',
  },
  {
    value: 'Compact',
    label: 'Compact Tight',
    description: 'Dense layout for one-page focus',
    accent: '#334155',
    previewBackground: '#FFFFFF',
    previewInk: '#0F172A',
  },
  {
    value: 'Executive',
    label: 'Executive Gold',
    description: 'Warm, polished, and premium',
    accent: '#B45309',
    previewBackground: '#FFFBF5',
    previewInk: '#14213D',
  },
  {
    value: 'Spotlight',
    label: 'Spotlight Bright',
    description: 'Bold sections with energetic contrast',
    accent: '#0EA5E9',
    previewBackground: '#F8FBFF',
    previewInk: '#0B3B66',
  },
  {
    value: 'Nordic',
    label: 'Nordic Air',
    description: 'Cool, airy, and editorial',
    accent: '#2A9D8F',
    previewBackground: '#F5FAFC',
    previewInk: '#16324F',
  },
  {
    value: 'Mono',
    label: 'Mono Type',
    description: 'Technical and distinctive',
    accent: '#111827',
    previewBackground: '#FFFFFF',
    previewInk: '#111827',
  },
  {
    value: 'Canvas',
    label: 'Canvas Creative',
    description: 'Color-forward and expressive',
    accent: '#F97316',
    previewBackground: '#FFFDF8',
    previewInk: '#6D28D9',
  },
];

const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.alert(`${title}\n\n${message}`);
    return;
  }

  Alert.alert(title, message);
};

const normalizeExternalUrl = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const buildContactItems = (profile: UserProfile | null): { label: string; href?: string }[] => {
  if (!profile) return [];

  const items: { label: string; href?: string }[] = [];

  if (profile.email?.trim()) {
    const email = profile.email.trim();
    items.push({ label: email, href: `mailto:${email}` });
  }

  if (profile.phone?.trim()) {
    items.push({ label: profile.phone.trim() });
  }

  if (profile.location?.trim()) {
    items.push({ label: profile.location.trim() });
  }

  if (profile.linkedinUrl?.trim()) {
    items.push({
      label: 'LinkedIn',
      href: normalizeExternalUrl(profile.linkedinUrl),
    });
  }

  if (profile.githubUrl?.trim()) {
    items.push({
      label: 'GitHub',
      href: normalizeExternalUrl(profile.githubUrl),
    });
  }

  return items;
};

const normalizePdfText = (value: string) =>
  (value || '')
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u00A0/g, ' ')
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ' ');

const ATS_STOP_WORDS = new Set([
  'about',
  'ability',
  'across',
  'after',
  'also',
  'among',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'because',
  'build',
  'built',
  'by',
  'can',
  'collaborate',
  'company',
  'create',
  'creating',
  'day',
  'deliver',
  'develop',
  'developing',
  'development',
  'experience',
  'for',
  'from',
  'have',
  'help',
  'ideal',
  'in',
  'intern',
  'internship',
  'into',
  'is',
  'job',
  'join',
  'looking',
  'our',
  'role',
  'skills',
  'software',
  'strong',
  'team',
  'that',
  'the',
  'their',
  'this',
  'through',
  'to',
  'using',
  'we',
  'well',
  'with',
  'work',
  'working',
  'you',
  'your',
]);

const extractImportantKeywords = (text: string) => {
  const matches = text.match(/[A-Za-z][A-Za-z0-9+#./-]*/g) ?? [];
  const counts = new Map<string, number>();

  matches.forEach((rawToken) => {
    const normalized = rawToken.toLowerCase();
    const isShortAllowed = ['ai', 'ml', 'ui', 'ux', 'go', 'c', 'c#'].includes(normalized);

    if ((!isShortAllowed && normalized.length < 3) || ATS_STOP_WORDS.has(normalized)) {
      return;
    }

    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  });

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([keyword]) => keyword)
    .slice(0, 24);
};

const formatKeywordLabel = (keyword: string) =>
  keyword
    .split(/[\s-]+/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');

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
  const [expandedEntryEditor, setExpandedEntryEditor] = useState<string | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);

  const [expandedSections, setExpandedSections] = useState<Record<ResultSectionKey, boolean>>({
    saved: false,
    ats: true,
    summary: false,
    education: false,
    skills: false,
    projects: false,
    experience: false,
    certifications: false,
  });

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const [storedProfile, storedVersions, storedDraft] = await Promise.all([
          loadProfileFromStorage(),
          loadSavedResumeVersions(),
          loadCurrentResumeDraft(),
        ]);

        setProfile(storedProfile);
        setSavedVersions(storedVersions);
        setJobDescription(storedDraft.jobDescription || '');
        setSaveTitle(storedDraft.saveTitle || '');
        if (storedDraft.tone === 'Concise' || storedDraft.tone === 'Technical' || storedDraft.tone === 'Impact-focused') {
          setTone(storedDraft.tone);
        }
        if (RESUME_STYLE_OPTIONS.some((option) => option.value === storedDraft.resumeStyle)) {
          setResumeStyle(storedDraft.resumeStyle as ResumeStyle);
        }
        setResult(storedDraft.result || null);
      } catch {
        showAlert('Error', 'Failed to load profile or saved resumes.');
      } finally {
        setDraftHydrated(true);
        setProfileLoading(false);
      }
    };

    loadInitialData();
  }, []);

  useEffect(() => {
    if (!draftHydrated) return;

    const timeoutId = setTimeout(() => {
      void saveCurrentResumeDraft({
        jobDescription,
        tone,
        resumeStyle,
        saveTitle,
        result,
      });
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [draftHydrated, jobDescription, tone, resumeStyle, saveTitle, result]);

  const toggleSection = (key: ResultSectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const toggleEntryEditor = (key: string) => {
    setExpandedEntryEditor((prev) => (prev === key ? null : key));
  };

  const reloadProfile = async () => {
    try {
      const storedProfile = await loadProfileFromStorage();
      setProfile(storedProfile);
      showAlert('Loaded', 'Latest profile data loaded.');
    } catch {
      showAlert('Error', 'Failed to reload profile.');
    }
  };

  const tailorResume = async () => {
    if (!profile) {
      showAlert('Error', 'Profile is not loaded yet.');
      return;
    }

    if (jobDescription.trim().length < 30) {
      showAlert('Error', 'Please paste a longer job description.');
      return;
    }

    let usageConsumed = false;

    try {
      setLoading(true);
      setResult(null);

      const usage = await getDailyUsage('resume_generation');
      if (usage.remaining === 0) {
        showAlert(
          'Daily limit reached',
          getLimitReachedMessage('resume_generation', 'resume generations')
        );
        return;
      }

      await consumeDailyUsage('resume_generation');
      usageConsumed = true;

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
      setExpandedEntryEditor(null);
      setExpandedSections({
        saved: false,
        ats: true,
        summary: false,
        education: false,
        skills: false,
        projects: false,
        experience: false,
        certifications: false,
      });
    } catch (err: any) {
      if (usageConsumed) {
        await releaseDailyUsage('resume_generation');
      }
      showAlert('Error', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const saveCurrentVersion = async () => {
    if (!result || !profile) {
      showAlert('Error', 'Generate a resume first before saving.');
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
      showAlert('Saved', 'Resume version saved locally.');
    } catch {
      showAlert('Error', 'Failed to save resume version.');
    } finally {
      setSavingVersion(false);
    }
  };

  const loadVersionIntoEditor = (version: SavedResumeVersion) => {
    setResult(version.result);
    setJobDescription(version.jobDescription);
    setTone(version.tone as Tone);
    showAlert('Loaded', 'Saved resume version loaded into the editor.');
  };

  const deleteVersion = async (id: string) => {
    try {
      const updated = savedVersions.filter((version) => version.id !== id);
      setSavedVersions(updated);
      await saveResumeVersions(updated);
    } catch {
      showAlert('Error', 'Failed to delete saved version.');
    }
  };

  const copySection = async (text: string) => {
    await Clipboard.setStringAsync(text);
    showAlert('Copied', 'Section copied to clipboard.');
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

    const headerLine = buildContactItems(profile)
      .map((item) => item.label)
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
}
`.trim();
  }, [profile, result]);

  const atsInsights = useMemo(() => {
    if (!result || !jobDescription.trim()) return null;

    const resumeCorpus = [
      result.summary,
      result.skills.join(' '),
      ...result.education.map((edu) =>
        [edu.school, edu.degree, edu.fieldOfStudy, edu.details].filter(Boolean).join(' ')
      ),
      ...result.projects.map((project) =>
        [project.name, project.role, ...project.bullets].filter(Boolean).join(' ')
      ),
      ...result.experience.map((exp) =>
        [exp.company, exp.title, exp.location, ...exp.bullets].filter(Boolean).join(' ')
      ),
      ...result.certifications.map((cert) =>
        [cert.name, cert.issuer, cert.details, cert.credentialId].filter(Boolean).join(' ')
      ),
    ]
      .join(' ')
      .toLowerCase();

    const extractedKeywords = extractImportantKeywords(jobDescription);
    const matchedKeywords = extractedKeywords.filter((keyword) => resumeCorpus.includes(keyword));
    const suggestedKeywords = [...new Set(result.missingKeywords.map((keyword) => keyword.trim()).filter(Boolean))];
    const denominator = matchedKeywords.length + suggestedKeywords.length;
    const score = denominator === 0 ? 100 : Math.round((matchedKeywords.length / denominator) * 100);

    let toneLabel = 'Strong alignment';
    let color = '#15803D';

    if (score < 50) {
      toneLabel = 'Needs stronger alignment';
      color = '#EF4444';
    } else if (score < 70) {
      toneLabel = 'Some important gaps remain';
      color = '#F59E0B';
    } else if (score < 90) {
      toneLabel = 'Looking competitive';
      color = '#84CC16';
    }

    return {
      score,
      toneLabel,
      color,
      matchedCount: matchedKeywords.length,
      suggestedKeywords,
    };
  }, [jobDescription, result]);

  const copyFullResume = async () => {
    if (!fullResumeText) return;
    await Clipboard.setStringAsync(fullResumeText);
    showAlert('Copied', 'Full tailored resume copied to clipboard.');
  };

  const escapeHtml = (value: string) =>
    value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

  const getPdfTheme = (style: ResumeStyle) => {
    const themes: Record<
      ResumeStyle,
      {
        font: 'times' | 'helvetica' | 'courier';
        headingColor: [number, number, number];
        textColor: [number, number, number];
        accentColor: [number, number, number];
        sectionFill?: [number, number, number];
      }
    > = {
      Classic: {
        font: 'times',
        headingColor: [0, 0, 0],
        textColor: [15, 23, 42],
        accentColor: [0, 0, 0],
      },
      Modern: {
        font: 'helvetica',
        headingColor: [26, 26, 26],
        textColor: [17, 17, 17],
        accentColor: [37, 99, 235],
      },
      Compact: {
        font: 'helvetica',
        headingColor: [0, 0, 0],
        textColor: [15, 23, 42],
        accentColor: [51, 65, 85],
      },
      Executive: {
        font: 'times',
        headingColor: [15, 23, 42],
        textColor: [20, 33, 61],
        accentColor: [180, 83, 9],
        sectionFill: [254, 243, 199],
      },
      Spotlight: {
        font: 'helvetica',
        headingColor: [11, 59, 102],
        textColor: [15, 23, 42],
        accentColor: [14, 165, 233],
        sectionFill: [224, 242, 254],
      },
      Nordic: {
        font: 'helvetica',
        headingColor: [22, 50, 79],
        textColor: [22, 50, 79],
        accentColor: [42, 157, 143],
        sectionFill: [224, 242, 241],
      },
      Mono: {
        font: 'courier',
        headingColor: [17, 24, 39],
        textColor: [17, 24, 39],
        accentColor: [17, 24, 39],
        sectionFill: [243, 244, 246],
      },
      Canvas: {
        font: 'helvetica',
        headingColor: [124, 58, 237],
        textColor: [31, 41, 55],
        accentColor: [249, 115, 22],
        sectionFill: [255, 237, 213],
      },
    };

    return themes[style];
  };

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
        pageBackground: string;
        accentColor: string;
        contactColor: string;
        sectionTitleBackground: string;
        sectionTitlePadding: string;
        itemTitleColor: string;
        bulletMarkerColor: string;
        headingBorder: string;
        sectionTitleBorder: string;
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
        pageBackground: '#FFFFFF',
        accentColor: '#000000',
        contactColor: '#444444',
        sectionTitleBackground: 'transparent',
        sectionTitlePadding: '0 0 3px 0',
        itemTitleColor: '#000000',
        bulletMarkerColor: '#000000',
        headingBorder: 'none',
        sectionTitleBorder: 'none',
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
        pageBackground: '#FFFFFF',
        accentColor: '#1A1A1A',
        contactColor: '#475569',
        sectionTitleBackground: 'transparent',
        sectionTitlePadding: '0',
        itemTitleColor: '#111111',
        bulletMarkerColor: '#2563EB',
        headingBorder: 'none',
        sectionTitleBorder: 'none',
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
        pageBackground: '#FFFFFF',
        accentColor: '#000000',
        contactColor: '#555555',
        sectionTitleBackground: 'transparent',
        sectionTitlePadding: '0',
        itemTitleColor: '#000000',
        bulletMarkerColor: '#0F172A',
        headingBorder: 'none',
        sectionTitleBorder: 'none',
      },
      Executive: {
        fontFamily: 'Georgia, "Times New Roman", serif',
        bodyFontSize: '10.8pt',
        bodyLineHeight: '1.45',
        textColor: '#14213D',
        headingSize: '24pt',
        headingWeight: '700',
        headingColor: '#0F172A',
        sectionSpacing: '18px',
        sectionBorder: 'none',
        itemSpacing: '12px',
        subtitleStyle: 'normal',
        metaFontSize: '9.5pt',
        pageBackground: '#FFFBF5',
        accentColor: '#B45309',
        contactColor: '#7C2D12',
        sectionTitleBackground: '#FEF3C7',
        sectionTitlePadding: '6px 10px',
        itemTitleColor: '#1E3A8A',
        bulletMarkerColor: '#B45309',
        headingBorder: '6px solid #B45309',
        sectionTitleBorder: '4px solid #B45309',
      },
      Spotlight: {
        fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
        bodyFontSize: '11pt',
        bodyLineHeight: '1.5',
        textColor: '#0F172A',
        headingSize: '25pt',
        headingWeight: '800',
        headingColor: '#0B3B66',
        sectionSpacing: '18px',
        sectionBorder: 'none',
        itemSpacing: '12px',
        subtitleStyle: 'normal',
        metaFontSize: '9.5pt',
        pageBackground: '#F8FBFF',
        accentColor: '#0EA5E9',
        contactColor: '#0369A1',
        sectionTitleBackground: '#E0F2FE',
        sectionTitlePadding: '6px 10px',
        itemTitleColor: '#0B3B66',
        bulletMarkerColor: '#EC4899',
        headingBorder: '6px solid #0EA5E9',
        sectionTitleBorder: '4px solid #0EA5E9',
      },
      Nordic: {
        fontFamily: '"Avenir Next", "Segoe UI", sans-serif',
        bodyFontSize: '10.8pt',
        bodyLineHeight: '1.48',
        textColor: '#16324F',
        headingSize: '24pt',
        headingWeight: '800',
        headingColor: '#16324F',
        sectionSpacing: '18px',
        sectionBorder: 'none',
        itemSpacing: '12px',
        subtitleStyle: 'normal',
        metaFontSize: '9.5pt',
        pageBackground: '#F5FAFC',
        accentColor: '#2A9D8F',
        contactColor: '#3D5A80',
        sectionTitleBackground: '#E0F2F1',
        sectionTitlePadding: '6px 10px',
        itemTitleColor: '#1D3557',
        bulletMarkerColor: '#2A9D8F',
        headingBorder: '6px solid #2A9D8F',
        sectionTitleBorder: '4px solid #2A9D8F',
      },
      Mono: {
        fontFamily: '"Courier New", "SFMono-Regular", monospace',
        bodyFontSize: '10.2pt',
        bodyLineHeight: '1.45',
        textColor: '#111827',
        headingSize: '22pt',
        headingWeight: '700',
        headingColor: '#111827',
        sectionSpacing: '16px',
        sectionBorder: '1px solid #111827',
        itemSpacing: '10px',
        subtitleStyle: 'normal',
        metaFontSize: '9pt',
        pageBackground: '#FFFFFF',
        accentColor: '#111827',
        contactColor: '#374151',
        sectionTitleBackground: '#F3F4F6',
        sectionTitlePadding: '5px 8px',
        itemTitleColor: '#111827',
        bulletMarkerColor: '#111827',
        headingBorder: 'none',
        sectionTitleBorder: 'none',
      },
      Canvas: {
        fontFamily: '"Gill Sans", "Trebuchet MS", sans-serif',
        bodyFontSize: '11pt',
        bodyLineHeight: '1.5',
        textColor: '#1F2937',
        headingSize: '25pt',
        headingWeight: '800',
        headingColor: '#7C3AED',
        sectionSpacing: '18px',
        sectionBorder: 'none',
        itemSpacing: '12px',
        subtitleStyle: 'normal',
        metaFontSize: '9.5pt',
        pageBackground: '#FFFDF8',
        accentColor: '#F97316',
        contactColor: '#7C2D12',
        sectionTitleBackground: '#FFEDD5',
        sectionTitlePadding: '6px 10px',
        itemTitleColor: '#6D28D9',
        bulletMarkerColor: '#F97316',
        headingBorder: '6px solid #F97316',
        sectionTitleBorder: '4px solid #F97316',
      },
    };

    const currentStyle = styleMap[resumeStyle];

    const contactLine = buildContactItems(profile)
      .map((item) =>
        item.href ? `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>` : escapeHtml(item.label)
      )
      .join('<span class="contact-separator"> | </span>');

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
        background: ${currentStyle.pageBackground};
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .resume-shell {
        width: 100%;
        box-sizing: border-box;
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
        ${currentStyle.headingBorder !== 'none' ? `border-left: ${currentStyle.headingBorder}; padding-left: 12px;` : ''}
      }

      .contact {
        font-size: 11px;
        color: ${currentStyle.contactColor};
        margin-bottom: 16px;
        padding-left: 18px;
      }

      .contact a {
        color: ${currentStyle.contactColor};
        text-decoration: underline;
      }

      .contact-separator {
        color: ${currentStyle.contactColor};
      }

      .section-title {
        font-size: 12pt;
        font-weight: 700;
        color: ${currentStyle.headingColor};
        margin: ${currentStyle.sectionSpacing} 0 8px 0;
        letter-spacing: 0.4px;
        break-after: avoid;
        page-break-after: avoid;
        background: ${currentStyle.sectionTitleBackground};
        padding: ${currentStyle.sectionTitlePadding};
        ${currentStyle.sectionTitleBorder !== 'none' ? `border-left: ${currentStyle.sectionTitleBorder};` : ''}
        ${currentStyle.sectionBorder !== 'none' ? `border-bottom: ${currentStyle.sectionBorder}; padding-bottom: 3px;` : ''}
      }

      .item {
        margin-bottom: ${currentStyle.itemSpacing};
      }

      .item-title {
        font-weight: 700;
        color: ${currentStyle.itemTitleColor};
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

      li::marker {
        color: ${currentStyle.bulletMarkerColor};
      }

      .para {
        margin: 0;
      }
    </style>
  </head>
  <body>
    <div class="resume-shell">
    <h1>${escapeHtml(profile.fullName || 'Your Name')}</h1>
    <div class="contact">${contactLine}</div>

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
    </div>
  </body>
</html>
    `.trim();
  };

  const exportPdf = async () => {
    if (!result || !profile) return;

    try {
      setExportingPdf(true);

      if (Platform.OS === 'web') {
        const jspdfModule = await import('jspdf/dist/jspdf.es.min.js');
        const { jsPDF } = jspdfModule as any;
        
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'pt',
          format: 'letter',
        });
        const theme = getPdfTheme(resumeStyle);
        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const marginX = 42;
        const marginTop = 42;
        const marginBottom = 42;
        const contentWidth = pageWidth - marginX * 2;
        const bodyX = marginX + 10;
        const bodyContentWidth = contentWidth - 20;
        const sectionGap = 8;
        const sectionContentGap = 12;
        const itemGap = 10;
        const bulletIndent = 12;
        const lineHeight = 14;

        let y = marginTop;

        const ensureSpace = (needed: number) => {
          if (y + needed > pageHeight - marginBottom) {
            pdf.addPage();
            y = marginTop;
          }
        };

        const setTextColor = (color: [number, number, number]) => {
          pdf.setTextColor(color[0], color[1], color[2]);
        };

        const drawWrappedText = (
          text: string,
          x: number,
          width: number,
          options?: {
            fontSize?: number;
            lineGap?: number;
            color?: [number, number, number];
            fontStyle?: 'normal' | 'bold';
          }
        ) => {
          const fontSize = options?.fontSize ?? 10.5;
          const appliedLineHeight = options?.lineGap ?? lineHeight;
          const safeText = normalizePdfText(text).trim();
          if (!safeText) return;
          pdf.setFont(theme.font, options?.fontStyle ?? 'normal');
          pdf.setFontSize(fontSize);
          setTextColor(options?.color ?? theme.textColor);
          const lines = pdf.splitTextToSize(safeText, width);
          ensureSpace(lines.length * appliedLineHeight);
          pdf.text(lines, x, y);
          y += lines.length * appliedLineHeight;
        };

        const drawSectionTitle = (title: string) => {
          ensureSpace(28);
          const safeTitle = normalizePdfText(title).trim();
          if (!safeTitle) return;
          if (theme.sectionFill) {
            pdf.setFillColor(theme.sectionFill[0], theme.sectionFill[1], theme.sectionFill[2]);
            pdf.roundedRect(marginX, y - 11, contentWidth, 18, 3, 3, 'F');
          }
          pdf.setDrawColor(theme.accentColor[0], theme.accentColor[1], theme.accentColor[2]);
          pdf.setLineWidth(3);
          pdf.line(marginX, y - 11, marginX, y + 7);
          pdf.setFont(theme.font, 'bold');
          pdf.setFontSize(11.5);
          setTextColor(theme.headingColor);
          pdf.text(safeTitle, marginX + 10, y + 2);
          y += sectionGap;
        };

        const drawMetaLine = (text: string) => {
          drawWrappedText(text, bodyX, bodyContentWidth, {
            fontSize: 9.5,
            lineGap: 12,
            color: [85, 85, 85],
          });
        };

        const drawContactLine = (items: { label: string; href?: string }[]) => {
          if (!items.length) return;

          const baselineGap = 12;
          const maxX = marginX + contentWidth;
          let currentX = marginX;
          let currentY = y;

          pdf.setFont(theme.font, 'normal');
          pdf.setFontSize(9.5);

          items.forEach((item, index) => {
            const safeLabel = normalizePdfText(item.label).trim();
            if (!safeLabel) return;
            const labelWidth = pdf.getTextWidth(safeLabel);

            if (index > 0) {
              const separatorWidth = pdf.getTextWidth(' | ');
              if (currentX > marginX && currentX + separatorWidth + labelWidth > maxX) {
                currentX = marginX;
                currentY += baselineGap;
              } else {
                setTextColor(theme.accentColor);
                pdf.text(' | ', currentX, currentY);
                currentX += separatorWidth;
              }
            } else if (currentX + labelWidth > maxX) {
              currentY += baselineGap;
              currentX = marginX;
            }

            setTextColor(item.href ? theme.accentColor : theme.textColor);
            if (item.href) {
              pdf.textWithLink(safeLabel, currentX, currentY, { url: item.href });
            } else {
              pdf.text(safeLabel, currentX, currentY);
            }
            currentX += labelWidth;
          });

          y = currentY + baselineGap;
        };

        const drawBulletList = (bullets: string[]) => {
          bullets.filter(Boolean).forEach((bullet) => {
            const bulletLines = pdf.splitTextToSize(
              normalizePdfText(bullet).trim(),
              bodyContentWidth - bulletIndent - 10
            );
            ensureSpace(bulletLines.length * lineHeight + 2);
            pdf.setFont(theme.font, 'normal');
            pdf.setFontSize(10.5);
            setTextColor(theme.accentColor);
            pdf.text('\u2022', bodyX, y);
            setTextColor(theme.textColor);
            pdf.text(bulletLines, bodyX + bulletIndent, y);
            y += bulletLines.length * lineHeight;
            y += 2;
          });
        };

        const drawEntry = ({
          title,
          subtitle,
          meta,
          details,
          bullets,
        }: {
          title?: string;
          subtitle?: string;
          meta?: string;
          details?: string;
          bullets?: string[];
        }) => {
          ensureSpace(42);
          if (title?.trim()) {
            drawWrappedText(title, bodyX, bodyContentWidth, {
              fontSize: 11.5,
              lineGap: 14,
              color: theme.headingColor,
              fontStyle: 'bold',
            });
          }
          if (subtitle?.trim()) {
            drawWrappedText(subtitle, bodyX, bodyContentWidth, {
              fontSize: 10.5,
              lineGap: 13,
              color: theme.textColor,
              fontStyle: 'normal',
            });
          }
          if (meta?.trim()) {
            drawMetaLine(meta);
            y += 5;
          }
          if (details?.trim()) {
            drawWrappedText(details, bodyX, bodyContentWidth, { fontSize: 10, lineGap: 13 });
          }
          if (bullets?.length) {
            drawBulletList(bullets);
          }
          y += itemGap;
        };

        pdf.setFont(theme.font, 'bold');
        pdf.setFontSize(22);
        setTextColor(theme.headingColor);
        pdf.text(normalizePdfText(profile.fullName || 'Your Name'), marginX, y);
        y += 20;

        const contactItems = buildContactItems(profile);

        if (contactItems.length) {
          drawContactLine(contactItems);
          y += 12;
        }

        drawSectionTitle('SUMMARY');
        y += sectionContentGap;
        drawWrappedText(result.summary, bodyX, bodyContentWidth, { fontSize: 10.5, lineGap: 14 });
        y += 4;

        if (result.education.length) {
          drawSectionTitle('EDUCATION');
          y += sectionContentGap;
          result.education.forEach((edu) => {
            drawEntry({
              title: edu.school,
              subtitle: [edu.degree, edu.fieldOfStudy].filter(Boolean).join(', '),
              meta: [edu.startDate, edu.endDate].filter(Boolean).join(' - '),
              details: edu.details,
            });
          });
        }

        if (result.skills.length) {
          drawSectionTitle('SKILLS');
          y += sectionContentGap;
          drawWrappedText(result.skills.join(', '), bodyX, bodyContentWidth, {
            fontSize: 10.5,
            lineGap: 14,
          });
          y += 4;
        }

        if (result.projects.length) {
          drawSectionTitle('PROJECTS');
          y += sectionContentGap;
          result.projects.forEach((project) => {
            drawEntry({
              title: project.name,
              subtitle: project.role,
              bullets: project.bullets,
            });
          });
        }

        if (result.experience.length) {
          drawSectionTitle('EXPERIENCE');
          y += sectionContentGap;
          result.experience.forEach((exp) => {
            drawEntry({
              title: exp.company,
              subtitle: exp.title,
              meta: [exp.startDate && exp.endDate ? `${exp.startDate} - ${exp.endDate}` : '', exp.location]
                .filter(Boolean)
                .join(' | '),
              bullets: exp.bullets,
            });
          });
        }

        if (result.certifications.length) {
          drawSectionTitle('CERTIFICATIONS');
          y += sectionContentGap;
          result.certifications.forEach((cert) => {
            drawEntry({
              title: cert.name,
              subtitle: cert.issuer,
              meta: [
                cert.issueDate,
                cert.expiryDate ? `Expires ${cert.expiryDate}` : '',
              ]
                .filter(Boolean)
                .join(' | '),
              details: [cert.credentialId ? `Credential ID: ${cert.credentialId}` : '', cert.details]
                .filter(Boolean)
                .join('\n'),
            });
          });
        }

        pdf.save(
          `${(profile.fullName || 'resume').replace(/\s+/g, '_').toLowerCase()}_resume.pdf`
        );

        return;
      }

      const html = buildResumeHtml();

      const { uri } = await Print.printToFileAsync({ html });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        showAlert('PDF created', `Saved PDF at: ${uri}`);
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share your tailored resume',
        UTI: 'com.adobe.pdf',
      });
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to export PDF.');
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
    const option = RESUME_STYLE_OPTIONS.find((item) => item.value === value);

    if (!option) {
      return null;
    }

    return (
      <TouchableOpacity
        style={[styles.styleCard, active && styles.styleCardActive]}
        onPress={() => setResumeStyle(value)}
      >
        <View
          style={[
            styles.stylePreview,
            { backgroundColor: option.previewBackground, borderColor: option.accent },
          ]}
        >
          <View style={[styles.stylePreviewBar, { backgroundColor: option.accent }]} />
          <View style={styles.stylePreviewLines}>
            <View style={[styles.stylePreviewLineShort, { backgroundColor: option.previewInk }]} />
            <View style={[styles.stylePreviewLineLong, { backgroundColor: option.previewInk }]} />
            <View style={[styles.stylePreviewLineMedium, { backgroundColor: option.accent }]} />
          </View>
        </View>
        <Text style={[styles.styleCardTitle, active && styles.styleCardTitleActive]}>
          {option.label}
        </Text>
        <Text style={[styles.styleCardDescription, active && styles.styleCardDescriptionActive]}>
          {option.description}
        </Text>
      </TouchableOpacity>
    );
  };

  const SectionShell = ({
    title,
    sectionKey,
    description,
    rightAction,
    children,
  }: {
    title: string;
    sectionKey: ResultSectionKey;
    description?: string;
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
            <View style={styles.resultHeaderText}>
              <Text style={styles.resultTitle}>{title}</Text>
              {description ? <Text style={styles.resultHeaderDescription}>{description}</Text> : null}
            </View>
            <Text style={styles.collapseText}>{expanded ? 'Hide' : 'Show'}</Text>
          </TouchableOpacity>
          {expanded && rightAction ? <View style={styles.resultHeaderActions}>{rightAction}</View> : null}
        </View>

        {expanded ? children : null}
      </View>
    );
  };

  const EntryEditorShell = ({
    panelKey,
    title,
    subtitle,
    children,
  }: {
    panelKey: string;
    title: string;
    subtitle?: string;
    children: React.ReactNode;
  }) => {
    const expanded = expandedEntryEditor === panelKey;

    return (
      <View style={styles.editorItemCard}>
        <TouchableOpacity
          style={styles.editorItemHeaderButton}
          onPress={() => toggleEntryEditor(panelKey)}
          activeOpacity={0.85}
        >
          <View style={styles.editorItemHeader}>
            <View style={styles.editorItemHeaderText}>
              <Text style={styles.editorItemTitle}>{title}</Text>
              {subtitle ? <Text style={styles.editorItemSubtitle}>{subtitle}</Text> : null}
            </View>
            <Text style={styles.copyText}>{expanded ? 'Hide' : 'Edit'}</Text>
          </View>
        </TouchableOpacity>

        {expanded ? <View style={styles.editorItemBody}>{children}</View> : null}
      </View>
    );
  };

  const renderSavedVersionsSection = () => (
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
  );

  const renderSaveVersionSection = () => {
    if (!result) return null;

    return (
      <View style={styles.resultCard}>
        <Text style={styles.resultTitle}>Save This Version</Text>
        <TextInput
          style={[styles.input, styles.saveTitleInput]}
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
        </View>
      </View>
    );
  };

  const renderAtsSection = () => {
    if (!atsInsights) return null;

    return (
      <SectionShell
        title="ATS Match"
        sectionKey="ats"
        description="Estimated alignment against the pasted job description"
      >
        <View style={styles.atsSummaryRow}>
          <View>
            <Text style={[styles.atsScoreValue, atsInsights.score < 50
              ? styles.atsScoreDanger
              : atsInsights.score < 70
                ? styles.atsScoreWarn
                : atsInsights.score < 90
                  ? styles.atsScoreGood
                  : styles.atsScoreExcellent]}
            >
              {atsInsights.score}%
            </Text>
            <Text style={styles.atsScoreLabel}>{atsInsights.toneLabel}</Text>
          </View>
          <View style={styles.atsMetaWrap}>
            <Text style={styles.atsMetaText}>
              {atsInsights.matchedCount} matching keyword
              {atsInsights.matchedCount === 1 ? '' : 's'} found
            </Text>
            <Text style={styles.atsMetaText}>
              {atsInsights.suggestedKeywords.length} suggested keyword
              {atsInsights.suggestedKeywords.length === 1 ? '' : 's'}
            </Text>
          </View>
        </View>

        <View style={styles.atsTrack}>
          <View
            style={[
              styles.atsTrackFill,
              atsInsights.score < 50
                ? styles.atsTrackFillDanger
                : atsInsights.score < 70
                  ? styles.atsTrackFillWarn
                  : atsInsights.score < 90
                    ? styles.atsTrackFillGood
                    : styles.atsTrackFillExcellent,
              { width: `${atsInsights.score}%` },
            ]}
          />
        </View>

        <Text style={styles.atsHintText}>
          Add more of the role-specific language below if it truthfully matches your experience.
        </Text>

        <View style={styles.keywordChipRow}>
          {atsInsights.suggestedKeywords.length > 0 ? (
            atsInsights.suggestedKeywords.map((keyword) => (
              <View key={keyword} style={styles.keywordChip}>
                <Text style={styles.keywordChipText}>{formatKeywordLabel(keyword)}</Text>
              </View>
            ))
          ) : (
            <Text style={styles.resultBody}>
              No obvious missing keywords right now. Your resume already covers the main language from the job post pretty well.
            </Text>
          )}
        </View>
      </SectionShell>
    );
  };

  const renderOutputOverview = () => {
    if (!result) return null;

    return (
      <>
        <View style={styles.resultCard}>
          <Text style={styles.resultTitle}>Export Style</Text>
          <Text style={styles.exportHelperText}>
            Switch styles any time. Your resume content stays the same, and you can export multiple versions without generating again.
          </Text>

          <View style={styles.styleGrid}>
            {RESUME_STYLE_OPTIONS.map((option) => (
              <ResumeStyleButton key={option.value} value={option.value} />
            ))}
          </View>

          <View style={styles.actionRow}>
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
      </>
    );
  };

  const renderEditorWorkspaceIntro = () => (
    <View style={styles.editorWorkspaceHeader}>
      <Text style={styles.sectionEyebrow}>Generated Resume</Text>
      <Text style={styles.editorWorkspaceTitle}>Edit Your Resume</Text>
      <Text style={styles.editorWorkspaceSubtitle}>
        Open any section below to refine the generated content, then export the version you want.
      </Text>
    </View>
  );

  const renderEditorSections = () => {
    if (!result) return null;

    return (
      <>
        <SectionShell
          title="Summary"
          sectionKey="summary"
          description="Your headline pitch for this role"
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

        <SectionShell
          title="Education"
          sectionKey="education"
          description={`${result.education.length} ${result.education.length === 1 ? 'entry' : 'entries'}`}
        >
          {result.education.map((edu, index) => (
            <EntryEditorShell
              key={`education-${index}`}
              panelKey={`education-${index}`}
              title={edu.school || `Education ${index + 1}`}
              subtitle={[edu.degree, edu.fieldOfStudy].filter(Boolean).join(', ') || 'Tap to edit this education entry'}
            >
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
            </EntryEditorShell>
          ))}
        </SectionShell>

        <SectionShell
          title="Skills"
          sectionKey="skills"
          description={`${result.skills.length} targeted skill${result.skills.length === 1 ? '' : 's'}`}
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

        <SectionShell
          title="Projects"
          sectionKey="projects"
          description={`${result.projects.length} ${result.projects.length === 1 ? 'entry' : 'entries'}`}
        >
          {result.projects.map((project, index) => (
            <EntryEditorShell
              key={`project-${index}`}
              panelKey={`project-${index}`}
              title={project.name || `Project ${index + 1}`}
              subtitle={project.role || 'Tap to edit this project entry'}
            >
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
            </EntryEditorShell>
          ))}
        </SectionShell>

        <SectionShell
          title="Experience"
          sectionKey="experience"
          description={`${result.experience.length} ${result.experience.length === 1 ? 'entry' : 'entries'}`}
        >
          {result.experience.map((exp, index) => (
            <EntryEditorShell
              key={`experience-${index}`}
              panelKey={`experience-${index}`}
              title={exp.company || `Experience ${index + 1}`}
              subtitle={exp.title || 'Tap to edit this experience entry'}
            >
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
            </EntryEditorShell>
          ))}
        </SectionShell>

        {result.certifications.length > 0 && (
          <SectionShell
            title="Certifications"
            sectionKey="certifications"
            description={`${result.certifications.length} ${result.certifications.length === 1 ? 'entry' : 'entries'}`}
          >
            {result.certifications.map((cert, index) => (
              <EntryEditorShell
                key={`certification-${index}`}
                panelKey={`certification-${index}`}
                title={cert.name || `Certification ${index + 1}`}
                subtitle={cert.issuer || 'Tap to edit this certification entry'}
              >
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
              </EntryEditorShell>
            ))}
          </SectionShell>
        )}
      </>
    );
  };

  const renderResultContent = (includeSavedVersions = true) => {
    const savedVersionsSection = includeSavedVersions ? renderSavedVersionsSection() : null;

    if (loading) {
      return (
        <>
          {savedVersionsSection}
          <View style={styles.loadingPanel}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Building your tailored resume...</Text>
          </View>
        </>
      );
    }

    if (!result) {
      return (
        <>
          {savedVersionsSection}
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>
              Your generated summary, skills, experience, projects, and keyword suggestions will appear here.
            </Text>
          </View>
        </>
      );
    }

      return (
        <>
          {savedVersionsSection}
          {renderOutputOverview()}
          {renderAtsSection()}
          {renderEditorSections()}
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

  const setupStats = [
    { label: 'Experience', value: profile?.experience?.length ?? 0 },
    { label: 'Projects', value: profile?.projects?.length ?? 0 },
    { label: 'Education', value: profile?.education?.length ?? 0 },
    { label: 'Saved', value: savedVersions.length },
  ];

  const contentContainerStyle = StyleSheet.flatten([
    styles.contentContainer,
    !isDesktop ? styles.contentContainerCompact : null,
  ]) as ViewStyle;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          style={styles.screen}
          contentContainerStyle={contentContainerStyle}
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
            <>
              <View style={styles.desktopGrid}>
                <View style={styles.desktopLeft}>
                  <View style={styles.sectionCard}>
                    <View style={styles.profileStatusHeader}>
                      <View>
                        <Text style={styles.sectionEyebrow}>Campaign Setup</Text>
                        <Text style={styles.sectionTitle}>Resume Campaign</Text>
                      </View>
                      <TouchableOpacity style={styles.smallButton} onPress={reloadProfile}>
                        <Text style={styles.smallButtonText}>Reload</Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={styles.statusText}>
                      {profileLooksEmpty
                        ? 'Your profile looks mostly empty. Fill out the Profile page first for better results.'
                        : `Using saved profile for ${profile?.fullName || 'this user'}.`}
                    </Text>

                    <View style={styles.setupStatsRow}>
                      {setupStats.map((item) => (
                        <View key={item.label} style={styles.setupStatChip}>
                          <Text style={styles.setupStatValue}>{item.value}</Text>
                          <Text style={styles.setupStatLabel}>{item.label}</Text>
                        </View>
                      ))}
                    </View>

                    <View style={styles.setupHintCard}>
                      <Text style={styles.setupHintTitle}>Workflow</Text>
                      <Text style={styles.setupHintText}>
                        Paste a role on the left, generate once, then explore ATS feedback, styles,
                        and exports on the right.
                      </Text>
                    </View>
                  </View>

                  <View style={styles.sectionCard}>
                    <Text style={styles.sectionEyebrow}>Role Input</Text>
                    <Text style={styles.sectionTitle}>Target Job Description</Text>
                    <Text style={styles.sectionSupportText}>
                      Add the job posting you want to target. ResumAI will tailor your resume around the most relevant language and requirements.
                    </Text>
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

                <View style={styles.desktopRight}>
                  {result ? (
                    <View style={styles.outputStudioHeader}>
                      <Text style={styles.sectionEyebrow}>Output Studio</Text>
                      <Text style={styles.outputStudioTitle}>Review, Export, and Fine-Tune</Text>
                      <Text style={styles.outputStudioSubtitle}>
                        Compare ATS fit, switch styles, and save polished versions before editing the details below.
                      </Text>
                    </View>
                  ) : null}

                  {loading ? (
                    <View style={styles.loadingPanel}>
                      <ActivityIndicator size="large" />
                      <Text style={styles.loadingText}>Building your tailored resume...</Text>
                    </View>
                  ) : result ? (
                    renderOutputOverview()
                  ) : (
                    <View style={styles.emptyState}>
                      <Text style={styles.emptyStateText}>
                        Your generated summary, skills, experience, projects, and keyword suggestions will appear here.
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {isDesktop && !loading ? (
                <View style={styles.desktopBottomStack}>
                  {renderAtsSection()}
                  {renderSaveVersionSection()}
                  {renderSavedVersionsSection()}
                  {result ? (
                    <>
                      {renderEditorWorkspaceIntro()}
                      {renderEditorSections()}
                    </>
                  ) : null}
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.mobileStack}>
              <View style={styles.mobileStackSection}>
                <View style={styles.sectionCard}>
                  <View style={styles.profileStatusHeader}>
                    <View>
                      <Text style={styles.sectionEyebrow}>Campaign Setup</Text>
                      <Text style={styles.sectionTitle}>Resume Campaign</Text>
                    </View>
                    <TouchableOpacity style={styles.smallButton} onPress={reloadProfile}>
                      <Text style={styles.smallButtonText}>Reload</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.statusText}>
                    {profileLooksEmpty
                      ? 'Your profile looks mostly empty. Fill out the Profile page first for better results.'
                      : `Using saved profile for ${profile?.fullName || 'this user'}.`}
                  </Text>

                  <View style={styles.setupStatsRow}>
                    {setupStats.map((item) => (
                      <View key={item.label} style={styles.setupStatChip}>
                        <Text style={styles.setupStatValue}>{item.value}</Text>
                        <Text style={styles.setupStatLabel}>{item.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>

                <View style={styles.sectionCard}>
                  <Text style={styles.sectionEyebrow}>Role Input</Text>
                  <Text style={styles.sectionTitle}>Target Job Description</Text>
                  <Text style={styles.sectionSupportText}>
                    Add the job posting you want to target. ResumAI will tailor your resume around the most relevant language and requirements.
                  </Text>
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

              <View style={styles.mobileStackSection}>
                {result && !loading ? renderEditorWorkspaceIntro() : null}
                {renderResultContent(true)}
              </View>
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
  },
  desktopLeft: {
    flex: 1,
    minWidth: 0,
    marginRight: 24,
  },
  desktopRight: {
    flex: 1.04,
    minWidth: 0,
  },
  desktopBottomStack: {
    width: '100%',
    marginTop: 8,
  },
  outputStudioHeader: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  outputStudioTitle: {
    color: '#1E293B',
    fontSize: 22,
    fontWeight: '800',
  },
  outputStudioSubtitle: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  mobileStack: {
    width: '100%',
    flexDirection: 'column',
  },
  mobileStackSection: {
    width: '100%',
    marginBottom: 20,
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
  sectionEyebrow: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sectionTitle: {
    color: '#1E293B',
    fontSize: 20,
    fontWeight: '800',
  },
  sectionSupportText: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  profileStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
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
  setupStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    marginHorizontal: -5,
  },
  setupStatChip: {
    minWidth: 92,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginHorizontal: 5,
    marginBottom: 10,
  },
  setupStatValue: {
    color: '#1E293B',
    fontSize: 22,
    fontWeight: '800',
  },
  setupStatLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  setupHintCard: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginTop: 6,
  },
  setupHintTitle: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '800',
  },
  setupHintText: {
    color: '#1E40AF',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
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
    marginTop: 2,
    marginBottom: 18,
  },
  styleGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginBottom: 18,
    marginHorizontal: -6,
  },
  pillButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    marginRight: 12,
    marginBottom: 10,
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
  styleCard: {
    width: 154,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 6,
    marginBottom: 12,
  },
  styleCardActive: {
    borderColor: '#2563EB',
    backgroundColor: '#EFF6FF',
  },
  stylePreview: {
    height: 76,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'row',
    marginBottom: 10,
  },
  stylePreviewBar: {
    width: 10,
    height: '100%',
  },
  stylePreviewLines: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'space-between',
  },
  stylePreviewLineShort: {
    height: 8,
    width: '42%',
    borderRadius: 999,
    opacity: 0.95,
  },
  stylePreviewLineMedium: {
    height: 6,
    width: '68%',
    borderRadius: 999,
    opacity: 0.85,
  },
  stylePreviewLineLong: {
    height: 6,
    width: '92%',
    borderRadius: 999,
    opacity: 0.25,
  },
  styleCardTitle: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },
  styleCardTitleActive: {
    color: '#1D4ED8',
  },
  styleCardDescription: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  styleCardDescriptionActive: {
    color: '#1E40AF',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    marginHorizontal: -5,
  },
  primaryButtonCompact: {
    backgroundColor: '#2563EB',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    marginHorizontal: 5,
    marginBottom: 10,
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
    marginHorizontal: 5,
    marginBottom: 10,
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
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  resultHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    flex: 1,
    paddingRight: 8,
  },
  resultHeaderActions: {
    marginLeft: 12,
    alignSelf: 'center',
  },
  resultHeaderText: {
    flex: 1,
  },
  resultTitle: {
    color: '#1E293B',
    fontWeight: '800',
    fontSize: 24,
  },
  resultHeaderDescription: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  collapseText: {
    color: '#64748B',
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 12,
    marginTop: 2,
  },
  copyText: {
    color: '#2563EB',
    fontWeight: '700',
    fontSize: 13,
  },
  saveTitleInput: {
    marginTop: 12,
    marginBottom: 12,
  },
  resultBody: {
    color: '#1E293B',
    fontSize: 15,
    lineHeight: 23,
  },
  exportHelperText: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 14,
  },
  editorWorkspaceHeader: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  editorWorkspaceTitle: {
    color: '#1E293B',
    fontSize: 24,
    fontWeight: '800',
  },
  editorWorkspaceSubtitle: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  editorItemCard: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    backgroundColor: '#F8FAFC',
    overflow: 'hidden',
  },
  editorItemHeaderButton: {
    width: '100%',
  },
  editorItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  editorItemHeaderText: {
    flex: 1,
    marginRight: 12,
  },
  editorItemTitle: {
    color: '#1E293B',
    fontSize: 15,
    fontWeight: '800',
  },
  editorItemSubtitle: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  editorItemBody: {
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 14,
    paddingBottom: 14,
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
  atsSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flexWrap: 'wrap',
  },
  atsScoreValue: {
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 38,
  },
  atsScoreDanger: {
    color: '#EF4444',
  },
  atsScoreWarn: {
    color: '#F59E0B',
  },
  atsScoreGood: {
    color: '#84CC16',
  },
  atsScoreExcellent: {
    color: '#15803D',
  },
  atsScoreLabel: {
    color: '#475569',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 6,
  },
  atsMetaWrap: {
    alignItems: 'flex-start',
    flexShrink: 1,
    marginTop: 4,
  },
  atsMetaText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'left',
    marginTop: 4,
  },
  atsTrack: {
    width: '100%',
    height: 12,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
    marginTop: 18,
  },
  atsTrackFill: {
    height: '100%',
    borderRadius: 999,
  },
  atsTrackFillDanger: {
    backgroundColor: '#EF4444',
  },
  atsTrackFillWarn: {
    backgroundColor: '#F59E0B',
  },
  atsTrackFillGood: {
    backgroundColor: '#84CC16',
  },
  atsTrackFillExcellent: {
    backgroundColor: '#15803D',
  },
  atsHintText: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 12,
  },
  keywordChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 14,
  },
  keywordChip: {
    backgroundColor: '#F8FAFC',
    borderColor: '#CBD5E1',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
    marginBottom: 10,
  },
  keywordChipText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
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
    marginTop: 10,
    marginHorizontal: -4,
  },
  savedVersionButton: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginHorizontal: 4,
    marginBottom: 8,
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
    marginHorizontal: 4,
    marginBottom: 8,
  },
  savedVersionDeleteButtonText: {
    color: '#DC2626',
    fontWeight: '700',
    fontSize: 13,
  },
});
