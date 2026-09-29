import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import sunnah from '../data/sunnah.json';
import {
  buildReminderPlan,
  reminderPlanKey,
  type ReminderSettings,
  type ReminderResult,
  type SunnahReminder,
} from '../domain/schedule';

export type { ReminderSettings, ReminderResult } from '../domain/schedule';

const CHANNEL_ID = 'rahmah-reminders';
const APP_MARKER = 'rahmah';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Mutations are serialized, including disable and test, so a slow native request
// cannot put old reminders back after the user has turned them off.
let workQueue: Promise<unknown> = Promise.resolve();
function serialize<T>(work: () => Promise<T>): Promise<T> {
  const result = workQueue.then(work, work);
  workQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function configureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Kundalik eslatmalar',
    description: 'Istig‘for va sunnat uchun muloyim eslatmalar',
    importance: Notifications.AndroidImportance.DEFAULT,
    sound: 'default',
    enableVibrate: false,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    showBadge: false,
  });
}

function isAllowed(permission: Notifications.NotificationPermissionsStatus): boolean {
  if (Platform.OS === 'ios' && permission.ios) {
    return [
      Notifications.IosAuthorizationStatus.AUTHORIZED,
      Notifications.IosAuthorizationStatus.PROVISIONAL,
      Notifications.IosAuthorizationStatus.EPHEMERAL,
    ].includes(permission.ios.status);
  }
  return permission.granted;
}

async function ensurePermission(request: boolean): Promise<boolean> {
  // Android needs a channel before an explicit permission request.
  if (request) await configureChannel();
  let permission = await Notifications.getPermissionsAsync();
  if (!isAllowed(permission) && request && permission.canAskAgain) {
    permission = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    });
  }
  if (!isAllowed(permission)) return false;
  if (!request) await configureChannel();
  return true;
}

export function syncReminders(
  settings: ReminderSettings,
  hasActiveReflections: boolean,
  requestPermission = false,
): Promise<ReminderResult> {
  // Capture the caller's choice before awaiting another queued operation.
  const snapshot = { ...settings, times: [...settings.times] };
  return serialize(async () => {
    if (!snapshot.enabled) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return { status: 'disabled', scheduled: 0 };
    }
    const now = new Date();
    const plan = buildReminderPlan(snapshot, hasActiveReflections, sunnah.reminders as SunnahReminder[], now);
    if (!await ensurePermission(requestPermission)) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      return { status: 'denied', scheduled: 0 };
    }
    const key = reminderPlanKey(plan, now);
    const pending = await Notifications.getAllScheduledNotificationsAsync();
    const desired = new Set(plan.map((item) => item.identifier));
    const existingPlan = pending.filter((item) => item.content.data?.app === APP_MARKER && item.content.data?.scheduleKey);
    const unchanged = existingPlan.length === plan.length && existingPlan.every((item) =>
      desired.has(item.identifier) && item.content.data?.scheduleKey === key,
    );
    if (unchanged) return { status: 'enabled', scheduled: plan.length };

    await Notifications.cancelAllScheduledNotificationsAsync();
    try {
      for (const reminder of plan) {
        const trigger: Notifications.NotificationTriggerInput = reminder.trigger.type === 'daily'
          ? {
            type: Notifications.SchedulableTriggerInputTypes.DAILY,
            hour: reminder.trigger.hour,
            minute: reminder.trigger.minute,
            channelId: CHANNEL_ID,
          }
          : {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: reminder.trigger.weekday,
            hour: reminder.trigger.hour,
            minute: reminder.trigger.minute,
            channelId: CHANNEL_ID,
          };
        await Notifications.scheduleNotificationAsync({
          identifier: reminder.identifier,
          content: {
            title: reminder.title,
            body: reminder.body,
            sound: 'default',
            data: { app: APP_MARKER, screen: reminder.screen, scheduleKey: key },
          },
          trigger,
        });
      }
    } catch (error) {
      // A partial schedule is not reported as success; a later sync can retry.
      await Notifications.cancelAllScheduledNotificationsAsync();
      throw error;
    }
    return { status: 'enabled', scheduled: plan.length };
  });
}

/** Called by an explicit user action; the permission prompt is allowed here. */
export function sendTestNotification(): Promise<ReminderResult> {
  return serialize(async () => {
    if (!await ensurePermission(true)) return { status: 'denied', scheduled: 0 };
    await Notifications.scheduleNotificationAsync({
      identifier: 'rahmah.test',
      content: {
        title: 'Eslatmalar tayyor',
        body: 'Bu sinov eslatmasi. Kichik, davomli qadamlar bilan boshlaymiz.',
        sound: 'default',
        data: { app: APP_MARKER, screen: 'today' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: 5,
        channelId: CHANNEL_ID,
      },
    });
    return { status: 'enabled', scheduled: 1 };
  });
}

export async function getTestNotificationStatus(): Promise<string> {
  return 'Sinov eslatmasini telefonning bildirishnomalar markazidan tekshiring.';
}

let lastHandledResponse: string | undefined;

export function subscribeToReminderOpen(listener: (tab: 'istighfar' | 'today', quoteId?: string) => void): () => void {
  const handle = (response: Notifications.NotificationResponse | null) => {
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const { notification } = response;
    const data = notification.request.content.data;
    if (data?.app !== APP_MARKER || (data.screen !== 'today' && data.screen !== 'istighfar')) return;
    const responseKey = `${notification.request.identifier}:${notification.date}:${response.actionIdentifier}`;
    if (responseKey === lastHandledResponse) return;
    lastHandledResponse = responseKey;
    listener(data.screen);
    Notifications.clearLastNotificationResponse();
  };

  // Attach first so an interaction during cold-start inspection is not lost.
  const subscription = Notifications.addNotificationResponseReceivedListener(handle);
  handle(Notifications.getLastNotificationResponse());
  return () => subscription.remove();
}
