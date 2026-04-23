import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import type { EntityClass, EntityProperty, EntityInputOutput, SchemaClass } from '../src/types.js';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'data/generated');
const CACHE_DIR = resolve(PROJECT_ROOT, 'data/fetched/entities');

interface WikiEntityDetail {
  Name: string;
  Pages: WikiPage[];
}

interface WikiPage {
  Game: string;
  EntityType: string;
  Name: string;
  Description: string;
  Properties: Array<{
    FriendlyName: string;
    InternalName: string;
    VariableType: string;
    Description: string;
    Options: Array<{ Name: string; Key: string; Description?: string }>;
  }>;
  InputOutputs: Array<{
    Name: string;
    Description: string;
    VariableType: string;
    Type: string;
  }>;
}

// trigger_multiple -> CTriggerMultiple
function classnameToSchemaName(classname: string): string {
  return 'C' + classname.replace(/(^|_)(\w)/g, (_, _sep, c: string) => c.toUpperCase());
}

async function main(): Promise<void> {
  console.log('Parsing Source2 entity data from cache...');

  // Read all cached entity JSONs
  let files: string[];
  try {
    files = await readdir(CACHE_DIR);
  } catch {
    console.log('No cached entity data found, writing empty entities.json');
    await mkdir(OUTPUT_DIR, { recursive: true });
    await writeFile(join(OUTPUT_DIR, 'entities.json'), '{}');
    return;
  }
  const entityFiles = files.filter((f) => f.endsWith('.json') && f !== '_index.json');
  console.log(`Found ${entityFiles.length} cached entity files`);

  const entities: Record<string, EntityClass> = {};

  for (const file of entityFiles) {
    const raw = await readFile(join(CACHE_DIR, file), 'utf-8');
    const detail = JSON.parse(raw) as WikiEntityDetail;
    if (!detail || !Array.isArray(detail.Pages)) continue;
    const pages = detail.Pages;

    // Prefer CS2 page; fallback to dota2 (shared base.fgd entities)
    const page = pages.find((p) => p.Game === 'cs2') || pages.find((p) => p.Game === 'dota2');
    if (!page) continue;

    const classname = detail.Name;

    const properties: EntityProperty[] = page.Properties.map((p) => ({
      friendlyName: p.FriendlyName,
      internalName: p.InternalName,
      variableType: p.VariableType,
      description: p.Description,
      options:
        p.Options.length > 0
          ? p.Options.map((o) => ({
              name: o.Name,
              key: o.Key,
              description: o.Description || undefined,
            }))
          : undefined,
    }));

    const inputs: EntityInputOutput[] = (page.InputOutputs || [])
      .filter((io) => io.Type === 'Input')
      .map((io) => ({
        name: io.Name,
        description: io.Description,
        variableType: io.VariableType,
        direction: 'Input' as const,
      }));

    const outputs: EntityInputOutput[] = (page.InputOutputs || [])
      .filter((io) => io.Type === 'Output')
      .map((io) => ({
        name: io.Name,
        description: io.Description,
        variableType: io.VariableType,
        direction: 'Output' as const,
      }));

    entities[classname] = {
      classname,
      entityType: page.EntityType,
      description: page.Description,
      games: pages.map((p) => p.Game),
      properties,
      inputs,
      outputs,
    };
  }
  console.log(`Filtered to ${Object.keys(entities).length} CS2 entities`);

  // Cross-reference with schemas
  let schemas: Record<string, SchemaClass> = {};
  try {
    const schemasRaw = await readFile(join(OUTPUT_DIR, 'schemas.json'), 'utf-8');
    schemas = JSON.parse(schemasRaw);
  } catch {
    console.warn('schemas.json not found, skipping cross-reference');
  }

  const schemaNameMap = new Map<string, string>();
  for (const [uid, schema] of Object.entries(schemas)) {
    schemaNameMap.set(schema.name, uid);
  }

  let linked = 0;
  for (const entity of Object.values(entities)) {
    const schemaName = classnameToSchemaName(entity.classname);
    const uid = schemaNameMap.get(schemaName);
    if (uid) {
      entity.relatedSchemaUid = uid;
      linked++;
    }
  }
  console.log(`Cross-referenced ${linked} entities to schemas`);

  // Write output
  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    join(OUTPUT_DIR, 'entities.json'),
    JSON.stringify(entities, null, 2),
  );
  console.log(`Wrote ${Object.keys(entities).length} entities to entities.json`);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
