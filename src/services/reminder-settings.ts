import { normalizeReminderSettings, type ReminderResult, type ReminderSettings } from '../domain/schedule';

export type ReminderSaveOutcome = {
  /** Settings now stored on this device. */
  settings: ReminderSettings;
  /** Result from the reminder service, or null when it could not be reached. */
  result: ReminderResult | null;
  /** False when the times were kept locally but the schedule was not updated. */
  synced: boolean;
  syncError?: string;
};

export type ReminderSaveDependencies = {
  persist: (settings: ReminderSettings) => Promise<void>;
  sync: (settings: ReminderSettings, hasActiveReflections: boolean, requestPermission: boolean) => Promise<ReminderResult>;
};

export class LocalSettingsSaveError extends Error {
  constructor() {
    super('Sozlamalarni telefonda saqlab bo‘lmadi. Qayta urinib ko‘ring.');
    this.name = 'LocalSettingsSaveError';
  }
}

function message(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'Eslatma xizmatini yangilab bo‘lmadi.';
}

/**
 * Keeps the user's chosen reminder times on the device even when the push
 * server cannot be reached. A failed network request never discards them.
 *
 * The reminder sync starts first and synchronously: iOS only shows the
 * notification permission prompt when it is requested inside the tap itself,
 * before any awaited work. The local save runs alongside it and does not
 * depend on the network.
 */
export async function saveReminderSettings(
  requested: ReminderSettings,
  current: ReminderSettings,
  hasActiveReflections: boolean,
  dependencies: ReminderSaveDependencies,
): Promise<ReminderSaveOutcome> {
  const normalized = normalizeReminderSettings(requested);
  // Do not claim reminders are on before the service confirms a new opt-in.
  const local: ReminderSettings = { ...normalized, enabled: normalized.enabled && current.enabled };

  const syncing = dependencies.sync(normalized, hasActiveReflections, true);
  const [saved, synced] = await Promise.allSettled([dependencies.persist(local), syncing]);
  if (saved.status === 'rejected') throw new LocalSettingsSaveError();

  if (synced.status === 'rejected') {
    return { settings: local, result: null, synced: false, syncError: message(synced.reason) };
  }

  const result = synced.value;
  const confirmed: ReminderSettings = { ...normalized, enabled: result.status === 'enabled' };
  if (confirmed.enabled !== local.enabled) {
    try { await dependencies.persist(confirmed); }
    catch { throw new LocalSettingsSaveError(); }
  }
  return { settings: confirmed, result, synced: true };
}
