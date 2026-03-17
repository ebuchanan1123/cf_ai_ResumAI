import AsyncStorage from '@react-native-async-storage/async-storage';

export type Tone = 'Concise' | 'Technical' | 'Impact-focused';

export type BulletDraft = {
  jobTitle: string;
  experience: string;
  jobDescription: string;
  tone: Tone;
  bullets: string[];
};

export type CoverLetterDraft = {
  jobDescription: string;
  companyContext: string;
  hiringManager: string;
  tone: Tone;
  coverLetter: string;
};

const BULLET_DRAFT_KEY = 'resumai_bullet_draft';
const COVER_LETTER_DRAFT_KEY = 'resumai_cover_letter_draft';

const createEmptyBulletDraft = (): BulletDraft => ({
  jobTitle: '',
  experience: '',
  jobDescription: '',
  tone: 'Technical',
  bullets: [],
});

const createEmptyCoverLetterDraft = (): CoverLetterDraft => ({
  jobDescription: '',
  companyContext: '',
  hiringManager: '',
  tone: 'Technical',
  coverLetter: '',
});

export const loadBulletDraft = async (): Promise<BulletDraft> => {
  const raw = await AsyncStorage.getItem(BULLET_DRAFT_KEY);

  if (!raw) {
    return createEmptyBulletDraft();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<BulletDraft>;
    return {
      ...createEmptyBulletDraft(),
      ...parsed,
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets : [],
    };
  } catch {
    return createEmptyBulletDraft();
  }
};

export const saveBulletDraft = async (draft: BulletDraft) => {
  await AsyncStorage.setItem(BULLET_DRAFT_KEY, JSON.stringify(draft));
};

export const loadCoverLetterDraft = async (): Promise<CoverLetterDraft> => {
  const raw = await AsyncStorage.getItem(COVER_LETTER_DRAFT_KEY);

  if (!raw) {
    return createEmptyCoverLetterDraft();
  }

  try {
    const parsed = JSON.parse(raw) as Partial<CoverLetterDraft>;
    return {
      ...createEmptyCoverLetterDraft(),
      ...parsed,
    };
  } catch {
    return createEmptyCoverLetterDraft();
  }
};

export const saveCoverLetterDraft = async (draft: CoverLetterDraft) => {
  await AsyncStorage.setItem(COVER_LETTER_DRAFT_KEY, JSON.stringify(draft));
};
