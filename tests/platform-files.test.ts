import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(directory, entry.name)) : [join(directory, entry.name)]);
}

// Metro tries every platform variant of one extension before the next extension, so
// widget.ts would win over widget.android.tsx. A platform file and its fallback must share one.
test('platform-specific modules use the same extension as their fallback', () => {
  const all = files(resolve(__dirname, '../src'));
  const variants = all.filter((file) => /\.(android|ios|web|native)\.(ts|tsx)$/.test(file));
  assert.ok(variants.length >= 5);
  for (const variant of variants) {
    const match = /^(.*)\.(android|ios|web|native)\.(ts|tsx)$/.exec(variant)!;
    const base = match[1]!;
    const fallbacks = all.filter((file) => file === `${base}.ts` || file === `${base}.tsx`);
    assert.equal(fallbacks.length, 1, `${variant} needs exactly one fallback`);
    assert.ok(fallbacks[0]!.endsWith(`.${match[3]}`), `${fallbacks[0]} must use .${match[3]} like ${variant}`);
  }
});
