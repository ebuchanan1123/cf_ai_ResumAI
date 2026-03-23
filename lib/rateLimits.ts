import AsyncStorage from '@react-native-async-storage/async-storage';

const RATE_LIMIT_STORAGE_KEY = 'resumai_daily_rate_limits';

export type RateLimitKey =
  | 'resume_generation'
  | 'bullet_generation'
  | 'cover_letter_generation';

type StoredRateLimit = {
  count: number;
  date: string;
};

type RateLimitStore = Partial<Record<RateLimitKey, StoredRateLimit>>;

const DAILY_LIMITS: Record<RateLimitKey, number> = {
  resume_generation: 100,
  bullet_generation: 100,
  cover_letter_generation: 100,
};

const getLocalDateKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, '0');
  const day = `${now.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const loadRateLimitStore = async (): Promise<RateLimitStore> => {
  const raw = await AsyncStorage.getItem(RATE_LIMIT_STORAGE_KEY);

  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw) as RateLimitStore;
  } catch {
    return {};
  }
};

const saveRateLimitStore = async (store: RateLimitStore) => {
  await AsyncStorage.setItem(RATE_LIMIT_STORAGE_KEY, JSON.stringify(store));
};

const getEntryForToday = (store: RateLimitStore, key: RateLimitKey): StoredRateLimit => {
  const today = getLocalDateKey();
  const entry = store[key];

  if (!entry || entry.date !== today) {
    return { count: 0, date: today };
  }

  return entry;
};

export const getDailyUsage = async (key: RateLimitKey) => {
  const store = await loadRateLimitStore();
  const entry = getEntryForToday(store, key);
  const limit = DAILY_LIMITS[key];

  return {
    count: entry.count,
    remaining: Math.max(limit - entry.count, 0),
    limit,
  };
};

export const consumeDailyUsage = async (key: RateLimitKey) => {
  const store = await loadRateLimitStore();
  const entry = getEntryForToday(store, key);
  const nextCount = entry.count + 1;
  const limit = DAILY_LIMITS[key];

  store[key] = {
    date: entry.date,
    count: nextCount,
  };

  await saveRateLimitStore(store);

  return {
    count: nextCount,
    remaining: Math.max(limit - nextCount, 0),
    limit,
  };
};

export const releaseDailyUsage = async (key: RateLimitKey) => {
  const store = await loadRateLimitStore();
  const entry = getEntryForToday(store, key);
  const nextCount = Math.max(entry.count - 1, 0);
  const limit = DAILY_LIMITS[key];

  store[key] = {
    date: entry.date,
    count: nextCount,
  };

  await saveRateLimitStore(store);

  return {
    count: nextCount,
    remaining: Math.max(limit - nextCount, 0),
    limit,
  };
};

export const getLimitReachedMessage = (key: RateLimitKey, label: string) =>
  `You've reached today's ${DAILY_LIMITS[key]} ${label} limit on this device. Try again tomorrow.`;
