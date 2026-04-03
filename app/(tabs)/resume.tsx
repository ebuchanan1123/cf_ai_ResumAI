import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'expo-router';
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
  loadBulletDraft,
  loadCoverLetterDraft,
  saveCoverLetterDraft,
  type BulletDraft,
  type CoverLetterDraft,
} from '@/lib/generationDraftStorage';
import {
  createResumeVersion,
  loadCurrentResumeDraft,
  loadSavedResumeVersions,
  saveCurrentResumeDraft,
  saveResumeVersions,
  type ResumeOptimizationMode,
  type SavedResumeVersion,
} from '@/lib/resumeStorage';
import {
  consumeDailyUsage,
  getDailyUsage,
  getLimitReachedMessage,
  releaseDailyUsage,
} from '@/lib/rateLimits';
import { API_URL } from '@/config/api';
import { ASSISTANT_API_URL } from '@/config/assistant';
import { loadProfileFromStorage, type UserProfile } from '@/lib/profileStorage';

type Tone = 'Concise' | 'Technical' | 'Impact-focused';
const RESUME_MODE_OPTIONS: ResumeOptimizationMode[] = [
  'ATS-first',
  'Recruiter-friendly',
  'Technical-heavy',
  'Concise',
  'Leadership/impact',
  'Entry-level student',
  'Startup-focused',
];
type ResumeStyle =
  | 'Classic'
  | 'Modern'
  | 'Compact'
  | 'Executive'
  | 'Spotlight'
  | 'Nordic'
  | 'Mono'
  | 'Canvas'
  | 'Harbor'
  | 'Rosewood'
  | 'Regent'
  | 'Cobalt';

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

type ImportedJobPreview = {
  title: string;
  company: string;
  location: string;
  keywords: string[];
  sourceUrl: string;
  parseSucceeded: boolean;
};

type AssistantMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

type ResultSectionKey =
  | 'saved'
  | 'ats'
  | 'applicationKit'
  | 'summary'
  | 'education'
  | 'skills'
  | 'projects'
  | 'experience'
  | 'certifications';

const AGENT_WORKFLOW_STEPS = [
  {
    title: 'Parse job posting',
    activeStatus: 'Reading the target role and normalizing the posting.',
    completeStatus: 'Job posting parsed.',
  },
  {
    title: 'Extract requirements',
    activeStatus: 'Pulling out skills, tools, and role signals.',
    completeStatus: 'Requirements extracted.',
  },
  {
    title: 'Compare to profile',
    activeStatus: 'Matching the role against your saved background.',
    completeStatus: 'Profile overlap mapped.',
  },
  {
    title: 'Rewrite resume',
    activeStatus: 'Reweighting bullets, projects, and role language.',
    completeStatus: 'Resume content rewritten.',
  },
  {
    title: 'Score ATS fit',
    activeStatus: 'Estimating keyword coverage and section strength.',
    completeStatus: 'ATS fit scored.',
  },
  {
    title: 'Prepare export',
    activeStatus: 'Getting styles and export-ready output into place.',
    completeStatus: 'Export setup ready.',
  },
  {
    title: 'Generate cover letter',
    activeStatus: 'Lining up the next recommended application step.',
    completeStatus: 'Cover letter generation is ready as a next step.',
  },
] as const;

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
  {
    value: 'Harbor',
    label: 'Harbor Slate',
    description: 'Calm, structured, and professional',
    accent: '#0F766E',
    previewBackground: '#F8FAFC',
    previewInk: '#0F172A',
  },
  {
    value: 'Rosewood',
    label: 'Rosewood Editorial',
    description: 'Elegant serif with rich contrast',
    accent: '#9F1239',
    previewBackground: '#FFF8FA',
    previewInk: '#3F1D2E',
  },
  {
    value: 'Regent',
    label: 'Regent Navy',
    description: 'Deep navy with soft cream accents',
    accent: '#2F5DA8',
    previewBackground: '#FFF8E7',
    previewInk: '#1E3A8A',
  },
  {
    value: 'Cobalt',
    label: 'Cobalt Editorial',
    description: 'Bright cobalt with crisp ivory contrast',
    accent: '#1D4ED8',
    previewBackground: '#F8FAFF',
    previewInk: '#1E293B',
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

const toFilenamePart = (value: string) =>
  (value || '')
    .trim()
    .replace(/&/g, ' and ')
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const COMPANY_NAME_BLOCKLIST = new Set([
  'job description',
  'about the role',
  'about this role',
  'about the team',
  'about us',
  'about',
  'responsibilities',
  'requirements',
  'qualifications',
  'preferred qualifications',
  'what you will do',
  'what you ll do',
  'what we are looking for',
  'who you are',
  'overview',
  'summary',
  'position summary',
  'internship',
  'intern',
  'full time',
  'part time',
  'remote',
  'hybrid',
  'onsite',
]);

const cleanCompanyCandidate = (value: string) =>
  value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/^[^A-Za-z0-9]+/, '')
    .replace(/[\s,.:;|/-]+$/g, '');

const isLikelyCompanyName = (value: string) => {
  const candidate = cleanCompanyCandidate(value);
  if (!candidate) return false;
  if (candidate.length < 2 || candidate.length > 50) return false;

  const lower = candidate.toLowerCase();
  if (COMPANY_NAME_BLOCKLIST.has(lower)) return false;

  const words = candidate.split(' ').filter(Boolean);
  if (words.length > 5) return false;

  const hasCompanySuffix = /\b(inc|corp|llc|ltd|limited|technologies|technology|systems|software|solutions|labs|lab|group|company|co)\b/i.test(candidate);
  const hasCapitalizedWord = words.some((word) => /^[A-Z][A-Za-z0-9&'.-]*$/.test(word));
  const hasMixedCaseBrand = /[A-Z].*[a-z]|[a-z].*[A-Z]/.test(candidate);

  return hasCompanySuffix || hasCapitalizedWord || hasMixedCaseBrand;
};

const extractCompanyName = (jobDescription: string) => {
  const lines = jobDescription
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 18);

  const patterns = [
    /\bcompany\s*:\s*([A-Z][A-Za-z0-9&.,' -]{1,50})/i,
    /\b(?:about|join|at|with)\s+([A-Z][A-Za-z0-9&.,' -]{1,50})/i,
    /\b([A-Z][A-Za-z0-9&'.-]*(?:\s+[A-Z][A-Za-z0-9&'.-]*){0,3})\s+is\s+(?:a|an|the)\b/,
    /\b([A-Z][A-Za-z0-9&'.-]*(?:\s+[A-Z][A-Za-z0-9&'.-]*){0,3})\s+(?:is hiring|is looking|seeks|seeking)\b/i,
  ];

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = line.match(pattern);
      const candidate = cleanCompanyCandidate(match?.[1] || '');
      if (isLikelyCompanyName(candidate)) {
        return candidate;
      }
    }
  }

  return '';
};

const buildResumePdfFilename = (profile: UserProfile | null, jobDescription: string) => {
  const namePart = toFilenamePart(profile?.fullName || 'Resume') || 'Resume';
  const companyPart = toFilenamePart(extractCompanyName(jobDescription));

  return companyPart
    ? `${namePart} ${companyPart} resume.pdf`
    : `${namePart} resume.pdf`;
};

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

const canonicalizeKeyword = (value: string) => {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9+#./-\s]/g, '')
    .replace(/\s+/g, ' ');

  if (normalized.length > 4 && normalized.endsWith('ies')) {
    return `${normalized.slice(0, -3)}y`;
  }

  if (
    normalized.length > 4 &&
    normalized.endsWith('s') &&
    !normalized.endsWith('ss') &&
    !normalized.endsWith('us')
  ) {
    return normalized.slice(0, -1);
  }

  return normalized;
};

const keywordsOverlap = (left: string, right: string) => {
  const a = canonicalizeKeyword(left);
  const b = canonicalizeKeyword(right);

  if (!a || !b) return false;
  if (a === b) return true;
  if (a.length >= 5 && b.includes(a)) return true;
  if (b.length >= 5 && a.includes(b)) return true;
  return false;
};

const dedupeKeywords = (keywords: string[]) => {
  const unique: string[] = [];

  keywords.forEach((keyword) => {
    const trimmed = keyword.trim();
    if (!trimmed) return;
    if (unique.some((existing) => keywordsOverlap(existing, trimmed))) return;
    unique.push(trimmed);
  });

  return unique;
};

const dedupeCaseInsensitive = (items: string[]) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const SKILL_CATEGORY_RULES: {
  label: string;
  patterns: RegExp[];
}[] = [
  {
    label: 'Languages',
    patterns: [
      /\btypescript\b/i,
      /\bjavascript\b/i,
      /\bpython\b/i,
      /\bsql\b/i,
      /\bjava\b/i,
      /\bc\+\+\b/i,
      /\bc#\b/i,
      /\bgo\b/i,
      /\bruby\b/i,
      /\bphp\b/i,
    ],
  },
  {
    label: 'Frontend',
    patterns: [
      /\breact native\b/i,
      /\breact\b/i,
      /\bnext\.?js\b/i,
      /\bexpo\b/i,
      /\bhtml\b/i,
      /\bcss\b/i,
      /\btailwind\b/i,
      /\bfigma\b/i,
    ],
  },
  {
    label: 'Backend',
    patterns: [
      /\bnode\.?js\b/i,
      /\bnest\.?js\b/i,
      /\bexpress\b/i,
      /\brest\b/i,
      /\bgraphql\b/i,
      /\bapi\b/i,
      /\bauth\b/i,
      /\bauthentication\b/i,
      /\bwebsocket/i,
    ],
  },
  {
    label: 'Database',
    patterns: [
      /\bpostgres/i,
      /\bpostgresql\b/i,
      /\bmongodb\b/i,
      /\bfirebase\b/i,
      /\bmysql\b/i,
      /\bsupabase\b/i,
      /\bredis\b/i,
    ],
  },
  {
    label: 'Cloud & Tools',
    patterns: [
      /\bdocker\b/i,
      /\bazure\b/i,
      /\baws\b/i,
      /\bgit\b/i,
      /\bvercel\b/i,
      /\brender\b/i,
      /\bpostman\b/i,
      /\bci\/cd\b/i,
      /\bgithub actions\b/i,
    ],
  },
  {
    label: 'AI',
    patterns: [
      /\bopenai\b/i,
      /\bllm\b/i,
      /\bmachine learning\b/i,
      /\bartificial intelligence\b/i,
      /\bprompt engineering\b/i,
      /\bai\b/i,
    ],
  },
];

const categorizeSkills = (skills: string[]) => {
  const categorized = SKILL_CATEGORY_RULES.map((rule) => ({
    label: rule.label,
    values: [] as string[],
  }));
  const uncategorized: string[] = [];

  skills.forEach((skill) => {
    const trimmed = skill.trim();
    if (!trimmed) return;

    const matchIndex = SKILL_CATEGORY_RULES.findIndex((rule) =>
      rule.patterns.some((pattern) => pattern.test(trimmed))
    );

    if (matchIndex >= 0) {
      categorized[matchIndex].values.push(trimmed);
    } else {
      uncategorized.push(trimmed);
    }
  });

  if (uncategorized.length) {
    categorized.push({
      label: 'Additional',
      values: uncategorized,
    });
  }

  return categorized
    .map((group) => ({
      ...group,
      values: dedupeCaseInsensitive(group.values),
    }))
    .filter((group) => group.values.length > 0);
};

const PROJECT_TECH_CANDIDATES = [
  'TypeScript',
  'JavaScript',
  'Python',
  'SQL',
  'React',
  'React Native',
  'Next.js',
  'Expo',
  'Node.js',
  'NestJS',
  'Express',
  'REST APIs',
  'GraphQL',
  'PostgreSQL',
  'MongoDB',
  'Firebase',
  'Supabase',
  'Docker',
  'Azure',
  'AWS',
  'OpenAI API',
  'LLM pipelines',
  'Machine Learning',
];

const normalizeTechMatch = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const extractTechStack = (textParts: string[], fallbackSkills: string[]) => {
  const corpus = textParts.join(' ').toLowerCase();
  const candidates = dedupeCaseInsensitive([...PROJECT_TECH_CANDIDATES, ...fallbackSkills]);

  return candidates
    .filter((candidate) => {
      const normalized = normalizeTechMatch(candidate);
      return normalized && corpus.includes(normalized);
    })
    .slice(0, 4);
};

const buildResumeHeadline = (skills: string[]) => {
  const lowered = skills.map((skill) => skill.toLowerCase());

  let roleLabel = 'Software Developer';
  if (lowered.some((skill) => skill.includes('react')) && lowered.some((skill) => skill.includes('node'))) {
    roleLabel = 'Full-Stack Developer';
  } else if (lowered.some((skill) => skill.includes('react') || skill.includes('next') || skill.includes('expo'))) {
    roleLabel = 'Frontend Developer';
  } else if (lowered.some((skill) => skill.includes('node') || skill.includes('nest') || skill.includes('express'))) {
    roleLabel = 'Backend Developer';
  }

  const highlights = dedupeCaseInsensitive(
    skills.filter((skill) =>
      /(react|node|typescript|javascript|python|postgres|openai|ai|next|react native|nest)/i.test(skill)
    )
  ).slice(0, 3);

  if (!highlights.length) {
    return roleLabel;
  }

  return `${roleLabel} | ${highlights.join(', ')}`;
};

const normalizeForKeywordSearch = (value: string) =>
  ` ${value.toLowerCase().replace(/[^a-z0-9+#./-]+/g, ' ')} `;

const resumeContainsKeyword = (corpus: string, keyword: string) => {
  const canonical = canonicalizeKeyword(keyword);
  if (!canonical) return false;
  return corpus.includes(` ${canonical} `);
};

const countKeywordOccurrences = (corpus: string, keyword: string) => {
  const canonical = canonicalizeKeyword(keyword);
  if (!canonical) return 0;
  const escaped = canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const matches = corpus.match(new RegExp(`\\b${escaped}\\b`, 'g'));
  return matches ? matches.length : 0;
};

const formatKeywordLabel = (keyword: string) =>
  keyword
    .split(/[\s-]+/)
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : part))
    .join(' ');

const extractSentences = (value: string) =>
  value
    .split(/(?<=[.!?])\s+/)
    .map((sentence: string) => sentence.trim())
    .filter(Boolean);

const createEmptyBulletDraftState = (): BulletDraft => ({
  jobTitle: '',
  experience: '',
  jobDescription: '',
  tone: 'Technical',
  bullets: [],
});

const createEmptyCoverLetterDraftState = (): CoverLetterDraft => ({
  jobDescription: '',
  companyContext: '',
  hiringManager: '',
  tone: 'Technical',
  coverLetter: '',
});

const TECHNICAL_KEYWORD_PATTERN =
  /\b(api|apis|backend|frontend|full[\s-]?stack|react|react native|next\.?js|node|node\.?js|nest|nest\.?js|typescript|javascript|python|java|c\+\+|postgres|postgresql|mysql|sql|mongodb|docker|kubernetes|aws|azure|gcp|cloud|deployment|devops|ci\/cd|graphql|rest|microservices|redis|firebase|openai|llm|ai|machine learning)\b/i;

const TOOL_PLATFORM_PATTERN =
  /\b(docker|kubernetes|aws|azure|gcp|firebase|vercel|render|netlify|postgres|postgresql|mysql|mongodb|redis|github actions|ci\/cd|terraform|snowflake|databricks|airflow)\b/i;

const BUSINESS_LANGUAGE_PATTERN =
  /\b(stakeholder|customer|client|roadmap|cross[\s-]?functional|ownership|strategy|analytics|operations|workflow|reporting|business|product|communication|collaboration|agile|delivery|optimization)\b/i;

const METRICS_LANGUAGE_PATTERN =
  /\b(increase|improve|reduce|grew|growth|saved|faster|slower|efficiency|latency|performance|conversion|adoption|retention|accuracy|throughput|scale|scaled)\b/i;

const ASSISTANT_PROMPTS = [
  'Ask AI about this job',
  'Improve this bullet',
  'What keywords am I missing?',
  'Rewrite my summary for this role',
  'Why is my ATS score low?',
];

export default function ResumeScreen() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 1400;

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [jobDescription, setJobDescription] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [importedJobPreview, setImportedJobPreview] = useState<ImportedJobPreview | null>(null);
  const [tone, setTone] = useState<Tone>('Technical');
  const [optimizationMode, setOptimizationMode] =
    useState<ResumeOptimizationMode>('Recruiter-friendly');
  const [resumeStyle, setResumeStyle] = useState<ResumeStyle>('Classic');
  const [loading, setLoading] = useState(false);
  const [importingJob, setImportingJob] = useState(false);
  const [result, setResult] = useState<TailoredResumeResponse | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [savedVersions, setSavedVersions] = useState<SavedResumeVersion[]>([]);
  const [saveTitle, setSaveTitle] = useState('');
  const [savingVersion, setSavingVersion] = useState(false);
  const [expandedEntryEditor, setExpandedEntryEditor] = useState<string | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [activeWorkflowStep, setActiveWorkflowStep] = useState(0);
  const [bulletDraft, setBulletDraft] = useState<BulletDraft>(createEmptyBulletDraftState());
  const [coverLetterDraft, setCoverLetterDraft] =
    useState<CoverLetterDraft>(createEmptyCoverLetterDraftState());
  const [assistantSessionId, setAssistantSessionId] = useState<string | null>(null);
  const [assistantMessages, setAssistantMessages] = useState<AssistantMessage[]>([]);
  const [assistantInput, setAssistantInput] = useState('');
  const [assistantLoading, setAssistantLoading] = useState(false);
  const [assistantSuggestions, setAssistantSuggestions] = useState<string[]>([]);
  const [assistantError, setAssistantError] = useState('');
  const [assistantOpen, setAssistantOpen] = useState(false);

  const [expandedSections, setExpandedSections] = useState<Record<ResultSectionKey, boolean>>({
    saved: false,
    ats: true,
    applicationKit: false,
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
        const [storedProfile, storedVersions, storedDraft, storedBulletDraft, storedCoverLetterDraft] =
          await Promise.all([
          loadProfileFromStorage(),
          loadSavedResumeVersions(),
          loadCurrentResumeDraft(),
          loadBulletDraft(),
          loadCoverLetterDraft(),
        ]);

        setProfile(storedProfile);
        setJobUrl(storedDraft.jobUrl || '');
        setImportedJobPreview((storedDraft.importedJobPreview as ImportedJobPreview | null) || null);
        setSavedVersions(storedVersions);
        setBulletDraft(storedBulletDraft);
        setCoverLetterDraft(storedCoverLetterDraft);
        setJobDescription(storedDraft.jobDescription || '');
        setSaveTitle(storedDraft.saveTitle || '');
        if (storedDraft.tone === 'Concise' || storedDraft.tone === 'Technical' || storedDraft.tone === 'Impact-focused') {
          setTone(storedDraft.tone);
        }
        if (RESUME_MODE_OPTIONS.includes(storedDraft.optimizationMode as ResumeOptimizationMode)) {
          setOptimizationMode(storedDraft.optimizationMode as ResumeOptimizationMode);
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
        jobUrl,
        importedJobPreview,
        jobDescription,
        tone,
        optimizationMode,
        resumeStyle,
        saveTitle,
        result,
      });
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [
    draftHydrated,
    jobUrl,
    importedJobPreview,
    jobDescription,
    tone,
    optimizationMode,
    resumeStyle,
    saveTitle,
    result,
  ]);

  useEffect(() => {
    if (!loading) {
      setActiveWorkflowStep(0);
      return;
    }

    setActiveWorkflowStep(0);

    const intervalId = setInterval(() => {
      setActiveWorkflowStep((prev) => {
        if (prev >= AGENT_WORKFLOW_STEPS.length - 1) {
          return prev;
        }

        return prev + 1;
      });
    }, 700);

    return () => clearInterval(intervalId);
  }, [loading]);

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

  const importJobFromUrl = async () => {
    if (!jobUrl.trim()) {
      showAlert('Error', 'Paste a job posting URL first.');
      return;
    }

    try {
      setImportingJob(true);

      const res = await fetch(`${API_URL}/import-job`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          jobUrl: jobUrl.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to import job posting.');
      }

      const preview: ImportedJobPreview = {
        title: typeof data.title === 'string' ? data.title : '',
        company: typeof data.company === 'string' ? data.company : '',
        location: typeof data.location === 'string' ? data.location : '',
        keywords: Array.isArray(data.keywords) ? data.keywords.slice(0, 8) : [],
        sourceUrl: typeof data.sourceUrl === 'string' ? data.sourceUrl : jobUrl.trim(),
        parseSucceeded: Boolean(data.parseSucceeded),
      };

      setImportedJobPreview(preview);

      if (typeof data.jobDescriptionText === 'string' && data.jobDescriptionText.trim()) {
        setJobDescription(data.jobDescriptionText.trim());
      }

      if (!preview.parseSucceeded) {
        showAlert(
          'Imported with edits needed',
          'We pulled what we could from the job post. Review the description box and edit anything that looks off.'
        );
        return;
      }

      showAlert('Imported', 'Job posting details were imported into the description box.');
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to import job posting.');
    } finally {
      setImportingJob(false);
    }
  };

  const syncCoverLetterDraft = async (draft: CoverLetterDraft) => {
    setCoverLetterDraft(draft);
    await saveCoverLetterDraft(draft);
  };

  const buildCoverLetterContext = () => {
    if (!importedJobPreview) return '';

    return [importedJobPreview.company, importedJobPreview.title, importedJobPreview.location]
      .filter(Boolean)
      .join(' | ');
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
      resetAssistant();

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
          optimizationMode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to tailor resume.');
      }

      const nextResumeResult = {
        ...data,
        skills: Array.isArray(data.skills) ? data.skills : [],
      };

      setResult(nextResumeResult);
      setExpandedEntryEditor(null);
      setExpandedSections({
        saved: false,
        ats: true,
        applicationKit: false,
        summary: false,
        education: false,
        skills: false,
        projects: false,
        experience: false,
        certifications: false,
      });

      const baseCoverLetterDraft: CoverLetterDraft = {
        jobDescription,
        companyContext: buildCoverLetterContext(),
        hiringManager: '',
        tone,
        coverLetter: '',
      };

      try {
        const coverLetterUsage = await getDailyUsage('cover_letter_generation');
        if (coverLetterUsage.remaining > 0) {
          await consumeDailyUsage('cover_letter_generation');

          const coverLetterRes = await fetch(`${API_URL}/generate-cover-letter`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              profile,
              jobDescription,
              companyContext: baseCoverLetterDraft.companyContext,
              hiringManager: '',
              tone,
            }),
          });

          const coverLetterData = await coverLetterRes.json();

          if (!coverLetterRes.ok) {
            await releaseDailyUsage('cover_letter_generation');
            throw new Error(coverLetterData.error || 'Failed to generate cover letter.');
          }

          await syncCoverLetterDraft({
            ...baseCoverLetterDraft,
            coverLetter:
              typeof coverLetterData.coverLetter === 'string' ? coverLetterData.coverLetter : '',
          });
        } else {
          await syncCoverLetterDraft(baseCoverLetterDraft);
          showAlert(
            'Resume generated',
            `The resume was updated, but today's cover letter generation limit was reached. The cover letter export will stay disabled until a new draft is generated.`
          );
        }
      } catch (coverLetterError: any) {
        await syncCoverLetterDraft(baseCoverLetterDraft);
        showAlert(
          'Resume generated with cover letter issue',
          coverLetterError?.message ||
            'The resume was updated, but the cover letter could not be regenerated.'
        );
      }
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
        optimizationMode,
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
    resetAssistant();
    if (version.optimizationMode && RESUME_MODE_OPTIONS.includes(version.optimizationMode)) {
      setOptimizationMode(version.optimizationMode);
    }
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

  const resetAssistant = () => {
    setAssistantSessionId(null);
    setAssistantMessages([]);
    setAssistantInput('');
    setAssistantSuggestions([]);
    setAssistantError('');
    setAssistantOpen(false);
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

  const applyAtsAction = (action: {
    type: 'add_skill' | 'add_summary_keyword';
    keyword: string;
    label: string;
  }) => {
    if (!result) return;

    const keywordLabel = formatKeywordLabel(action.keyword);

    if (action.type === 'add_skill') {
      if (result.skills.some((skill) => keywordsOverlap(skill, action.keyword))) {
        showAlert('Already added', `${keywordLabel} is already represented in your Skills section.`);
        return;
      }

      const updatedSkills = dedupeCaseInsensitive([...result.skills, keywordLabel]);
      setResult({ ...result, skills: updatedSkills });
      setExpandedSections((prev) => ({ ...prev, skills: true }));
      showAlert('Applied', `${keywordLabel} was added to Skills.`);
      return;
    }

    if (action.type === 'add_summary_keyword') {
      if (keywordsOverlap(result.summary, action.keyword)) {
        showAlert('Already included', `${keywordLabel} is already reflected in your Summary.`);
        return;
      }

      const addition = ` Focused on ${keywordLabel.toLowerCase()} work where relevant.`;
      setResult({
        ...result,
        summary: `${result.summary.trim()}${addition}`.trim(),
      });
      setExpandedSections((prev) => ({ ...prev, summary: true }));
      showAlert('Applied', `${keywordLabel} was added to the Summary for emphasis.`);
    }
  };

  const fullResumeText = useMemo(() => {
    if (!result || !profile) return '';

    const headerLine = buildContactItems(profile)
      .map((item) => item.label)
      .join(' | ');
    const headline = buildResumeHeadline(result.skills);
    const skillGroups = categorizeSkills(result.skills);

    return `
${profile.fullName || 'Your Name'}
${headline}
${headerLine}

SKILLS
${skillGroups.map((group) => `${group.label}: ${group.values.join(', ')}`).join('\n')}

PROJECTS
${result.projects
  .map(
    (project) => {
      const projectTech = extractTechStack(
        [project.name, project.role, ...project.bullets],
        result.skills
      );

      return `
${project.name}${project.role ? ` - ${project.role}` : ''}
${projectTech.length ? `Tech: ${projectTech.join(', ')}` : ''}
${project.bullets.map((b) => `• ${b}`).join('\n')}`.trim();
    }
  )
  .join('\n\n')}

EXPERIENCE
${result.experience
  .map(
    (exp) =>
      `${exp.company}
${exp.title}
${exp.startDate} - ${exp.endDate}${exp.location ? ` | ${exp.location}` : ''}
${exp.bullets.slice(0, 2).map((b) => `• ${b}`).join('\n')}`.trim()
  )
  .join('\n\n')}

EDUCATION
${result.education
  .map(
    (edu) =>
      `${edu.school}
${edu.degree}${edu.fieldOfStudy ? `, ${edu.fieldOfStudy}` : ''}
${edu.endDate ? `Expected ${edu.endDate}` : [edu.startDate, edu.endDate].filter(Boolean).join(' - ')}
${edu.details || ''}`.trim()
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

    const summaryText = result.summary;
    const skillsText = result.skills.join(' ');
    const projectsText = result.projects
      .map((project) => [project.name, project.role, ...project.bullets].filter(Boolean).join(' '))
      .join(' ');
    const experienceText = result.experience
      .map((exp) => [exp.company, exp.title, exp.location, ...exp.bullets].filter(Boolean).join(' '))
      .join(' ');
    const educationText = result.education
      .map((edu) => [edu.school, edu.degree, edu.fieldOfStudy, edu.details].filter(Boolean).join(' '))
      .join(' ');
    const certificationsText = result.certifications
      .map((cert) => [cert.name, cert.issuer, cert.details, cert.credentialId].filter(Boolean).join(' '))
      .join(' ');

    const resumeCorpus = [
      summaryText,
      skillsText,
      projectsText,
      experienceText,
      educationText,
      certificationsText,
    ].join(' ');

    const normalizedResumeCorpus = normalizeForKeywordSearch(resumeCorpus);
    const extractedKeywords = dedupeKeywords(extractImportantKeywords(jobDescription)).slice(0, 16);
    const matchedKeywords = extractedKeywords.filter((keyword) => {
      return resumeContainsKeyword(normalizedResumeCorpus, keyword);
    });
    const suggestedKeywords = dedupeKeywords(
      result.missingKeywords
        .map((keyword) => keyword.trim())
        .filter(Boolean)
        .filter(
          (keyword) =>
            extractedKeywords.some((jobKeyword) => keywordsOverlap(jobKeyword, keyword)) &&
            !matchedKeywords.some((matchedKeyword) => keywordsOverlap(matchedKeyword, keyword))
        )
    ).slice(0, 8);

    const weakMatches = extractedKeywords.filter((keyword) => {
      if (matchedKeywords.some((matchedKeyword) => keywordsOverlap(matchedKeyword, keyword))) {
        return false;
      }

      const parts = canonicalizeKeyword(keyword)
        .split(' ')
        .filter((part) => part.length >= 5);

      return parts.some((part) => normalizedResumeCorpus.includes(` ${part} `));
    }).slice(0, 5);

    const overusedKeywords = dedupeKeywords(
      matchedKeywords.filter((keyword) => countKeywordOccurrences(normalizedResumeCorpus, keyword) >= 3)
    ).slice(0, 5);

    const coverageRatio =
      extractedKeywords.length === 0 ? 1 : matchedKeywords.length / extractedKeywords.length;
    let score = Math.round(
      Math.min(100, 22 + coverageRatio * 72 + Math.min(matchedKeywords.length, 6))
    );

    if (suggestedKeywords.length === 0) {
      score = Math.max(score, Math.min(92, 74 + matchedKeywords.length * 3));
    }

    let toneLabel = 'Strong alignment';
    let color = '#15803D';

    if (score < 45) {
      toneLabel = 'Needs stronger alignment';
      color = '#EF4444';
    } else if (score < 65) {
      toneLabel = 'Some important gaps remain';
      color = '#F59E0B';
    } else if (score < 85) {
      toneLabel = 'Looking competitive';
      color = '#84CC16';
    }

    const sectionCorpora = [
      { key: 'summary', label: 'Summary', corpus: normalizeForKeywordSearch(summaryText), weight: 0.18 },
      { key: 'skills', label: 'Skills', corpus: normalizeForKeywordSearch(skillsText), weight: 0.24 },
      { key: 'projects', label: 'Projects', corpus: normalizeForKeywordSearch(projectsText), weight: 0.34 },
      { key: 'experience', label: 'Experience', corpus: normalizeForKeywordSearch(experienceText), weight: 0.24 },
] as const;

    const sectionScores = sectionCorpora.map((section) => {
      const sectionMatches = extractedKeywords.filter((keyword) =>
        resumeContainsKeyword(section.corpus, keyword)
      );
      const sectionRatio =
        extractedKeywords.length === 0 ? 1 : sectionMatches.length / extractedKeywords.length;
      const sectionScore = Math.max(
        1,
        Math.min(10, Math.round(sectionRatio * 10 + Math.min(sectionMatches.length, 2)))
      );

      return {
        key: section.key,
        label: section.label,
        score: sectionScore,
        matchedKeywords: sectionMatches,
      };
    });

    const recruiterFeedback: string[] = [];

    const summaryScore = sectionScores.find((section) => section.key === 'summary')?.score ?? 0;
    const skillsScore = sectionScores.find((section) => section.key === 'skills')?.score ?? 0;
    const projectsScore = sectionScores.find((section) => section.key === 'projects')?.score ?? 0;
    const experienceScore = sectionScores.find((section) => section.key === 'experience')?.score ?? 0;

    if (skillsScore < 7 && suggestedKeywords.length > 0) {
      recruiterFeedback.push(
        `Your Skills section is missing some role language, especially ${formatKeywordLabel(
          suggestedKeywords[0]
        )}.`
      );
    }

    if (projectsScore < 7) {
      recruiterFeedback.push(
        'Projects should show more technical depth, product framing, or stack visibility to match this role more strongly.'
      );
    }

    if (experienceScore < 6) {
      recruiterFeedback.push(
        'Experience bullets read less targeted than the job post. Highlight backend/API work, ownership, or concrete impact more directly where accurate.'
      );
    }

    if (summaryScore < 6 && result.summary.trim()) {
      recruiterFeedback.push(
        'The Summary is not carrying much ATS value right now. Make it more role-specific or keep it tighter and more technical.'
      );
    }

    if (!/\d/.test(`${projectsText} ${experienceText}`)) {
      recruiterFeedback.push(
        'This role values concrete impact. Several bullets would feel stronger with quantified or more specific outcomes where truthful.'
      );
    }

    if (overusedKeywords.length > 0) {
      recruiterFeedback.push(
        `Some terms are doing a lot of repetition, especially ${formatKeywordLabel(
          overusedKeywords[0]
        )}. Vary the wording so the resume feels sharper.`
      );
    }

    if (recruiterFeedback.length === 0) {
      recruiterFeedback.push(
        'The resume already covers the core language from the job post well. Focus on tightening a few bullets rather than adding filler.'
      );
    }

    const actions: {
      id: string;
      label: string;
      description: string;
      type: 'add_skill' | 'add_summary_keyword';
      keyword: string;
    }[] = dedupeKeywords(suggestedKeywords)
      .slice(0, 3)
      .map((keyword, index) => ({
        id: `skill-${keyword}-${index}`,
        label: `Add ${formatKeywordLabel(keyword)} to Skills`,
        description: 'If accurate, add this role term to the Skills section for better coverage.',
        type: 'add_skill' as const,
        keyword,
      }));

    if (
      summaryScore < 7 &&
      extractedKeywords.some((keyword) => /(frontend|backend|api|react|node|ai|cloud)/i.test(keyword))
    ) {
      const summaryKeyword =
        extractedKeywords.find((keyword) => /(frontend|backend|api|react|node|ai|cloud)/i.test(keyword)) ||
        '';

      if (summaryKeyword) {
        actions.push({
          id: `summary-${summaryKeyword}`,
          label: `Emphasize ${formatKeywordLabel(summaryKeyword)} in Summary`,
          description: 'Adds a short role-focused signal to the summary if it matches your background.',
          type: 'add_summary_keyword' as const,
          keyword: summaryKeyword,
        });
      }
    }

    const roleValueSignals = dedupeKeywords(
      extractedKeywords.filter(
        (keyword) =>
          TECHNICAL_KEYWORD_PATTERN.test(keyword) ||
          TOOL_PLATFORM_PATTERN.test(keyword) ||
          BUSINESS_LANGUAGE_PATTERN.test(keyword)
      )
    ).slice(0, 4);

    const strongProfileSignals = dedupeKeywords([
      ...matchedKeywords.filter((keyword) => TECHNICAL_KEYWORD_PATTERN.test(keyword)),
      ...sectionScores
        .filter((section) => section.score >= 7)
        .map((section) => section.label.toLowerCase()),
    ]).slice(0, 4);

    const changeSignals = dedupeKeywords([
      projectsScore >= experienceScore ? 'projects' : 'experience',
      summaryScore >= 6 ? 'summary rewrite' : 'skills emphasis',
      ...matchedKeywords.filter((keyword) => /(api|backend|frontend|react|node|ai|cloud|deployment)/i.test(keyword)),
    ]).slice(0, 3);

    const reasoningCards = [
      {
        title: 'What the role values',
        body:
          roleValueSignals.length > 0
            ? `This job is leaning on ${roleValueSignals
                .map((keyword) => formatKeywordLabel(keyword))
                .join(', ')}, so the resume is trying to keep those signals visible early.`
            : 'The role is emphasizing a mix of technical execution and clear role-specific language, so the resume is tuned to surface the strongest matching signals quickly.',
      },
      {
        title: 'What your profile matched well',
        body:
          strongProfileSignals.length > 0
            ? `Your background already gave ResumAI good material around ${strongProfileSignals
                .map((keyword) => formatKeywordLabel(keyword))
                .join(', ')}, which is why those themes show up strongly in the tailored version.`
            : 'Your profile already had enough relevant overlap for ResumAI to build around your strongest technical and project signals without adding filler.',
      },
      {
        title: 'What ResumAI changed',
        body:
          changeSignals.length > 0
            ? `To align better, ResumAI pushed forward ${changeSignals
                .map((keyword) => formatKeywordLabel(keyword))
                .join(', ')}, and reweighted the resume toward the sections that looked most relevant for this role.`
            : 'ResumAI mainly tightened wording, surfaced stronger role language, and rebalanced the resume toward the sections most likely to matter for this posting.',
      },
    ];

    const technicalSkillGaps = dedupeKeywords(
      suggestedKeywords.filter((keyword) => TECHNICAL_KEYWORD_PATTERN.test(keyword))
    ).slice(0, 5);

    const businessLanguageGaps = dedupeKeywords(
      [...suggestedKeywords, ...weakMatches].filter((keyword) => BUSINESS_LANGUAGE_PATTERN.test(keyword))
    ).slice(0, 5);

    const toolsPlatformGaps = dedupeKeywords(
      suggestedKeywords.filter((keyword) => TOOL_PLATFORM_PATTERN.test(keyword))
    ).slice(0, 5);

    const niceToHaveSentences = extractSentences(jobDescription).filter((sentence) =>
      /\b(preferred|plus|nice to have|bonus|asset)\b/i.test(sentence)
    );

    const niceToHaveQualifications = dedupeKeywords(
      niceToHaveSentences.flatMap((sentence) => extractImportantKeywords(sentence))
    )
      .filter((keyword) => !resumeContainsKeyword(normalizedResumeCorpus, keyword))
      .slice(0, 4);

    const metricsMissing =
      !/\d/.test(`${projectsText} ${experienceText}`) ||
      (projectsScore < 7 && METRICS_LANGUAGE_PATTERN.test(jobDescription) && !/\d/.test(projectsText));

    const fitAssessment =
      score >= 82 && suggestedKeywords.length <= 2
        ? {
            label: 'Strong fit',
            description:
              'You already look competitive for this role. Focus on polishing bullets and keeping the strongest evidence near the top.',
          }
        : score >= 66
          ? {
              label: 'Partial fit',
              description:
                'You have solid overlap, but a few targeted wording or evidence changes would make the fit much clearer.',
            }
          : {
              label: 'Stretch role',
              description:
                'There is still useful overlap here, but you will need stronger evidence, sharper positioning, or more matching experience to look competitive.',
            };

    const gapAnalysis = {
      technicalSkills: technicalSkillGaps,
      businessLanguage: businessLanguageGaps,
      quantifiedOutcomes: metricsMissing
        ? [
            'Show outcomes with numbers, scope, speed improvements, usage, or other measurable evidence where truthful.',
          ]
        : [],
      toolsPlatforms: toolsPlatformGaps,
      niceToHaveQualifications,
      fitAssessment,
    };

    return {
      score,
      toneLabel,
      color,
      matchedCount: matchedKeywords.length,
      matchedKeywords,
      missingKeywords: suggestedKeywords,
      weakMatches,
      overusedKeywords,
      suggestedKeywords,
      sectionScores,
      recruiterFeedback,
      actions,
      reasoningCards,
      gapAnalysis,
    };
  }, [jobDescription, result]);

  const assistantContext = useMemo(
    () => ({
      profile,
      jobDescription,
      resumeResult: result,
      atsInsights,
    }),
    [atsInsights, jobDescription, profile, result]
  );

  const askAssistant = async (promptOverride?: string) => {
    const nextPrompt = (promptOverride || assistantInput).trim();

    if (!result) {
      showAlert('Error', 'Generate a resume first to use the assistant.');
      return;
    }

    if (!jobDescription.trim()) {
      showAlert('Error', 'Add a job description first.');
      return;
    }

    if (!ASSISTANT_API_URL) {
      showAlert(
        'Assistant not configured',
        'Set EXPO_PUBLIC_RESUMAI_ASSISTANT_URL in your app environment before using the Cloudflare assistant.'
      );
      return;
    }

    if (!nextPrompt) {
      showAlert('Error', 'Enter a question for the assistant.');
      return;
    }

    setAssistantOpen(true);

    const userMessage: AssistantMessage = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      role: 'user',
      content: nextPrompt,
      createdAt: new Date().toISOString(),
    };

    setAssistantLoading(true);
    setAssistantError('');
    setAssistantInput('');
    setAssistantMessages((prev) => [...prev, userMessage]);

    try {
      const res = await fetch(`${ASSISTANT_API_URL}/assistant/message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: assistantSessionId,
          message: nextPrompt,
          ...assistantContext,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reach the assistant.');
      }

      setAssistantSessionId(typeof data.sessionId === 'string' ? data.sessionId : assistantSessionId);

      const nextMessages = Array.isArray(data.messages)
        ? data.messages.filter(
            (message: AssistantMessage) =>
              message &&
              (message.role === 'user' || message.role === 'assistant') &&
              typeof message.content === 'string'
          )
        : [
            userMessage,
            {
              id: `${Date.now()}-assistant`,
              role: 'assistant' as const,
              content:
                typeof data.answer === 'string'
                  ? data.answer
                  : 'The assistant responded, but no message text was returned.',
              createdAt: new Date().toISOString(),
            },
          ];

      setAssistantMessages(nextMessages);
      setAssistantSuggestions(
        Array.isArray(data.suggestedActions)
          ? data.suggestedActions.map((item: string) => item.trim()).filter(Boolean).slice(0, 4)
          : []
      );
    } catch (err: any) {
      setAssistantError(err.message || 'Failed to reach the assistant.');
      setAssistantMessages((prev) => prev.filter((message) => message.id !== userMessage.id));
      showAlert('Error', err.message || 'Failed to reach the assistant.');
    } finally {
      setAssistantLoading(false);
    }
  };

  const applicationKit = useMemo(() => {
    if (!result || !profile) return null;

    const projectLead = result.projects[0];
    const experienceLead = result.experience[0];
    const topKeywords = atsInsights?.matchedKeywords.slice(0, 3).map(formatKeywordLabel) ?? [];
    const companyName = importedJobPreview?.company || extractCompanyName(jobDescription) || 'the team';
    const roleTitle =
      importedJobPreview?.title ||
      extractSentences(jobDescription).find((sentence) => /(engineer|developer|analyst|intern|specialist|associate|manager)/i.test(sentence)) ||
      'this role';

    const whyImFit = [
      `${profile.fullName || 'This candidate'} brings hands-on experience across ${
        topKeywords.length > 0 ? topKeywords.join(', ') : 'technical execution and product delivery'
      }.`,
      projectLead
        ? `Projects like ${projectLead.name} show real product-building experience rather than only coursework.`
        : null,
      experienceLead
        ? `Recent experience at ${experienceLead.company} adds practical evidence of execution in team settings.`
        : null,
    ]
      .filter(Boolean)
      .join(' ');

    const recruiterMessage = `Hi, I’m ${profile.fullName || 'a candidate'} and I recently applied for ${roleTitle} at ${companyName}. I built my materials around the role’s focus on ${
      topKeywords.length > 0 ? topKeywords.join(', ') : 'the core technical requirements'
    }, and I think my background in ${result.skills.slice(0, 4).join(', ')} could be a strong match. I’d love to stay on your radar if the team is still reviewing applicants.`;

    const checklist = [
      {
        label: 'Resume ready',
        complete: !!result,
        helper: result ? 'Tailored resume is generated and editable.' : 'Generate a tailored resume first.',
      },
      {
        label: 'Cover letter ready',
        complete: coverLetterDraft.coverLetter.trim().length > 0,
        helper:
          coverLetterDraft.coverLetter.trim().length > 0
            ? 'A saved cover letter draft is available.'
            : 'Generate a cover letter to complete the kit.',
      },
      {
        label: 'Keywords aligned',
        complete: (atsInsights?.score ?? 0) >= 70,
        helper:
          atsInsights && atsInsights.score >= 70
            ? `ATS score is ${atsInsights.score}%, which is in a competitive range.`
            : 'Use the ATS panel to tighten missing keywords and weak sections.',
      },
      {
        label: 'Interview prep ready',
        complete: !!result,
        helper:
          result
            ? 'Open the Interview Prep page for talking points and likely questions.'
            : 'Generate a tailored resume first to unlock interview prep.',
      },
    ];

    return {
      checklist,
      bullets: bulletDraft.bullets,
      coverLetter: coverLetterDraft.coverLetter.trim(),
      recruiterMessage,
      whyImFit,
    };
  }, [atsInsights, bulletDraft.bullets, coverLetterDraft.coverLetter, importedJobPreview, jobDescription, profile, result]);

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
      Harbor: {
        font: 'helvetica',
        headingColor: [15, 23, 42],
        textColor: [30, 41, 59],
        accentColor: [15, 118, 110],
        sectionFill: [240, 253, 250],
      },
      Rosewood: {
        font: 'times',
        headingColor: [63, 29, 46],
        textColor: [68, 39, 55],
        accentColor: [159, 18, 57],
        sectionFill: [255, 228, 230],
      },
      Regent: {
        font: 'times',
        headingColor: [30, 58, 138],
        textColor: [30, 41, 59],
        accentColor: [47, 93, 168],
        sectionFill: [255, 248, 231],
      },
      Cobalt: {
        font: 'helvetica',
        headingColor: [15, 23, 42],
        textColor: [30, 41, 59],
        accentColor: [29, 78, 216],
        sectionFill: [239, 246, 255],
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
      Harbor: {
        fontFamily: '"Segoe UI", "Avenir Next", sans-serif',
        bodyFontSize: '10.9pt',
        bodyLineHeight: '1.48',
        textColor: '#1E293B',
        headingSize: '24pt',
        headingWeight: '800',
        headingColor: '#0F172A',
        sectionSpacing: '18px',
        sectionBorder: 'none',
        itemSpacing: '12px',
        subtitleStyle: 'normal',
        metaFontSize: '9.5pt',
        pageBackground: '#F8FAFC',
        accentColor: '#0F766E',
        contactColor: '#0F766E',
        sectionTitleBackground: '#ECFDF5',
        sectionTitlePadding: '6px 10px',
        itemTitleColor: '#0F172A',
        bulletMarkerColor: '#0F766E',
        headingBorder: '6px solid #0F766E',
        sectionTitleBorder: '4px solid #0F766E',
      },
      Rosewood: {
        fontFamily: 'Georgia, "Times New Roman", serif',
        bodyFontSize: '11pt',
        bodyLineHeight: '1.48',
        textColor: '#442737',
        headingSize: '24pt',
        headingWeight: '700',
        headingColor: '#3F1D2E',
        sectionSpacing: '18px',
        sectionBorder: 'none',
        itemSpacing: '12px',
        subtitleStyle: 'normal',
        metaFontSize: '9.5pt',
        pageBackground: '#FFF8FA',
        accentColor: '#9F1239',
        contactColor: '#9F1239',
        sectionTitleBackground: '#FFE4E6',
        sectionTitlePadding: '6px 10px',
        itemTitleColor: '#3F1D2E',
        bulletMarkerColor: '#9F1239',
        headingBorder: '6px solid #9F1239',
        sectionTitleBorder: '4px solid #9F1239',
      },
      Regent: {
        fontFamily: 'Georgia, "Times New Roman", serif',
        bodyFontSize: '10.9pt',
        bodyLineHeight: '1.48',
        textColor: '#1E293B',
        headingSize: '24pt',
        headingWeight: '700',
        headingColor: '#1E3A8A',
        sectionSpacing: '18px',
        sectionBorder: 'none',
        itemSpacing: '12px',
        subtitleStyle: 'normal',
        metaFontSize: '9.5pt',
        pageBackground: '#FFFBF2',
        accentColor: '#2F5DA8',
        contactColor: '#7C5A3A',
        sectionTitleBackground: '#FFF3D6',
        sectionTitlePadding: '6px 10px',
        itemTitleColor: '#1E3A8A',
        bulletMarkerColor: '#2F5DA8',
        headingBorder: '6px solid #2F5DA8',
        sectionTitleBorder: '4px solid #C9A66B',
      },
      Cobalt: {
        fontFamily: '"Segoe UI", Helvetica, Arial, sans-serif',
        bodyFontSize: '10.9pt',
        bodyLineHeight: '1.48',
        textColor: '#1E293B',
        headingSize: '24pt',
        headingWeight: '800',
        headingColor: '#0F172A',
        sectionSpacing: '18px',
        sectionBorder: 'none',
        itemSpacing: '12px',
        subtitleStyle: 'normal',
        metaFontSize: '9.5pt',
        pageBackground: '#F8FAFF',
        accentColor: '#1D4ED8',
        contactColor: '#1D4ED8',
        sectionTitleBackground: '#DBEAFE',
        sectionTitlePadding: '6px 10px',
        itemTitleColor: '#0F172A',
        bulletMarkerColor: '#1D4ED8',
        headingBorder: '6px solid #1D4ED8',
        sectionTitleBorder: '4px solid #1D4ED8',
      },
    };

    const currentStyle = styleMap[resumeStyle];

    const contactLine = buildContactItems(profile)
      .map((item) =>
        item.href ? `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>` : escapeHtml(item.label)
      )
      .join('<span class="contact-separator"> | </span>');
    const headline = buildResumeHeadline(result.skills);
    const skillGroups = categorizeSkills(result.skills);

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
        margin-bottom: 14px;
        padding-left: 18px;
      }

      .headline {
        margin: 2px 0 8px 18px;
        color: ${currentStyle.headingColor};
        font-size: 11.5pt;
        font-weight: 700;
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

      .tech-line {
        color: ${currentStyle.accentColor};
        font-size: ${currentStyle.metaFontSize};
        font-weight: 700;
        margin: 3px 0 5px 0;
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

      .skill-group {
        margin: 0 0 4px 0;
      }

      .skill-label {
        font-weight: 700;
        color: ${currentStyle.headingColor};
      }
    </style>
  </head>
  <body>
    <div class="resume-shell">
    <h1>${escapeHtml(profile.fullName || 'Your Name')}</h1>
    <div class="headline">${escapeHtml(headline)}</div>
    <div class="contact">${contactLine}</div>

    <div class="section-title">SKILLS</div>
    ${skillGroups
      .map(
        (group) =>
          `<div class="skill-group"><span class="skill-label">${escapeHtml(group.label)}:</span> ${escapeHtml(group.values.join(', '))}</div>`
      )
      .join('')}

    <div class="resume-section">
      ${
        result.projects.length > 0
          ? `
      <div class="section-heading-block">
        <div class="section-title">PROJECTS</div>
        <div class="item">
          <div class="item-title">${escapeHtml(result.projects[0].name)}</div>
          <div class="item-subtitle">${escapeHtml(result.projects[0].role)}</div>
          ${
            extractTechStack(
              [result.projects[0].name, result.projects[0].role, ...result.projects[0].bullets],
              result.skills
            ).length
              ? `<div class="tech-line">${escapeHtml(
                  `Tech: ${extractTechStack(
                    [result.projects[0].name, result.projects[0].role, ...result.projects[0].bullets],
                    result.skills
                  ).join(', ')}`
                )}</div>`
              : ''
          }
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
          ${
            extractTechStack([project.name, project.role, ...project.bullets], result.skills).length
              ? `<div class="tech-line">${escapeHtml(
                  `Tech: ${extractTechStack(
                    [project.name, project.role, ...project.bullets],
                    result.skills
                  ).join(', ')}`
                )}</div>`
              : ''
          }
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
            ${result.experience[0].bullets.slice(0, 2).map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
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
            ${exp.bullets.slice(0, 2).map((b) => `<li>${escapeHtml(b)}</li>`).join('')}
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
            result.education[0].endDate
              ? `Expected ${result.education[0].endDate}`
              : [result.education[0].startDate, result.education[0].endDate].filter(Boolean).join(' - ')
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
          <div class="meta">${escapeHtml(
            edu.endDate ? `Expected ${edu.endDate}` : [edu.startDate, edu.endDate].filter(Boolean).join(' - ')
          )}</div>
          ${edu.details ? `<div>${escapeHtml(edu.details)}</div>` : ''}
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
        const headline = buildResumeHeadline(result.skills);
        const skillGroups = categorizeSkills(result.skills);

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

        const drawTechLine = (techStack: string[]) => {
          if (!techStack.length) return;
          drawWrappedText(`Tech: ${techStack.join(', ')}`, bodyX, bodyContentWidth, {
            fontSize: 9.5,
            lineGap: 12,
            color: theme.accentColor,
            fontStyle: 'bold',
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
          techStack,
        }: {
          title?: string;
          subtitle?: string;
          meta?: string;
          details?: string;
          bullets?: string[];
          techStack?: string[];
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
          if (techStack?.length) {
            drawTechLine(techStack);
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
        y += 18;

        drawWrappedText(headline, marginX, contentWidth, {
          fontSize: 11,
          lineGap: 13,
          color: theme.headingColor,
          fontStyle: 'bold',
        });
        y += 2;

        const contactItems = buildContactItems(profile);

        if (contactItems.length) {
          drawContactLine(contactItems);
          y += 8;
        }

        if (skillGroups.length) {
          drawSectionTitle('SKILLS');
          y += sectionContentGap;
          skillGroups.forEach((group) => {
            drawWrappedText(`${group.label}: ${group.values.join(', ')}`, bodyX, bodyContentWidth, {
              fontSize: 10.3,
              lineGap: 13,
              color: theme.textColor,
              fontStyle: 'normal',
            });
            y += 2;
          });
        }

        if (result.projects.length) {
          drawSectionTitle('PROJECTS');
          y += sectionContentGap;
          result.projects.forEach((project) => {
            drawEntry({
              title: project.name,
              subtitle: project.role,
              techStack: extractTechStack([project.name, project.role, ...project.bullets], result.skills),
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
              bullets: exp.bullets.slice(0, 2),
            });
          });
        }

        if (result.education.length) {
          drawSectionTitle('EDUCATION');
          y += sectionContentGap;
          result.education.forEach((edu) => {
            drawEntry({
              title: edu.school,
              subtitle: [edu.degree, edu.fieldOfStudy].filter(Boolean).join(', '),
              meta: edu.endDate
                ? `Expected ${edu.endDate}`
                : [edu.startDate, edu.endDate].filter(Boolean).join(' - '),
              details: edu.details,
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

        pdf.save(buildResumePdfFilename(profile, jobDescription));

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

  const exportCoverLetterPdf = async () => {
    if (!profile || !coverLetterDraft.coverLetter.trim()) return;

    try {
      setExportingPdf(true);

      const companyName = extractCompanyName(jobDescription);
      const fileName = `${profile.fullName || 'User'}${
        companyName ? ` ${companyName}` : ''
      } cover letter.pdf`;

      if (Platform.OS === 'web') {
        const jspdfModule = await import('jspdf/dist/jspdf.es.min.js');
        const { jsPDF } = jspdfModule as any;

        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'pt',
          format: 'letter',
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();
        const marginX = 48;
        const marginTop = 52;
        const marginBottom = 52;
        const contentWidth = pageWidth - marginX * 2;
        const paragraphGap = 8;
        let y = marginTop;

        const ensureSpace = (needed: number) => {
          if (y + needed > pageHeight - marginBottom) {
            pdf.addPage();
            y = marginTop;
          }
        };

        const drawLines = (
          text: string,
          options?: {
            fontSize?: number;
            fontStyle?: 'normal' | 'bold';
            color?: [number, number, number];
            extraGap?: number;
          }
        ) => {
          const safeText = normalizePdfText(text).trim();
          if (!safeText) return;
          const fontSize = options?.fontSize ?? 11;
          const appliedLineHeight = fontSize + 4;
          pdf.setFont('helvetica', options?.fontStyle ?? 'normal');
          pdf.setFontSize(fontSize);
          if (options?.color) {
            pdf.setTextColor(options.color[0], options.color[1], options.color[2]);
          } else {
            pdf.setTextColor(24, 39, 75);
          }
          const lines = pdf.splitTextToSize(safeText, contentWidth);
          ensureSpace(lines.length * appliedLineHeight + (options?.extraGap ?? 0));
          pdf.text(lines, marginX, y);
          y += lines.length * appliedLineHeight + (options?.extraGap ?? 0);
        };

        drawLines(profile.fullName || 'Your Name', {
          fontSize: 18,
          fontStyle: 'bold',
          color: [17, 24, 39],
          extraGap: 6,
        });

        const contactLine = buildContactItems(profile)
          .map((item) => item.label)
          .join(' | ');
        if (contactLine) {
          drawLines(contactLine, {
            fontSize: 10.5,
            color: [71, 85, 105],
            extraGap: 16,
          });
        }

        coverLetterDraft.coverLetter
          .split(/\n\s*\n/)
          .map((paragraph) => paragraph.trim())
          .filter(Boolean)
          .forEach((paragraph) => {
            drawLines(paragraph, { fontSize: 11, extraGap: paragraphGap });
          });

        pdf.save(fileName);
        return;
      }

      const html = `
        <html>
          <body style="font-family: Georgia, serif; padding: 48px; color: #18274B; line-height: 1.55;">
            <h1 style="margin: 0 0 8px; font-size: 28px;">${escapeHtml(profile.fullName || 'Your Name')}</h1>
            <div style="margin-bottom: 24px; font-size: 14px; color: #475569;">
              ${escapeHtml(
                buildContactItems(profile)
                  .map((item) => item.label)
                  .join(' | ')
              )}
            </div>
            ${coverLetterDraft.coverLetter
              .split(/\n\s*\n/)
              .map((paragraph) => `<p style="margin: 0 0 14px;">${escapeHtml(paragraph.trim())}</p>`)
              .join('')}
          </body>
        </html>
      `.trim();

      const { uri } = await Print.printToFileAsync({ html });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        showAlert('PDF created', `Saved PDF at: ${uri}`);
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Share your tailored cover letter',
        UTI: 'com.adobe.pdf',
      });
    } catch (err: any) {
      showAlert('Error', err.message || 'Failed to export cover letter PDF.');
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

  const ResumeModeButton = ({ value }: { value: ResumeOptimizationMode }) => {
    const active = optimizationMode === value;

    return (
      <TouchableOpacity
        style={[styles.pillButton, active && styles.pillButtonActive]}
        onPress={() => setOptimizationMode(value)}
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

  const renderApplicationKitSection = () => {
    if (!applicationKit) return null;

    return (
      <SectionShell
        title="Application Kit"
        sectionKey="applicationKit"
        description="Everything you need to apply, organized in one place"
      >
        <Text style={styles.exportHelperText}>
          Use this package view to check that your resume, supporting materials, and talking points are all ready before you apply.
        </Text>

        <View style={styles.applicationChecklist}>
          {applicationKit.checklist.map((item) => (
            <View key={item.label} style={styles.applicationChecklistItem}>
              <View
                style={[
                  styles.applicationChecklistBadge,
                  item.complete
                    ? styles.applicationChecklistBadgeComplete
                    : styles.applicationChecklistBadgePending,
                ]}
              >
                <Text
                  style={[
                    styles.applicationChecklistBadgeText,
                    item.complete
                      ? styles.applicationChecklistBadgeTextComplete
                      : styles.applicationChecklistBadgeTextPending,
                  ]}
                >
                  {item.complete ? 'Ready' : 'Needs work'}
                </Text>
              </View>
              <View style={styles.applicationChecklistTextWrap}>
                <Text style={styles.applicationChecklistTitle}>{item.label}</Text>
                <Text style={styles.applicationChecklistHelper}>{item.helper}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.applicationKitGrid}>
          <View style={styles.applicationKitCard}>
            <Text style={styles.applicationKitTitle}>Why I’m a Fit</Text>
            <Text style={styles.applicationKitBody}>{applicationKit.whyImFit}</Text>
            <TouchableOpacity
              style={styles.smallOutlineButton}
              onPress={() => copySection(applicationKit.whyImFit)}
            >
              <Text style={styles.smallOutlineButtonText}>Copy</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.applicationKitCard}>
            <Text style={styles.applicationKitTitle}>Recruiter Message Draft</Text>
            <Text style={styles.applicationKitBody}>{applicationKit.recruiterMessage}</Text>
            <TouchableOpacity
              style={styles.smallOutlineButton}
              onPress={() => copySection(applicationKit.recruiterMessage)}
            >
              <Text style={styles.smallOutlineButtonText}>Copy</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.applicationKitCard}>
            <Text style={styles.applicationKitTitle}>Cover Letter</Text>
            <Text style={styles.applicationKitBody} numberOfLines={4}>
              {applicationKit.coverLetter || 'No saved cover letter draft yet. Generate one in the Cover Letter tab to complete the kit.'}
            </Text>
            {applicationKit.coverLetter ? (
              <TouchableOpacity
                style={styles.smallOutlineButton}
                onPress={() => copySection(applicationKit.coverLetter)}
              >
                <Text style={styles.smallOutlineButtonText}>Copy</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.applicationKitCard}>
            <Text style={styles.applicationKitTitle}>Optimized Bullets</Text>
            {applicationKit.bullets.length > 0 ? (
              <>
                {applicationKit.bullets.slice(0, 3).map((bullet, index) => (
                  <Text key={`kit-bullet-${index}`} style={styles.atsFeedbackItem}>
                    {`\u2022 ${bullet}`}
                  </Text>
                ))}
                <TouchableOpacity
                  style={styles.smallOutlineButton}
                  onPress={() => copySection(applicationKit.bullets.map((bullet) => `• ${bullet}`).join('\n'))}
                >
                  <Text style={styles.smallOutlineButtonText}>Copy</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.applicationKitBody}>
                No saved Bullet AI draft yet. Generate role-specific bullets in the Bullet AI tab to complete the kit.
              </Text>
            )}
          </View>
        </View>
      </SectionShell>
    );
  };

  const renderWorkflowTimeline = () => (
    <View style={styles.loadingPanel}>
      <View style={styles.workflowHeader}>
        <Text style={styles.sectionEyebrow}>Agent Workflow</Text>
        <Text style={styles.workflowTitle}>ResumAI is building your application materials</Text>
        <Text style={styles.workflowSubtitle}>
          Follow the step-by-step workflow while the system analyzes the role and prepares your tailored output.
        </Text>
      </View>

      <View style={styles.workflowTimeline}>
        {AGENT_WORKFLOW_STEPS.map((step, index) => {
          const isComplete = index < activeWorkflowStep;
          const isActive = index === activeWorkflowStep;

          return (
            <View key={step.title} style={styles.workflowStepRow}>
              <View style={styles.workflowStepIndicatorWrap}>
                <View
                  style={[
                    styles.workflowStepIndicator,
                    isComplete
                      ? styles.workflowStepIndicatorComplete
                      : isActive
                        ? styles.workflowStepIndicatorActive
                        : styles.workflowStepIndicatorPending,
                  ]}
                >
                  {isComplete ? (
                    <Text style={styles.workflowStepIndicatorCheck}>✓</Text>
                  ) : isActive ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : null}
                </View>
                {index < AGENT_WORKFLOW_STEPS.length - 1 ? (
                  <View
                    style={[
                      styles.workflowStepConnector,
                      index < activeWorkflowStep
                        ? styles.workflowStepConnectorComplete
                        : styles.workflowStepConnectorPending,
                    ]}
                  />
                ) : null}
              </View>

              <View style={styles.workflowStepTextWrap}>
                <Text
                  style={[
                    styles.workflowStepTitle,
                    isActive && styles.workflowStepTitleActive,
                    isComplete && styles.workflowStepTitleComplete,
                  ]}
                >
                  {step.title}
                </Text>
                <Text style={styles.workflowStepStatus}>
                  {isComplete
                    ? step.completeStatus
                    : isActive
                      ? step.activeStatus
                      : 'Waiting in queue.'}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );

  const renderInterviewPrepCta = () => {
    if (!result) return null;

    return (
      <View style={styles.resultCard}>
        <Text style={styles.sectionEyebrow}>Interview Prep</Text>
        <Text style={styles.resultTitle}>Get tailored interview preparation for this job application</Text>
        <Text style={styles.exportHelperText}>
          Turn this tailored resume into likely interview questions, strongest talking points, gap explanations, and a sharper fit story for this exact role.
        </Text>
        <Link href="../interview-prep" asChild>
          <TouchableOpacity style={styles.primaryButtonCompact}>
            <Text style={styles.primaryButtonCompactText}>Ace the Interview →</Text>
          </TouchableOpacity>
        </Link>
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

  const renderJobImporter = () => (
    <View style={styles.jobImportWrap}>
      <Text style={styles.label}>Paste Job Link</Text>
      <TextInput
        style={styles.input}
        value={jobUrl}
        onChangeText={setJobUrl}
        placeholder="https://boards.greenhouse.io/... or LinkedIn / Indeed / Lever / Ashby / Workday"
        placeholderTextColor="#8C8C8C"
        autoCapitalize="none"
        autoCorrect={false}
      />

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.secondaryButtonCompact, importingJob && styles.disabledButton]}
          onPress={importJobFromUrl}
          disabled={importingJob}
        >
          <Text style={styles.secondaryButtonCompactText}>
            {importingJob ? 'Importing...' : 'Import Job'}
          </Text>
        </TouchableOpacity>
      </View>

      {importedJobPreview ? (
        <View style={styles.jobPreviewCard}>
          <Text style={styles.jobPreviewTitle}>
            {importedJobPreview.title || 'Imported job posting'}
          </Text>
          <Text style={styles.jobPreviewMeta}>
            {[importedJobPreview.company, importedJobPreview.location].filter(Boolean).join(' • ') ||
              'Company and location could not be fully confirmed'}
          </Text>
          <Text style={styles.jobPreviewStatus}>
            {importedJobPreview.parseSucceeded
              ? 'Imported successfully. You can still edit the description manually below.'
              : 'Best-effort parse only. Review and edit the description manually below.'}
          </Text>
          <View style={styles.keywordChipRow}>
            {importedJobPreview.keywords.length > 0 ? (
              importedJobPreview.keywords.map((keyword) => (
                <View key={`job-preview-${keyword}`} style={styles.keywordChipMuted}>
                  <Text style={styles.keywordChipMutedText}>{formatKeywordLabel(keyword)}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.resultBody}>No parsed keywords available yet.</Text>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );

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

        <View style={styles.atsBreakdownGrid}>
          <View style={styles.atsBreakdownCard}>
            <Text style={styles.atsBreakdownTitle}>Keyword Coverage</Text>
            <Text style={styles.atsBreakdownLabel}>Matched keywords</Text>
            <View style={styles.keywordChipRow}>
              {atsInsights.matchedKeywords.length > 0 ? (
                atsInsights.matchedKeywords.map((keyword: string) => (
                  <View key={`matched-${keyword}`} style={styles.keywordChip}>
                    <Text style={styles.keywordChipText}>{formatKeywordLabel(keyword)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.resultBody}>No strong role keywords detected yet.</Text>
              )}
            </View>

            <Text style={styles.atsBreakdownLabel}>Missing keywords</Text>
            <View style={styles.keywordChipRow}>
              {atsInsights.missingKeywords.length > 0 ? (
                atsInsights.missingKeywords.map((keyword: string) => (
                  <View key={`missing-${keyword}`} style={styles.keywordChip}>
                    <Text style={styles.keywordChipText}>{formatKeywordLabel(keyword)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.resultBody}>
                  No obvious missing keywords right now. Your resume already covers the main language from the job post pretty well.
                </Text>
              )}
            </View>

            <Text style={styles.atsBreakdownLabel}>Weak/indirect matches</Text>
            <View style={styles.keywordChipRow}>
              {atsInsights.weakMatches.length > 0 ? (
                atsInsights.weakMatches.map((keyword: string) => (
                  <View key={`weak-${keyword}`} style={styles.keywordChipMuted}>
                    <Text style={styles.keywordChipMutedText}>{formatKeywordLabel(keyword)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.resultBody}>No weak keyword matches detected.</Text>
              )}
            </View>

            <Text style={styles.atsBreakdownLabel}>Overused keywords</Text>
            <View style={styles.keywordChipRow}>
              {atsInsights.overusedKeywords.length > 0 ? (
                atsInsights.overusedKeywords.map((keyword: string) => (
                  <View key={`overused-${keyword}`} style={styles.keywordChipMuted}>
                    <Text style={styles.keywordChipMutedText}>{formatKeywordLabel(keyword)}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.resultBody}>No obvious overused keywords.</Text>
              )}
            </View>
          </View>

        </View>

        <View style={styles.atsBreakdownCard}>
          <Text style={styles.atsBreakdownTitle}>Recruiter Feedback</Text>
          {atsInsights.recruiterFeedback.map((feedback: string, index: number) => (
            <Text key={`feedback-${index}`} style={styles.atsFeedbackItem}>
              {`\u2022 ${feedback}`}
            </Text>
          ))}
        </View>

        <View style={styles.atsBreakdownCard}>
          <Text style={styles.atsBreakdownTitle}>Resume Gap Analyzer</Text>

          <View style={styles.gapGrid}>
            <View style={styles.gapCard}>
              <Text style={styles.gapCardTitle}>Technical Skills</Text>
              <View style={styles.keywordChipRow}>
                {atsInsights.gapAnalysis.technicalSkills.length > 0 ? (
                  atsInsights.gapAnalysis.technicalSkills.map((keyword: string) => (
                    <View key={`gap-tech-${keyword}`} style={styles.keywordChip}>
                      <Text style={styles.keywordChipText}>{formatKeywordLabel(keyword)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.resultBody}>No major technical gaps detected.</Text>
                )}
              </View>
            </View>

            <View style={styles.gapCard}>
              <Text style={styles.gapCardTitle}>Business Language</Text>
              <View style={styles.keywordChipRow}>
                {atsInsights.gapAnalysis.businessLanguage.length > 0 ? (
                  atsInsights.gapAnalysis.businessLanguage.map((keyword: string) => (
                    <View key={`gap-business-${keyword}`} style={styles.keywordChipMuted}>
                      <Text style={styles.keywordChipMutedText}>{formatKeywordLabel(keyword)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.resultBody}>The resume already reflects the main business language pretty well.</Text>
                )}
              </View>
            </View>

            <View style={styles.gapCard}>
              <Text style={styles.gapCardTitle}>Quantified Outcomes</Text>
              {atsInsights.gapAnalysis.quantifiedOutcomes.length > 0 ? (
                atsInsights.gapAnalysis.quantifiedOutcomes.map((item: string, index: number) => (
                  <Text key={`gap-metrics-${index}`} style={styles.atsFeedbackItem}>
                    {`\u2022 ${item}`}
                  </Text>
                ))
              ) : (
                <Text style={styles.resultBody}>You already have some measurable or concrete evidence showing up.</Text>
              )}
            </View>

            <View style={styles.gapCard}>
              <Text style={styles.gapCardTitle}>Tools / Platforms</Text>
              <View style={styles.keywordChipRow}>
                {atsInsights.gapAnalysis.toolsPlatforms.length > 0 ? (
                  atsInsights.gapAnalysis.toolsPlatforms.map((keyword: string) => (
                    <View key={`gap-tools-${keyword}`} style={styles.keywordChip}>
                      <Text style={styles.keywordChipText}>{formatKeywordLabel(keyword)}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.resultBody}>No major platform gaps stand out right now.</Text>
                )}
              </View>
            </View>

          </View>

          <View style={styles.fitAssessmentCard}>
            <Text style={styles.gapCardTitle}>Can you still apply?</Text>
            <View style={styles.fitAssessmentRow}>
              <View
                style={[
                  styles.fitBadge,
                  atsInsights.gapAnalysis.fitAssessment.label === 'Strong fit'
                    ? styles.fitBadgeStrong
                    : atsInsights.gapAnalysis.fitAssessment.label === 'Partial fit'
                      ? styles.fitBadgePartial
                      : styles.fitBadgeStretch,
                ]}
              >
                <Text
                  style={[
                    styles.fitBadgeText,
                    atsInsights.gapAnalysis.fitAssessment.label === 'Strong fit'
                      ? styles.fitBadgeTextStrong
                      : atsInsights.gapAnalysis.fitAssessment.label === 'Partial fit'
                        ? styles.fitBadgeTextPartial
                        : styles.fitBadgeTextStretch,
                  ]}
                >
                  {atsInsights.gapAnalysis.fitAssessment.label}
                </Text>
              </View>
              <Text style={styles.fitAssessmentText}>
                {atsInsights.gapAnalysis.fitAssessment.description}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.atsBreakdownCard}>
          <Text style={styles.atsBreakdownTitle}>Actionable Next Steps</Text>
          {atsInsights.actions.length > 0 ? (
            atsInsights.actions.map(
              (action: {
                id: string;
                label: string;
                description: string;
                type: 'add_skill' | 'add_summary_keyword';
                keyword: string;
              }) => (
                <View key={action.id} style={styles.atsActionRow}>
                  <View style={styles.atsActionTextWrap}>
                    <Text style={styles.atsActionLabel}>{action.label}</Text>
                    <Text style={styles.atsActionDescription}>{action.description}</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.atsApplyButton}
                    onPress={() => applyAtsAction(action)}
                  >
                    <Text style={styles.atsApplyButtonText}>Apply</Text>
                  </TouchableOpacity>
                </View>
              )
            )
          ) : (
            <Text style={styles.resultBody}>
              No quick fixes to apply right now. Focus on tightening project bullets and outcomes.
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
          <Text style={styles.resultTitle}>Export Studio</Text>
          <Text style={styles.exportHelperText}>
            Switch styles any time. Your resume content stays the same, and you can export multiple versions without generating again.
          </Text>

          <View style={styles.styleGrid}>
            {RESUME_STYLE_OPTIONS.map((option) => (
              <ResumeStyleButton key={option.value} value={option.value} />
            ))}
          </View>

          <View style={styles.exportStudioGrid}>
            <View style={styles.exportActionCard}>
              <Text style={styles.exportActionTitle}>Resume</Text>
              <View style={styles.exportActionRow}>
                <TouchableOpacity style={styles.secondaryButtonCompact} onPress={copyFullResume}>
                  <Text style={styles.secondaryButtonCompactText}>Copy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.secondaryButtonCompact, exportingPdf && styles.disabledButton]}
                  onPress={exportPdf}
                  disabled={exportingPdf}
                >
                  <Text style={styles.secondaryButtonCompactText}>
                    {exportingPdf ? 'Exporting...' : 'Export PDF'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.exportActionCard}>
              <Text style={styles.exportActionTitle}>Cover Letter</Text>
              <View style={styles.exportActionRow}>
                <TouchableOpacity
                  style={[
                    styles.secondaryButtonCompact,
                    !coverLetterDraft.coverLetter.trim() && styles.disabledButton,
                  ]}
                  onPress={() => copySection(coverLetterDraft.coverLetter)}
                  disabled={!coverLetterDraft.coverLetter.trim()}
                >
                  <Text style={styles.secondaryButtonCompactText}>Copy</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.secondaryButtonCompact,
                    (exportingPdf || !coverLetterDraft.coverLetter.trim()) && styles.disabledButton,
                  ]}
                  onPress={exportCoverLetterPdf}
                  disabled={exportingPdf || !coverLetterDraft.coverLetter.trim()}
                >
                  <Text style={styles.secondaryButtonCompactText}>
                    {exportingPdf ? 'Exporting...' : 'Export PDF'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </>
    );
  };

  const renderAssistantWidget = () => {
    if (!result) return null;

    return (
      <View style={styles.assistantOverlay}>
        {assistantOpen ? (
          <View style={[styles.assistantWindow, { width: Math.min(width - 32, 380) }]}>
            <View style={styles.assistantWindowHeader}>
              <View>
                <Text style={styles.assistantWindowEyebrow}>Cloudflare AI</Text>
                <Text style={styles.assistantWindowTitle}>Ask ResumAI</Text>
              </View>
              <TouchableOpacity
                style={styles.assistantCloseButton}
                onPress={() => setAssistantOpen(false)}
              >
                <Text style={styles.assistantCloseButtonText}>Close</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.assistantWindowSubtitle}>
              Ask about ATS fit, summary wording, skills, or a specific bullet while you edit.
            </Text>

            <View style={styles.assistantPromptRow}>
              {ASSISTANT_PROMPTS.map((prompt) => (
                <TouchableOpacity
                  key={prompt}
                  style={[
                    styles.assistantPromptChip,
                    assistantLoading && styles.disabledButton,
                  ]}
                  onPress={() => askAssistant(prompt)}
                  disabled={assistantLoading}
                >
                  <Text style={styles.assistantPromptChipText}>{prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView
              style={styles.assistantMessagesScroll}
              contentContainerStyle={styles.assistantMessagesContent}
              keyboardShouldPersistTaps="handled"
            >
              {assistantMessages.length > 0 ? (
                assistantMessages.map((message) => (
                  <View
                    key={message.id}
                    style={[
                      styles.assistantMessageBubble,
                      message.role === 'user'
                        ? styles.assistantMessageBubbleUser
                        : styles.assistantMessageBubbleAssistant,
                    ]}
                  >
                    <Text style={styles.assistantMessageRole}>
                      {message.role === 'user' ? 'You' : 'ResumAI Assistant'}
                    </Text>
                    <Text style={styles.assistantMessageText}>{message.content}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.resultBody}>
                  Start with a quick prompt like “What keywords am I missing?” or paste a bullet and ask for a stronger rewrite.
                </Text>
              )}

              {assistantSuggestions.length > 0 ? (
                <View style={styles.assistantSuggestionCard}>
                  <Text style={styles.assistantSuggestionTitle}>Suggested next steps</Text>
                  {assistantSuggestions.map((item) => (
                    <Text key={item} style={styles.atsFeedbackItem}>
                      {`\u2022 ${item}`}
                    </Text>
                  ))}
                </View>
              ) : null}
            </ScrollView>

            {assistantError ? (
              <Text style={styles.assistantErrorText}>{assistantError}</Text>
            ) : null}

            <TextInput
              style={[styles.editInput, styles.assistantInput]}
              multiline
              value={assistantInput}
              onChangeText={setAssistantInput}
              placeholder="Ask about this role, ATS fit, summary, skills, or a specific bullet..."
              placeholderTextColor="#8C8C8C"
              textAlignVertical="top"
            />

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.primaryButtonCompact, assistantLoading && styles.disabledButton]}
                onPress={() => askAssistant()}
                disabled={assistantLoading}
              >
                <Text style={styles.primaryButtonCompactText}>
                  {assistantLoading ? 'Thinking...' : 'Send'}
                </Text>
              </TouchableOpacity>

              {assistantMessages.length > 0 ? (
                <TouchableOpacity
                  style={[styles.secondaryButtonCompact, assistantLoading && styles.disabledButton]}
                  onPress={resetAssistant}
                  disabled={assistantLoading}
                >
                  <Text style={styles.secondaryButtonCompactText}>New Chat</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.assistantFab}
          onPress={() => setAssistantOpen((prev) => !prev)}
          activeOpacity={0.9}
        >
          <Text style={styles.assistantFabIcon}>AI</Text>
          <Text style={styles.assistantFabText}>Ask AI</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderEditorWorkspaceIntro = () => (
    <View style={styles.editorWorkspaceHeader}>
      <Text style={styles.sectionEyebrow}>Resume Editor</Text>
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
          {renderWorkflowTimeline()}
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
        {renderApplicationKitSection()}
        {renderInterviewPrepCta()}
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
                  {renderJobImporter()}
                  <Text style={styles.label}>Paste Job Description Here</Text>
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

                    <Text style={styles.label}>Optimization Mode</Text>
                    <View style={styles.pillRow}>
                      {RESUME_MODE_OPTIONS.map((mode) => (
                        <ResumeModeButton key={mode} value={mode} />
                      ))}
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
                    renderWorkflowTimeline()
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
                  {renderApplicationKitSection()}
                  {renderInterviewPrepCta()}
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
                  {renderJobImporter()}
                  <Text style={styles.label}>Paste Job Description Here</Text>
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

                  <Text style={styles.label}>Optimization Mode</Text>
                  <View style={styles.pillRow}>
                    {RESUME_MODE_OPTIONS.map((mode) => (
                      <ResumeModeButton key={mode} value={mode} />
                    ))}
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
        {renderAssistantWidget()}
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
    fontSize: 26,
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
    padding: 24,
    minHeight: 260,
    width: '100%',
  },
  loadingText: {
    color: '#64748B',
    marginTop: 12,
    fontSize: 15,
  },
  workflowHeader: {
    marginBottom: 18,
  },
  workflowTitle: {
    color: '#1E293B',
    fontSize: 26,
    fontWeight: '800',
  },
  workflowSubtitle: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  workflowTimeline: {
    marginTop: 4,
  },
  workflowStepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    minHeight: 64,
  },
  workflowStepIndicatorWrap: {
    alignItems: 'center',
    marginRight: 14,
  },
  workflowStepIndicator: {
    width: 28,
    height: 28,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  workflowStepIndicatorComplete: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  workflowStepIndicatorActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#2563EB',
  },
  workflowStepIndicatorPending: {
    backgroundColor: '#FFFFFF',
    borderColor: '#CBD5E1',
  },
  workflowStepIndicatorCheck: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  workflowStepConnector: {
    width: 2,
    flex: 1,
    marginTop: 6,
    borderRadius: 999,
  },
  workflowStepConnectorComplete: {
    backgroundColor: '#93C5FD',
  },
  workflowStepConnectorPending: {
    backgroundColor: '#E2E8F0',
  },
  workflowStepTextWrap: {
    flex: 1,
    paddingTop: 2,
    paddingBottom: 14,
  },
  workflowStepTitle: {
    color: '#334155',
    fontSize: 15,
    fontWeight: '700',
  },
  workflowStepTitleActive: {
    color: '#1E40AF',
  },
  workflowStepTitleComplete: {
    color: '#1E293B',
  },
  workflowStepStatus: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
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
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  sectionTitle: {
    color: '#1E293B',
    fontSize: 24,
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
  jobImportWrap: {
    marginTop: 6,
    marginBottom: 12,
  },
  jobPreviewCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
  },
  jobPreviewTitle: {
    color: '#1E293B',
    fontSize: 15,
    fontWeight: '800',
  },
  jobPreviewMeta: {
    color: '#64748B',
    fontSize: 13,
    marginTop: 4,
  },
  jobPreviewStatus: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
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
  exportStudioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
    marginHorizontal: -6,
  },
  exportActionCard: {
    flex: 1,
    minWidth: 220,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 6,
    marginBottom: 12,
  },
  exportActionTitle: {
    color: '#0F172A',
    fontSize: 18,
    fontWeight: '800',
  },
  exportActionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    marginHorizontal: -5,
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
    fontSize: 28,
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
  assistantOverlay: {
    position: 'absolute',
    left: 18,
    bottom: 18,
    zIndex: 30,
    alignItems: 'flex-start',
  },
  assistantWindow: {
    width: 360,
    maxWidth: 360,
    maxHeight: 560,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 24,
    padding: 16,
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  assistantWindowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  assistantWindowEyebrow: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  assistantWindowTitle: {
    color: '#0F172A',
    fontSize: 26,
    fontWeight: '800',
    marginTop: 4,
  },
  assistantWindowSubtitle: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
    marginBottom: 12,
  },
  assistantCloseButton: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  assistantCloseButtonText: {
    color: '#1D4ED8',
    fontSize: 13,
    fontWeight: '800',
  },
  assistantFab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#0F172A',
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  assistantFabIcon: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '900',
    marginRight: 8,
  },
  assistantFabText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  assistantPromptRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -5,
    marginBottom: 6,
  },
  assistantPromptChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginHorizontal: 5,
    marginBottom: 10,
  },
  assistantPromptChipText: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
  assistantMessagesWrap: {
    marginTop: 8,
  },
  assistantMessagesScroll: {
    maxHeight: 250,
    marginTop: 4,
  },
  assistantMessagesContent: {
    paddingBottom: 4,
  },
  assistantMessageBubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  assistantMessageBubbleUser: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  assistantMessageBubbleAssistant: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  assistantMessageRole: {
    color: '#1E293B',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 6,
  },
  assistantMessageText: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 21,
  },
  assistantSuggestionCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginTop: 6,
  },
  assistantSuggestionTitle: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '800',
  },
  assistantErrorText: {
    color: '#B91C1C',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 12,
  },
  assistantInput: {
    minHeight: 92,
    marginTop: 12,
    paddingTop: 12,
  },
  exportHelperText: {
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    marginBottom: 14,
  },
  applicationChecklist: {
    marginTop: 2,
  },
  applicationChecklistItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  applicationChecklistBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 12,
    marginTop: 2,
  },
  applicationChecklistBadgeComplete: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  applicationChecklistBadgePending: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  applicationChecklistBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  applicationChecklistBadgeTextComplete: {
    color: '#166534',
  },
  applicationChecklistBadgeTextPending: {
    color: '#92400E',
  },
  applicationChecklistTextWrap: {
    flex: 1,
  },
  applicationChecklistTitle: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '800',
  },
  applicationChecklistHelper: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  applicationKitGrid: {
    marginTop: 18,
  },
  applicationKitCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  applicationKitTitle: {
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '800',
  },
  applicationKitStatValue: {
    color: '#2563EB',
    fontSize: 28,
    fontWeight: '800',
    marginTop: 8,
  },
  applicationKitBody: {
    color: '#475569',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 8,
  },
  smallOutlineButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 12,
  },
  smallOutlineButtonText: {
    color: '#1E40AF',
    fontSize: 13,
    fontWeight: '800',
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
    fontSize: 28,
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
    fontSize: 18,
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
  keywordChipMuted: {
    backgroundColor: '#F8FAFC',
    borderColor: '#E2E8F0',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 10,
    marginBottom: 10,
  },
  keywordChipMutedText: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '700',
  },
  atsBreakdownGrid: {
    marginTop: 16,
  },
  atsBreakdownCard: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    padding: 14,
    marginTop: 14,
  },
  atsBreakdownTitle: {
    color: '#1E293B',
    fontSize: 16,
    fontWeight: '800',
  },
  atsBreakdownLabel: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 12,
  },
  atsSectionScoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  atsSectionScoreLabel: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  atsSectionScoreValue: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '800',
  },
  atsFeedbackItem: {
    color: '#334155',
    fontSize: 14,
    lineHeight: 22,
    marginTop: 10,
  },
  reasoningCardGrid: {
    marginTop: 14,
  },
  reasoningCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  reasoningCardTitle: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '800',
  },
  reasoningCardBody: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 6,
  },
  gapGrid: {
    marginTop: 14,
  },
  gapCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginBottom: 12,
  },
  gapCardTitle: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '800',
  },
  fitAssessmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
    marginTop: 2,
  },
  fitAssessmentRow: {
    marginTop: 10,
  },
  fitBadge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  fitBadgeStrong: {
    backgroundColor: '#DCFCE7',
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  fitBadgePartial: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  fitBadgeStretch: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
  },
  fitBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  fitBadgeTextStrong: {
    color: '#166534',
  },
  fitBadgeTextPartial: {
    color: '#92400E',
  },
  fitBadgeTextStretch: {
    color: '#991B1B',
  },
  fitAssessmentText: {
    color: '#475569',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 10,
  },
  atsActionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 12,
    gap: 12,
  },
  atsActionTextWrap: {
    flex: 1,
  },
  atsActionLabel: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '800',
  },
  atsActionDescription: {
    color: '#64748B',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 4,
  },
  atsApplyButton: {
    backgroundColor: '#EFF6FF',
    borderColor: '#BFDBFE',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  atsApplyButtonText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '800',
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
