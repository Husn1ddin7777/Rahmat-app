import { MAX_BACKUP_CHARS } from '../domain/backup';

export type SaveTarget = 'folder' | 'share';

function canShareFiles(): boolean {
  try {
    const probe = new File(['{}'], 'rahmat.json', { type: 'application/json' });
    return typeof navigator.share === 'function' && !!navigator.canShare?.({ files: [probe] });
  } catch { return false; }
}

/** Download is always offered; a share sheet too where the browser can share files. */
export const SAVE_TARGETS: readonly SaveTarget[] = canShareFiles() ? ['folder', 'share'] : ['folder'];

export function secureRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/** Must run straight from a tap: browsers allow downloads and sharing only then. */
export async function saveBackup(name: string, text: string, target: SaveTarget): Promise<boolean> {
  const blob = new Blob([text], { type: 'application/json' });
  if (target === 'share') {
    try {
      await navigator.share({ files: [new File([blob], name, { type: 'application/json' })], title: 'Rahmat zaxirasi' });
      return true;
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return false;
      throw new Error('Ulashib bo‘lmadi. «Yuklab olish»ni tanlang.');
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

/** Opens the browser's file chooser. Resolves null if the user closes it. */
export function pickBackupText(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json,text/plain';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      if (file.size > MAX_BACKUP_CHARS) { reject(new Error('Fayl juda katta — bu Rahmat zaxirasi emas.')); return; }
      file.text().then(resolve, () => reject(new Error('Faylni o‘qib bo‘lmadi.')));
    });
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
