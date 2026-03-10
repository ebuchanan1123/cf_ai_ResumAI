import AsyncStorage from '@react-native-async-storage/async-storage';

export type EducationItem = {
  school: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string;
  endDate: string;
  details: string;
};

export type ExperienceItem = {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  location: string;
  technologies: string;
  description: string;
};

export type ProjectItem = {
  name: string;
  role: string;
  technologies: string;
  link: string;
  description: string;
};

export type CertificationItem = {
  name: string;
  issuer: string;
  issueDate: string;
  expiryDate: string;
  credentialId: string;
  details: string;
};

export type UserProfile = {
  fullName: string;
  email: string;
  phone: string;
  location: string;
  summaryHint: string;
  skills: string;
  education: EducationItem[];
  experience: ExperienceItem[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
};

export const PROFILE_STORAGE_KEY = 'resumai_user_profile';

export const createEmptyEducation = (): EducationItem => ({
  school: '',
  degree: '',
  fieldOfStudy: '',
  startDate: '',
  endDate: '',
  details: '',
});

export const createEmptyExperience = (): ExperienceItem => ({
  company: '',
  title: '',
  startDate: '',
  endDate: '',
  location: '',
  technologies: '',
  description: '',
});

export const createEmptyProject = (): ProjectItem => ({
  name: '',
  role: '',
  technologies: '',
  link: '',
  description: '',
});

export const createEmptyCertification = (): CertificationItem => ({
  name: '',
  issuer: '',
  issueDate: '',
  expiryDate: '',
  credentialId: '',
  details: '',
});

export const createEmptyProfile = (): UserProfile => ({
  fullName: '',
  email: '',
  phone: '',
  location: '',
  summaryHint: '',
  skills: '',
  education: [],
  experience: [],
  projects: [],
  certifications: [],
});

export const saveProfileToStorage = async (profile: UserProfile) => {
  await AsyncStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile));
};

export const loadProfileFromStorage = async (): Promise<UserProfile> => {
  const raw = await AsyncStorage.getItem(PROFILE_STORAGE_KEY);

  if (!raw) {
    return createEmptyProfile();
  }

  try {
    const parsed = JSON.parse(raw) as UserProfile;

    return {
      ...createEmptyProfile(),
      ...parsed,
      education: Array.isArray(parsed.education) ? parsed.education : [],
      experience: Array.isArray(parsed.experience) ? parsed.experience : [],
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      certifications: Array.isArray(parsed.certifications) ? parsed.certifications : [],
    };
  } catch {
    return createEmptyProfile();
  }
};