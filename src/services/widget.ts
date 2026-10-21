import type { AppState } from '../domain/model';

/** The home-screen widget exists on Android only; elsewhere these do nothing. */
export function registerWidget(): void {}

export async function updateWidget(_state: AppState): Promise<void> {}

export async function clearWidget(): Promise<void> {}
