import { buildPushPayload } from '@block65/webcrypto-web-push';
import type { BrowserSubscription, Delivery, Env, PushOutcome } from './types';
import { validateEndpoint, vapidConfiguration } from './validation';

export async function sendPush(
  subscription: BrowserSubscription,
  delivery: Delivery,
  env: Env,
  now = Date.now(),
  onResponse?: (httpStatus: number) => void,
  onFailure?: (stage: 'prepare' | 'network') => void,
): Promise<PushOutcome> {
  // Recheck on send as persisted subscriptions may predate a validation change.
  const endpoint = validateEndpoint(subscription.endpoint);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(delivery.notice.id)));
  const topic = btoa(String.fromCharCode(...digest)).replace(/\+/g, '-').replace(/\//g, '_').slice(0, 32);
  let payload: Awaited<ReturnType<typeof buildPushPayload>>;
  try {
    payload = await buildPushPayload({
      data: delivery.notice,
      options: { ttl: Math.max(1, Math.ceil((delivery.expiresAt - now) / 1000)), urgency: 'high', topic },
    }, subscription, vapidConfiguration(env));
  } catch (error) { onFailure?.('prepare'); throw error; }
  let response: Response;
  try {
    response = await fetch(endpoint, {
      // Workers supports follow/manual, not the browser-only error value.
      // Manual keeps the subscription credential on the validated push host;
      // every 3xx response is rejected below without following Location.
      ...payload, redirect: 'manual', signal: AbortSignal.timeout(10_000),
    });
  } catch (error) { onFailure?.('network'); throw error; }
  onResponse?.(response.status);
  // Never log the endpoint, response body, subscription keys or device credential.
  if (response.ok) return 'sent';
  if (response.status === 404 || response.status === 410) return 'gone';
  if (response.status === 408 || response.status === 429 || response.status >= 500) return 'retry';
  return 'rejected';
}
