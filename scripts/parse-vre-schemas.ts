import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type {
  SchemaGame,
  SchemaGameInfo,
  SchemaFieldType,
  SchemaMeta,
  SchemaBundle,
  SchemaClass,
  SchemaEnum,
  SchemaEnumMember,
  SchemaField,
} from '../src/types.js';
import { renderSchemaType } from '../src/vre/render.js';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const FETCH_DIR = resolve(PROJECT_ROOT, 'data/fetched/vre-schemas');
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'data/generated');

const GAMES: readonly SchemaGame[] = ['cs2', 'dota2', 'deadlock'];

// Truncate long KV3 metadata values (e.g. MGetKV3ClassDefaults) to bound size.
const META_VALUE_MAX = 200;

// --- Raw (untyped) shapes from the SchemaExplorer JSON ---
interface RawMeta {
  name: string;
  value?: string;
}
interface RawType {
  category: string;
  name?: string;
  module?: string;
  inner?: RawType;
  count?: number;
}
interface RawField {
  name: string;
  offset: number;
  type: RawType;
  metadata?: RawMeta[];
}
interface RawParent {
  module: string;
  name: string;
}
interface RawClass {
  name: string;
  module: string;
  size: number;
  parents?: RawParent[];
  fields?: RawField[];
  metadata?: RawMeta[];
}
interface RawEnumMember {
  name: string;
  value: number;
  metadata?: RawMeta[];
}
interface RawEnum {
  name: string;
  module: string;
  alignment: string;
  members: RawEnumMember[];
  metadata?: RawMeta[];
}
interface RawFile {
  revision: string;
  version_date: string;
  version_time: string;
  classes: RawClass[];
  enums: RawEnum[];
}

function trimMeta(meta: RawMeta[] | undefined): SchemaMeta[] | undefined {
  if (!meta || meta.length === 0) return undefined;
  return meta.map((m) => ({
    name: m.name,
    value:
      m.value != null
        ? m.value.length > META_VALUE_MAX
          ? m.value.slice(0, META_VALUE_MAX) + '…'
          : m.value
        : undefined,
  }));
}

// Coerce the loosely-typed raw type tree into our discriminated union,
// degrading gracefully on anything unexpected.
function coerceType(t: RawType): SchemaFieldType {
  switch (t.category) {
    case 'builtin':
      return { category: 'builtin', name: t.name ?? 'unknown' };
    case 'declared_class':
      return {
        category: 'declared_class',
        module: t.module ?? '',
        name: t.name ?? 'unknown',
      };
    case 'declared_enum':
      return {
        category: 'declared_enum',
        module: t.module ?? '',
        name: t.name ?? 'unknown',
      };
    case 'atomic':
      return {
        category: 'atomic',
        name: t.name ?? 'unknown',
        inner: t.inner ? coerceType(t.inner) : undefined,
      };
    case 'ptr':
      return t.inner
        ? { category: 'ptr', inner: coerceType(t.inner) }
        : { category: 'builtin', name: 'void*' };
    case 'fixed_array':
      return t.inner
        ? {
            category: 'fixed_array',
            count: t.count ?? 0,
            inner: coerceType(t.inner),
          }
        : { category: 'builtin', name: 'unknown' };
    case 'bitfield':
      return { category: 'bitfield', count: t.count ?? 0 };
    default:
      return { category: 'builtin', name: t.name ?? `unknown_${t.category}` };
  }
}

async function main(): Promise<void> {
  console.log('Parsing VRE schemas from:', FETCH_DIR);

  const classes: Record<string, SchemaClass> = {};
  const enums: Record<string, SchemaEnum> = {};
  const games = {} as Record<SchemaGame, SchemaGameInfo>;

  for (const game of GAMES) {
    const filePath = resolve(FETCH_DIR, `${game}.json`);
    let raw: string;
    try {
      raw = await readFile(filePath, 'utf-8');
    } catch {
      console.warn(`  Missing ${game}.json — skipping game`);
      continue;
    }
    const data = JSON.parse(raw) as RawFile;
    const versionDate = `${data.version_date ?? ''} ${data.version_time ?? ''}`.trim();

    // Dedup classes by (module, name); duplicates are byte-identical.
    let gameClasses = 0;
    let classDup = 0;
    for (const c of data.classes ?? []) {
      const uid = `${game}/${c.module}/${c.name}`;
      if (classes[uid]) {
        classDup++;
        continue;
      }
      const fields: SchemaField[] = (c.fields ?? []).map((f) => {
        const type = coerceType(f.type);
        return {
          name: f.name,
          offset: f.offset,
          type,
          renderedType: renderSchemaType(type),
          metadata: trimMeta(f.metadata),
        };
      });
      classes[uid] = {
        uid,
        game,
        name: c.name,
        module: c.module,
        size: c.size,
        parents: c.parents ?? [],
        fields,
        metadata: trimMeta(c.metadata),
      };
      gameClasses++;
    }

    // Dedup enums by (module, name)
    let gameEnums = 0;
    let enumDup = 0;
    for (const e of data.enums ?? []) {
      const uid = `${game}/${e.module}/${e.name}`;
      if (enums[uid]) {
        enumDup++;
        continue;
      }
      const members: SchemaEnumMember[] = (e.members ?? []).map((m) => ({
        name: m.name,
        value: m.value,
        metadata: trimMeta(m.metadata),
      }));
      enums[uid] = {
        uid,
        game,
        name: e.name,
        module: e.module,
        alignment: e.alignment,
        members,
        metadata: trimMeta(e.metadata),
      };
      gameEnums++;
    }

    games[game] = {
      revision: String(data.revision ?? ''),
      versionDate,
      classes: gameClasses,
      enums: gameEnums,
    };
    console.log(
      `  ${game}: revision ${games[game].revision || '?'} (${versionDate}) — ${gameClasses} classes (${classDup} dup), ${gameEnums} enums (${enumDup} dup)`,
    );
  }

  const bundle: SchemaBundle = {
    generatedAt: new Date().toISOString(),
    games,
    classes,
    enums,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    join(OUTPUT_DIR, 'vre-schemas.json'),
    JSON.stringify(bundle, null, 2),
  );

  const fieldCount = Object.values(classes).reduce(
    (a, c) => a + c.fields.length,
    0,
  );
  console.log(
    `\nParsed ${Object.keys(classes).length} VRE classes (${fieldCount} fields), ${Object.keys(enums).length} enums`,
  );
  console.log('Output written to:', OUTPUT_DIR);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
