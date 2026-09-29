import type { Env } from './types';
import { ApiError, deviceName, json, vapidConfiguration } from './validation';
export { ReminderDevice } from './device';

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      // API calls are same-origin. We never reflect arbitrary origins into CORS.
      const origin = request.headers.get('Origin');
      if ((origin && origin !== url.origin) || request.headers.get('Sec-Fetch-Site') === 'cross-site') {
        throw new ApiError(403, 'Bu manzildan so‘rovga ruxsat yo‘q.');
      }
      if (url.pathname === '/api/push/config' && request.method === 'GET') {
        return json({ publicKey: vapidConfiguration(env).publicKey });
      }
      const subscriptionRequest = url.pathname === '/api/push/subscription' && ['PUT', 'DELETE'].includes(request.method);
      const testRequest = url.pathname === '/api/push/test' && request.method === 'POST';
      const statusRequest = url.pathname === '/api/push/status' && request.method === 'GET';
      if (!subscriptionRequest && !testRequest && !statusRequest) return json({ error: 'Manzil topilmadi.' }, 404);
      const name = await deviceName(request);
      if (request.method !== 'DELETE') vapidConfiguration(env);
      const stub = env.DEVICES.get(env.DEVICES.idFromName(name));
      // The raw bearer credential never crosses into persisted object state.
      const internal = new Request(request);
      internal.headers.delete('Authorization');
      return await stub.fetch(internal);
    } catch (error) {
      return error instanceof ApiError
        ? json({ error: error.message }, error.status)
        : json({ error: 'Bildirishnoma xizmati vaqtincha ishlamayapti.' }, 503);
    }
  },
};
