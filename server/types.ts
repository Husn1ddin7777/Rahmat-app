import type { NormalizedReminderSettings, ReminderScreen, ReminderSettings } from '../src/domain/schedule';

export type BrowserSubscription = {
  endpoint: string;
  expirationTime: number | null;
  keys: { p256dh: string; auth: string };
};

/** This is the entire server-side preference record. Reflections never enter it. */
export type Registration = {
  subscription: BrowserSubscription;
  settings: NormalizedReminderSettings;
  /** 0–5 istighfar prompts a day: a number only, never an entry or its routine. */
  istighfarSlots: number;
  timeZone: string;
};

/**
 * Records stored before routines existed carry only the old active/inactive flag,
 * and records from before 1.2 lack the newer settings (script, prayers, fasting).
 */
export type StoredRegistration = Omit<Registration, 'istighfarSlots' | 'settings'> & {
  settings: ReminderSettings;
  istighfarSlots?: number;
  hasActiveReflections?: boolean;
};

export type PushNotice = {
  id: string;
  title: string;
  body: string;
  screen: ReminderScreen;
  quoteId?: string;
  url: string;
  tag: string;
};

export type Delivery = {
  notice: PushNotice;
  dueAt: number;
  expiresAt: number;
  attemptAt: number;
  attempts: number;
};

export type DeviceRecord = StoredRegistration & {
  version: 1;
  updatedAt: number;
  next: Delivery | null;
  test: Delivery | null;
  handled: string[];
  testDay: string;
  testCount: number;
  lastTestAt: number;
  lastTestResult?: { outcome: PushOutcome | 'expired'; at: number; httpStatus?: number; failure?: 'prepare' | 'network' };
};

// Narrow structural interfaces keep native Expo types separate from Worker types.
// The SQLite-backed DO supports the transactional key/value API as well as SQL.
export interface StorageTransaction {
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  setAlarm(timestamp: number): Promise<void>;
  deleteAlarm(): Promise<void>;
}

export interface DeviceStorage extends StorageTransaction {
  get<T>(key: string): Promise<T | undefined>;
  transaction<T>(callback: (transaction: StorageTransaction) => Promise<T>): Promise<T>;
}

export interface DeviceContext { storage: DeviceStorage }
export interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  DEVICES: {
    idFromName(name: string): unknown;
    get(id: unknown): { fetch(request: Request): Promise<Response> };
  };
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

export type PushOutcome = 'sent' | 'gone' | 'retry' | 'rejected';
