export type PwaState = { installed: boolean; ios: boolean; supported: boolean; secure: boolean };
export function getPwaState(): PwaState {
  if (typeof window === 'undefined') return { installed: false, ios: false, supported: false, secure: false };
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const installed = window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return { ios, installed, secure: window.isSecureContext, supported: 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window };
}
export async function preparePwa(): Promise<void> {
  if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && window.isSecureContext) {
    await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
  }
}
