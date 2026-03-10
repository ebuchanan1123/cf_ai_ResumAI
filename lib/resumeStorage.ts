import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UserProfile } from '@/lib/profileStorage';

export type TailoredResumeResponse = {
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
  jobDescription: string;
  profileName: string;
  result: TailoredResumeResponse;
};

const RESUME_VERSIONS_KEY = 'resumai_saved_resume_versions';

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

export const createResumeVersion = ({
  title,
  tone,
  jobDescription,
  profile,
  result,
}: {
  title: string;
  tone: string;
  jobDescription: string;
  profile: UserProfile | null;
  result: TailoredResumeResponse;
}): SavedResumeVersion => {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    title: title.trim() || 'Untitled Resume',
    createdAt: new Date().toISOString(),
    tone,
    jobDescription,
    profileName: profile?.fullName || 'Unknown User',
    result,
  };
};