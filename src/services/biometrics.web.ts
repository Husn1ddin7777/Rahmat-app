// Browsers have no equivalent the PWA can rely on; the web version uses the PIN only.
export async function biometricsAvailable(): Promise<boolean> { return false; }
export async function unlockWithBiometrics(): Promise<boolean> { return false; }
