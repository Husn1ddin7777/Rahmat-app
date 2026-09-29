import { nextDelivery, zonedDay } from './calendar';
import { sendPush } from './push';
import type { DeviceContext, DeviceRecord, Env, Registration } from './types';
import { ApiError, json, readJson, validateRegistration } from './validation';

export const DEVICE_RETENTION_MS = 90 * 86_400_000;
const STORAGE_KEY = 'reminders';
const MAX_ATTEMPTS = 3;

function registrationKey(record: Registration): string {
  return JSON.stringify([record.settings, record.hasActiveReflections, record.timeZone]);
}

function expiresAt(record: DeviceRecord): number {
  return Math.min(record.updatedAt + DEVICE_RETENTION_MS, record.subscription.expirationTime ?? Infinity);
}

/**
 * One anonymous device per SQLite-backed Durable Object. The transactionally
 * stored JSON record contains only delivery metadata and generic preferences.
 * This class exposes fetch/alarm only; it needs no RPC or Node compatibility.
 */
export class ReminderDevice {
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private readonly ctx: DeviceContext, private readonly env: Env) {}

  private serial<T>(operation: () => Promise<T>): Promise<T> {
    const task = this.tail.then(operation, operation);
    this.tail = task.catch(() => undefined);
    return task;
  }

  fetch(request: Request): Promise<Response> {
    return this.serial(async () => {
      try { return await this.handleRequest(request); }
      catch (error) {
        return error instanceof ApiError
          ? json({ error: error.message }, error.status, error.status === 429 ? { 'Retry-After': '60' } : undefined)
          : json({ error: 'Eslatmani saqlab bo‘lmadi. Qayta urinib ko‘ring.' }, 500);
      }
    });
  }

  alarm(): Promise<void> {
    return this.serial(async () => {
      try { await this.handleAlarm(); }
      catch {
        // Durable alarms retry only a bounded number of times by default.
        // Leave an explicit recovery alarm so a temporary outage cannot stop
        // future reminders permanently. No request data enters error logs.
        await this.ctx.storage.setAlarm(Date.now() + 60_000);
      }
    });
  }

  private async persist(record: DeviceRecord): Promise<void> {
    const nextAlarm = Math.min(
      record.next?.attemptAt ?? Infinity,
      record.test?.attemptAt ?? Infinity,
      expiresAt(record),
    );
    await this.ctx.storage.transaction(async (transaction) => {
      await transaction.put(STORAGE_KEY, record);
      await transaction.setAlarm(Math.max(Date.now() + 100, nextAlarm));
    });
  }

  private async clear(): Promise<void> {
    await this.ctx.storage.transaction(async (transaction) => {
      await transaction.delete(STORAGE_KEY);
      await transaction.deleteAlarm();
    });
  }

  private async handleRequest(request: Request): Promise<Response> {
    const path = new URL(request.url).pathname;
    const now = Date.now();
    if (path === '/api/push/status' && request.method === 'GET') {
      const record = await this.ctx.storage.get<DeviceRecord>(STORAGE_KEY);
      if (!record || expiresAt(record) <= now) return json({ registered: false, pending: false, result: null });
      // Only this authenticated device can read its test outcome. No keys or
      // endpoint are returned, and provider acceptance is not phone delivery.
      return json({ registered: true, pending: !!record.test, result: record.lastTestResult ?? null });
    }
    if (path === '/api/push/subscription' && request.method === 'DELETE') {
      await this.clear();
      return json({ status: 'disabled', scheduled: 0 });
    }
    if (path === '/api/push/subscription' && request.method === 'PUT') {
      const input = await validateRegistration(await readJson(request), now);
      const stored = await this.ctx.storage.get<DeviceRecord>(STORAGE_KEY);
      const previous = stored && expiresAt(stored) > now ? stored : undefined;
      const handled = previous?.handled ?? [];
      const changed = !previous || registrationKey(previous) !== registrationKey(input);
      const record: DeviceRecord = {
        ...input, version: 1, updatedAt: now, handled,
        next: changed ? nextDelivery(input, now, handled) : previous.next,
        test: previous?.test ?? null,
        testDay: previous?.testDay ?? '', testCount: previous?.testCount ?? 0,
        lastTestAt: previous?.lastTestAt ?? 0,
        lastTestResult: previous?.lastTestResult,
      };
      await this.persist(record);
      return json({
        status: input.settings.enabled ? 'enabled' : 'disabled',
        scheduled: input.settings.enabled ? input.settings.sunnahPerDay + (input.hasActiveReflections ? 5 : 0) : 0,
        nextAt: record.next?.dueAt ?? null,
      });
    }
    if (path === '/api/push/test' && request.method === 'POST') {
      const record = await this.ctx.storage.get<DeviceRecord>(STORAGE_KEY);
      if (!record || expiresAt(record) <= now) {
        if (record) await this.clear();
        throw new ApiError(409, 'Avval bildirishnomalarni yoqing.');
      }
      // Retrying the request while its test is pending returns that same job.
      if (record.test && record.test.expiresAt > now) {
        return json({ status: 'enabled', scheduled: 1, nextAt: record.test.dueAt }, 202);
      }
      const day = zonedDay(now, record.timeZone);
      const count = record.testDay === day ? record.testCount : 0;
      if (now - record.lastTestAt < 60_000 || count >= 5) {
        throw new ApiError(429, 'Sinov eslatmasi uchun biroz kuting. Kuniga 5 tagacha sinov mumkin.');
      }
      const dueAt = now + 5000;
      const id = `test-${now}`;
      record.test = {
        notice: {
          id, title: 'Rahmat', body: 'Eslatmalar tayyor. Qalbingizga bir lahza ajrating.',
          screen: 'today', url: '/?screen=today', tag: `rahmat-${id}`,
        },
        dueAt, expiresAt: dueAt + 60_000, attemptAt: dueAt, attempts: 0,
      };
      record.lastTestAt = now;
      record.lastTestResult = undefined;
      record.testDay = day;
      record.testCount = count + 1;
      await this.persist(record);
      return json({ status: 'enabled', scheduled: 1, nextAt: dueAt }, 202);
    }
    return json({ error: 'Manzil topilmadi.' }, 404);
  }

  private finish(record: DeviceRecord, key: 'next' | 'test', now: number): void {
    const delivery = record[key];
    if (delivery) record.handled = [...record.handled.filter((id) => id !== delivery.notice.id), delivery.notice.id].slice(-64);
    record[key] = key === 'next' ? nextDelivery(record, now, record.handled) : null;
  }

  private async handleAlarm(): Promise<void> {
    const record = await this.ctx.storage.get<DeviceRecord>(STORAGE_KEY);
    if (!record || expiresAt(record) <= Date.now()) { await this.clear(); return; }
    for (const key of ['next', 'test'] as const) {
      const delivery = record[key];
      const now = Date.now();
      if (!delivery || delivery.attemptAt > now) continue;
      if (delivery.expiresAt <= now || record.handled.includes(delivery.notice.id) || delivery.attempts >= MAX_ATTEMPTS) {
        if (key === 'test') record.lastTestResult = { outcome: 'expired', at: now };
        this.finish(record, key, now);
        continue;
      }
      // Persist the attempt and a recovery alarm before leaving storage for I/O.
      // A crash can repeat the same ID, never allocate a new logical reminder.
      delivery.attempts += 1;
      delivery.attemptAt = now + 30_000;
      await this.persist(record);
      let outcome: Awaited<ReturnType<typeof sendPush>>;
      let httpStatus: number | undefined;
      let failure: 'prepare' | 'network' | undefined;
      try { outcome = await sendPush(record.subscription, delivery, this.env, now, status => { httpStatus = status; }, stage => { failure = stage; }); }
      catch { outcome = 'retry'; }
      if (outcome === 'gone') { await this.clear(); return; }
      const completedAt = Date.now();
      const retryAt = completedAt + (delivery.attempts === 1 ? 15_000 : 60_000);
      if (outcome === 'retry' && delivery.attempts < MAX_ATTEMPTS && retryAt < delivery.expiresAt) {
        delivery.attemptAt = retryAt;
      } else {
        if (key === 'test') record.lastTestResult = { outcome, at: completedAt, ...(httpStatus ? { httpStatus } : {}), ...(failure ? { failure } : {}) };
        this.finish(record, key, completedAt);
      }
      await this.persist(record);
    }
    await this.persist(record);
  }
}
