/**
 * Uzbek Latin → Uzbek Cyrillic for the app's own wording and reviewed content.
 * Text the user wrote is never passed through here: it stays exactly as typed.
 * Arabic, digits, punctuation, links and a few brand names are left unchanged.
 */
export type Script = 'latin' | 'cyrillic';
export const SCRIPTS: readonly Script[] = ['latin', 'cyrillic'];

const LETTERS: Record<string, string> = {
  a: 'а', b: 'б', c: 'с', d: 'д', e: 'е', f: 'ф', g: 'г', h: 'ҳ', i: 'и', j: 'ж', k: 'к', l: 'л', m: 'м',
  n: 'н', o: 'о', p: 'п', q: 'қ', r: 'р', s: 'с', t: 'т', u: 'у', v: 'в', w: 'в', x: 'х', y: 'й', z: 'з',
};
const AFTER_Y: Record<string, string> = { a: 'я', e: 'е', o: 'ё', u: 'ю' };
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u']);
// o‘ and g‘ are written with several look-alike marks; the tutuq belgisi (’) too.
const MARKS = new Set(['‘', '’', 'ʻ', 'ʼ', '\'', '`', '´']);

/** Loanwords whose Cyrillic spelling keeps a soft sign. Whole words only. */
const WORDS: Record<string, string> = {
  yanvar: 'январь', fevral: 'февраль', aprel: 'апрель', iyun: 'июнь', iyul: 'июль',
  sentabr: 'сентябрь', oktabr: 'октябрь', noyabr: 'ноябрь', dekabr: 'декабрь',
};
/** Short weekday labels whose letters alone would read oddly in Cyrillic (exact case). */
const ABBREVIATIONS: Record<string, string> = { Ch: 'Чо', Sh: 'Ша', Ya: 'Як' };
/** Names that stay in Latin letters in a Cyrillic interface. */
const KEEP = ['iPhone', 'iOS', 'Android', 'Safari', 'Chrome', 'Google Drive', 'Google', 'Telegram', 'Face ID', 'HTTPS', 'PIN', 'APK', 'Focus', 'GitHub', 'Wi-Fi'];

function isLatin(char: string | undefined): boolean {
  return !!char && /[A-Za-z]/.test(char);
}
function isLetter(char: string | undefined): boolean {
  return !!char && /\p{L}/u.test(char);
}
function isDigit(char: string | undefined): boolean {
  return !!char && /[0-9]/.test(char);
}
function upper(char: string): boolean {
  return char !== char.toLowerCase();
}
function withCase(source: string, cyrillic: string, wholeUpper: boolean): string {
  if (wholeUpper) return cyrillic.toUpperCase();
  return upper(source) ? cyrillic.charAt(0).toUpperCase() + cyrillic.slice(1) : cyrillic;
}

/** The maximal run of letters and in-word marks starting at `index`. */
function wordAt(text: string, index: number): string {
  let end = index;
  while (end < text.length && (isLetter(text[end]) || (MARKS.has(text[end]!) && isLetter(text[end - 1]) && isLetter(text[end + 1])))) end += 1;
  return text.slice(index, end);
}

/** A link, e-mail or file name is copied as it is. */
function tokenAt(text: string, index: number): string {
  let end = index;
  while (end < text.length && !/\s/.test(text[end]!)) end += 1;
  return text.slice(index, end);
}
function looksLikeLink(token: string): boolean {
  return /:\/\/|^www\.|@|\.(com|org|uz|json|apk|png|m4a|mp3)\b/i.test(token);
}

function convert(text: string): string {
  let out = '';
  let index = 0;
  while (index < text.length) {
    const char = text[index]!;
    const previous = text[index - 1];
    const atWordStart = !isLetter(previous) && !MARKS.has(previous ?? '');

    if (!isLetter(previous) && !/\s/.test(char)) {
      const token = tokenAt(text, index);
      if (looksLikeLink(token)) { out += token; index += token.length; continue; }
    }
    if (atWordStart && isLatin(char)) {
      const kept = KEEP.find((name) => text.startsWith(name, index) && !isLetter(text[index + name.length]));
      if (kept) { out += kept; index += kept.length; continue; }
      const word = wordAt(text, index);
      const exact = ABBREVIATIONS[word];
      if (exact) { out += exact; index += word.length; continue; }
      const known = WORDS[word.toLowerCase()];
      if (known) { out += withCase(word, known, word.length > 1 && word === word.toUpperCase()); index += word.length; continue; }
    }
    // Hadith variant letters (597a, 1162b) are part of a reference, not a word.
    if (isLatin(char) && isDigit(previous)) {
      const word = wordAt(text, index);
      out += word; index += word.length; continue;
    }
    if (!isLatin(char)) {
      if (MARKS.has(char) && isLetter(previous) && isLetter(text[index + 1])) {
        // s’h separates two sounds (Is’hoq → Исҳоқ); elsewhere the mark is the tutuq belgisi.
        const separator = previous?.toLowerCase() === 's' && text[index + 1]?.toLowerCase() === 'h';
        out += separator ? '' : (upper(text[index + 1]!) && upper(previous!) ? 'Ъ' : 'ъ');
      } else {
        out += char;
      }
      index += 1;
      continue;
    }

    const lower = char.toLowerCase();
    const next = text[index + 1];
    const nextLower = next?.toLowerCase();
    // A digraph takes the case of its first letter: Sh and SH → Ш.
    const digraph = (cyrillic: string, length: number) => {
      out += upper(char) ? cyrillic.toUpperCase() : cyrillic;
      index += length;
    };

    if ((lower === 'o' || lower === 'g') && next !== undefined && MARKS.has(next)) { digraph(lower === 'o' ? 'ў' : 'ғ', 2); continue; }
    if (lower === 's' && nextLower === 'h') { digraph('ш', 2); continue; }
    if (lower === 'c' && nextLower === 'h') { digraph('ч', 2); continue; }
    if (lower === 'y' && nextLower !== undefined && AFTER_Y[nextLower]) {
      // yo‘l → йўл: the y belongs to й when the o is part of ў.
      const afterNext = text[index + 2];
      if (!(nextLower === 'o' && afterNext !== undefined && MARKS.has(afterNext))) { digraph(AFTER_Y[nextLower]!, 2); continue; }
    }
    if (lower === 'e') {
      // э begins a word (ertaga → эртага) and follows a vowel (poema → поэма).
      const afterVowel = previous !== undefined && VOWELS.has(previous.toLowerCase());
      out += (atWordStart || afterVowel) ? (upper(char) ? 'Э' : 'э') : (upper(char) ? 'Е' : 'е');
      index += 1;
      continue;
    }
    const mapped = LETTERS[lower]!;
    out += upper(char) ? mapped.toUpperCase() : mapped;
    index += 1;
  }
  return out;
}

const cache = new Map<string, string>();

export function toCyrillic(text: string): string {
  const hit = cache.get(text);
  if (hit !== undefined) return hit;
  const result = convert(text);
  if (cache.size >= 2000) cache.clear();
  cache.set(text, result);
  return result;
}

export function toScript(text: string, script: Script | undefined): string {
  return script === 'cyrillic' ? toCyrillic(text) : text;
}

export function isScript(value: unknown): value is Script {
  return value === 'latin' || value === 'cyrillic';
}
