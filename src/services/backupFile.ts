import { Directory, File, Paths } from 'expo-file-system';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { getRandomBytes } from 'expo-crypto';
import { MAX_BACKUP_CHARS } from '../domain/backup';

export type SaveTarget = 'folder' | 'share';
export const SAVE_TARGETS: readonly SaveTarget[] = ['folder', 'share'];

/** The phone's own secure random source for the salt and nonce. */
export function secureRandomBytes(length: number): Uint8Array {
  return getRandomBytes(length);
}

function cancelled(error: unknown): boolean {
  return error instanceof Error && /cancel/i.test(`${error.name} ${error.message}`);
}

/**
 * Writes the sealed backup where the user chooses: into a folder they pick
 * (Downloads, a memory card…) or through the share sheet (Telegram, Drive…).
 * Returns false when the user closes the picker.
 */
export async function saveBackup(name: string, text: string, target: SaveTarget): Promise<boolean> {
  if (target === 'folder') {
    let folder: Directory;
    try { folder = await Directory.pickDirectoryAsync(); } catch (error) { if (cancelled(error)) return false; throw error; }
    if (!folder) return false;
    const file = folder.createFile(name, 'application/json');
    file.write(text);
    return true;
  }
  if (!await Sharing.isAvailableAsync()) throw new Error('Bu telefonda ulashish oynasi mavjud emas. «Papkaga saqlash»ni tanlang.');
  // Only the sealed file is ever written here, in the app's private cache.
  for (const item of new Directory(Paths.cache).list()) {
    if (item instanceof File && /^rahmat-zaxira-.*\.json$/.test(item.name)) { try { item.delete(); } catch { /* best effort */ } }
  }
  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(text);
  await Sharing.shareAsync(file.uri, { mimeType: 'application/json', dialogTitle: 'Rahmat zaxirasi', UTI: 'public.json' });
  return true;
}

/** Lets the user choose a backup file. Returns null when nothing was chosen. */
export async function pickBackupText(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true, multiple: false });
  const asset = result.canceled ? undefined : result.assets?.[0];
  if (!asset) return null;
  if (asset.size && asset.size > MAX_BACKUP_CHARS) throw new Error('Fayl juda katta — bu Rahmat zaxirasi emas.');
  const file = new File(asset.uri);
  try {
    return await file.text();
  } finally {
    // The picker's private copy is not kept after reading.
    try { file.delete(); } catch { /* already gone */ }
  }
}
