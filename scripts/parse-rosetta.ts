import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { RosettaBundle } from '../src/types.js';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const FETCH_FILE = resolve(PROJECT_ROOT, 'data/fetched/rosetta/rosetta-cs2.json');
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'data/generated');

// Raw shape of kamal/source2rosetta's rosetta-cs2.json (rolling release,
// build 25000182+). We keep entries verbatim — only re-shaping dicts into
// arrays where search iterates — so upstream field additions survive.
//
// The `schema` section is deliberately NOT emitted: it duplicates the Valve
// engine schemas already served by parse-vre-schemas (single source of truth).
interface RawRosetta {
  meta: {
    game_key?: string;
    game?: string;
    source_build?: string;
    version?: string;
    counts?: Record<string, number>;
    [k: string]: unknown;
  };
  functions?: Record<string, Record<string, unknown>>;
  unresolved?: Record<string, { reason?: string; detail?: string }>;
  schema?: unknown;
  surfaces?: {
    pulse?: Record<string, Record<string, unknown>>;
    entity_outputs?: Array<Record<string, unknown>>;
    entity_classes?: Record<string, string>;
    convars?: Array<Record<string, unknown>>;
    unjoined?: {
      entity_inputs?: Array<Record<string, unknown>>;
      commands?: Array<Record<string, unknown>>;
      vscript?: Array<Record<string, unknown>>;
    };
  };
}

function dictToArray<T extends Record<string, unknown>>(
  dict: Record<string, T> | undefined,
): Array<T & { name: string }> {
  if (!dict) return [];
  return Object.entries(dict).map(([name, value]) => ({ name, ...value }));
}

async function main(): Promise<void> {
  console.log('Parsing Rosetta signatures from:', FETCH_FILE);

  let raw: string;
  try {
    raw = await readFile(FETCH_FILE, 'utf-8');
  } catch {
    throw new Error(
      'rosetta-cs2.json not found — run `pnpm run fetch` first. ' +
        '(Source: https://git.lo.sh/kamal/source2rosetta releases, cs2-latest.)',
    );
  }

  const data = JSON.parse(raw) as RawRosetta;
  const build = data.meta?.source_build;
  if (!build) {
    throw new Error('rosetta-cs2.json is missing meta.source_build — refusing to emit');
  }

  const surfaces = data.surfaces ?? {};
  const unjoined = surfaces.unjoined ?? {};

  const bundle: RosettaBundle = {
    meta: {
      build,
      version: data.meta?.version,
      game: data.meta?.game,
      counts: {
        ...(data.meta?.counts ?? {}),
        functions: Object.keys(data.functions ?? {}).length,
        convars: (surfaces.convars ?? []).length,
        entityInputs: (unjoined.entity_inputs ?? []).length,
        entityOutputs: (surfaces.entity_outputs ?? []).length,
        pulse: Object.keys(surfaces.pulse ?? {}).length,
        commands: (unjoined.commands ?? []).length,
        vscript: (unjoined.vscript ?? []).length,
        unresolved: Object.keys(data.unresolved ?? {}).length,
      },
      generatedAt: new Date().toISOString(),
    },
    functions: dictToArray(data.functions) as RosettaBundle['functions'],
    convars: (surfaces.convars ?? []).map((c) => ({ ...c })) as RosettaBundle['convars'],
    entityInputs: (unjoined.entity_inputs ?? []).map((e) => ({ ...e })) as RosettaBundle['entityInputs'],
    entityOutputs: (surfaces.entity_outputs ?? []).map((e) => ({ ...e })) as RosettaBundle['entityOutputs'],
    entityClasses: surfaces.entity_classes ?? {},
    pulse: dictToArray(surfaces.pulse),
    commands: (unjoined.commands ?? []).map((c) => ({ ...c })) as RosettaBundle['commands'],
    vscript: (unjoined.vscript ?? []).map((c) => ({ ...c })) as RosettaBundle['vscript'],
    unresolved: Object.entries(data.unresolved ?? {}).map(([name, v]) => ({
      name,
      reason: v?.reason,
      detail: v?.detail,
    })),
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    resolve(OUTPUT_DIR, 'rosetta.json'),
    JSON.stringify(bundle, null, 2),
  );

  const c = bundle.meta.counts;
  console.log(
    `\nParsed ${c.functions} signatures, ${c.convars} convars, ` +
      `${c.entityOutputs} entity outputs, ${c.entityInputs} unjoined entity inputs, ` +
      `${c.pulse} pulse surfaces (build ${build})`,
  );
  console.log('Output written to:', OUTPUT_DIR);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
