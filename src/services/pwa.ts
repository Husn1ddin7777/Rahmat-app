export type PwaState = { installed: boolean; ios: boolean; supported: boolean; secure: boolean };
export function getPwaState(): PwaState { return { installed: true, ios: false, supported: true, secure: true }; }
export function preparePwa(): Promise<void> { return Promise.resolve(); }
