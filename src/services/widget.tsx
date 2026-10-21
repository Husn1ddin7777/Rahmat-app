// Same extension as widget.android.tsx: Metro tries every platform variant of one extension before the next extension.
import type { AppState } from '../domain/model';

/** The home-screen widget exists on Android only; elsewhere these do nothing. */
export function registerWidget(): void {}

export async function updateWidget(_state: AppState): Promise<void> {}

export async function clearWidget(): Promise<void> {}
