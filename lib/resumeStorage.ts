import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile } from '@/lib/profileStorage';

export type ResumeOptimizationMode =
  | 'ATS-first'
  | 'Recruiter-friendly'
  | 'Technical-heavy'
  | 'Concise'
  | 'Leadership/impact'
  | 'Entry-level student'
  | 'Startup-focused';

export type TailoredResumeResponse = {
  companyName?: string;
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

export type SavedResumeVersion = {
  id: string;
  title: string;
  createdAt: string;
  tone: string;
  optimizationMode?: ResumeOptimizationMode;
  jobDescription: string;
  profileName: string;
  result: TailoredResumeResponse;
};

const RESUME_VERSIONS_KEY = 'resumai_saved_resume_versions';
const CURRENT_RESUME_DRAFT_KEY = 'resumai_current_resume_draft';

export type ResumeDraft = {
  jobUrl: string;
  importedJobPreview: {
    title: string;
    company: string;
    location: string;
    keywords: string[];
    sourceUrl: string;
    parseSucceeded: boolean;
  } | null;
  jobDescription: string;
  tone: string;
  optimizationMode: ResumeOptimizationMode;
  resumeStyle: string;
  saveTitle: string;
  result: TailoredResumeResponse | null;
};

const createEmptyResumeDraft = (): ResumeDraft => ({
  jobUrl: '',
  importedJobPreview: null,
  jobDescription: '',
  tone: 'Technical',
  optimizationMode: 'Recruiter-friendly',
  resumeStyle: 'Classic',
  saveTitle: '',
  result: null,
});

export const loadSavedResumeVersions = async (): Promise<SavedResumeVersion[]> => {
  const raw = await AsyncStorage.getItem(RESUME_VERSIONS_KEY);

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as SavedResumeVersion[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveResumeVersions = async (versions: SavedResumeVersion[]) => {
  await AsyncStorage.setItem(RESUME_VERSIONS_KEY, JSON.stringify(versions));
};

export const loadCurrentResumeDraft = async (): Promise<ResumeDraft> => {
  const raw = await AsyncStorage.getItem(CURRENT_RESUME_DRAFT_KEY);

  if (!raw) {
    return createEmptyResumeDraft();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ResumeDraft>;
    return {
      ...createEmptyResumeDraft(),
      ...parsed,
      importedJobPreview: parsed.importedJobPreview ?? null,
      result: parsed.result ?? null,
    };
  } catch {
    return createEmptyResumeDraft();
  }
};

export const saveCurrentResumeDraft = async (draft: ResumeDraft) => {
  await AsyncStorage.setItem(CURRENT_RESUME_DRAFT_KEY, JSON.stringify(draft));
};

export const clearCurrentResumeDraft = async () => {
  await AsyncStorage.removeItem(CURRENT_RESUME_DRAFT_KEY);
};

export const createResumeVersion = ({
  title,
  tone,
  optimizationMode,
  jobDescription,
  profile,
  result,
}: {
  title: string;
  tone: string;
  optimizationMode: ResumeOptimizationMode;
  jobDescription: string;
  profile: UserProfile | null;
  result: TailoredResumeResponse;
}): SavedResumeVersion => {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title: title.trim() || 'Untitled Resume',
    createdAt: new Date().toISOString(),
    tone,
    optimizationMode,
    jobDescription,
    profileName: profile?.fullName || 'Unknown User',
    result,
  };
};
