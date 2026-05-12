// scripts/merge-types.mjs
// supabase auto-gen (.gen) + hand-written extensions → database.ts
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const GEN = resolve(ROOT, 'src/types/database.ts.gen');
const EXT = resolve(ROOT, 'src/types/database-extensions.ts');
const OUT = resolve(ROOT, 'src/types/database.ts');

if (!existsSync(GEN)) {
  console.error(`[merge-types] missing ${GEN}`);
  console.error(`             run: supabase gen types typescript --project-id <ID> --schema public > src/types/database.ts.gen`);
  process.exit(1);
}
if (!existsSync(EXT)) {
  console.error(`[merge-types] missing ${EXT}`);
  process.exit(1);
}

const gen = readFileSync(GEN, 'utf8');
const ext = readFileSync(EXT, 'utf8');

const merged =
  gen.trimEnd() +
  '\n\n// ===== Hand-written extensions (preserved across gen) =====\n' +
  '// Source: src/types/database-extensions.ts — edit there, never edit database.ts directly.\n' +
  ext.trimEnd() +
  '\n';

writeFileSync(OUT, merged, 'utf8');
unlinkSync(GEN);

const lines = merged.split('\n').length;
console.log(`[merge-types] merged: gen + extensions → ${OUT} (${lines} lines)`);
