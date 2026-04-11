import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, basename, relative } from 'node:path';
import type { SchemaClass, SchemaField } from '../src/types.js';

const PROJECT_ROOT = resolve(import.meta.dirname, '..');
const SCHEMAS_DIR = resolve(PROJECT_ROOT, 'data/fetched/schemas');
const OUTPUT_DIR = resolve(PROJECT_ROOT, 'data/generated');

async function findFiles(dir: string, ext: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findFiles(fullPath, ext)));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      files.push(fullPath);
    }
  }
  return files;
}

function parseSchemaFile(
  filePath: string,
  content: string,
): SchemaClass | null {
  const relPath = relative(SCHEMAS_DIR, filePath).replace(/\\/g, '/');
  const category = relPath.split('/')[0]; // "server", "client", "entity2", etc.

  const lines = content.split('\n');

  // Find class declaration (opening brace may be on the same line or next line)
  let classMatchIdx = -1;
  let classParts: RegExpMatchArray | null = null;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(
      /^class\s+(\w+)(?:\s*:\s*(?:public\s+)?(\w+))?\s*\{?\s*$/,
    );
    if (m) {
      classMatchIdx = i;
      classParts = m;
      break;
    }
  }
  if (classMatchIdx === -1 || !classParts) return null;

  const className = classParts[1];
  const parentClass = classParts[2];

  // Parse class-level metadata (comments before class declaration)
  const networkVarNames = new Map<string, string>();
  const kv3Defaults: Record<string, string> = {};

  // Scan pre-class comments for MNetworkVarNames and MGetKV3ClassDefaults
  for (let i = 0; i < classMatchIdx; i++) {
    const line = lines[i].trim();
    const nvMatch = line.match(/MNetworkVarNames\s*=\s*"(.+?)\s+(\w+)"/);
    if (nvMatch) {
      networkVarNames.set(nvMatch[2], nvMatch[1]);
    }
    // KV3 defaults are complex multi-line, skip for now - capture simple ones
    const kv3Match = line.match(/MGetKV3ClassDefaults\s*=\s*\{(.+?)\}/);
    if (kv3Match) {
      const pairs = kv3Match[1].split(',').map((s) => s.trim());
      for (const pair of pairs) {
        const kv = pair.match(/"(\w+)"\s*:\s*(.+)/);
        if (kv) kv3Defaults[kv[1]] = kv[2].trim();
      }
    }
  }

  // Parse fields inside class body
  const networkFields: SchemaField[] = [];
  const localFields: SchemaField[] = [];

  // Find the opening brace (might be on class line or next line)
  let depth = 0;
  let bodyStart = classMatchIdx + 1;
  if (lines[classMatchIdx].includes('{')) {
    bodyStart = classMatchIdx + 1;
    depth = 1;
  } else if (bodyStart < lines.length && lines[bodyStart].trim() === '{') {
    bodyStart = bodyStart + 1;
    depth = 1;
  } else {
    return null; // No brace found
  }

  let currentMeta: string[] = [];

  for (let i = bodyStart; i < lines.length && depth > 0; i++) {
    const line = lines[i].trim();

    // Track brace depth
    for (const ch of line) {
      if (ch === '{') depth++;
      else if (ch === '}') depth--;
    }
    if (depth <= 0) break;

    // Collect meta comments
    if (line.startsWith('// M')) {
      currentMeta.push(line);
      continue;
    }

    // Parse field declaration
    const fieldMatch = line.match(
      /^(?:(?:static\s+|const\s+|mutable\s+)*(?:[\w:<>,\s\*]+?)\s+)(\w+)\s*(?:\[[^\]]*\])?\s*(?:=\s*.+?)?\s*;/,
    );
    if (!fieldMatch) {
      if (
        line &&
        !line.startsWith('//') &&
        !line.startsWith('}') &&
        !line.startsWith('{')
      ) {
        currentMeta = [];
      }
      continue;
    }

    const fieldName = fieldMatch[1];

    // Determine type from the declaration (rough extraction)
    const typeMatch = line.match(
      /^\s*((?:(?:static|const|mutable)\s+)*[\w:<>,]+(?:\s*\*+)?)\s+\w+/,
    );
    const fieldType = typeMatch ? typeMatch[1].trim() : 'unknown';

    // Check if this field is networked
    const isNetworked = currentMeta.some((m) => m.includes('MNetworkEnable'));
    const priorityMatch = currentMeta.find((m) =>
      m.includes('MNetworkPriority'),
    );
    const userGroupMatch = currentMeta.find(
      (m) => m.includes('MNetworkUserGroup') && !m.includes('Proxy'),
    );
    const serializerMatch = currentMeta.find((m) => m.includes('MSerializer'));
    const notSaved = currentMeta.some((m) => m.includes('MNotSaved'));

    const field: SchemaField = {
      name: fieldName,
      type: fieldType,
      isNetworked,
      networkPriority: priorityMatch
        ? Number(priorityMatch.match(/=\s*(\d+)/)?.[1])
        : undefined,
      networkUserGroup: userGroupMatch?.match(/=\s*"(\w+)"/)?.[1],
      serializer: serializerMatch?.match(/=\s*"(\w+)"/)?.[1],
      notSaved: notSaved || undefined,
    };

    if (isNetworked) {
      networkFields.push(field);
    } else {
      localFields.push(field);
    }

    currentMeta = [];
  }

  // Only include classes with meaningful content
  if (networkFields.length === 0 && localFields.length === 0) return null;

  return {
    uid: `${category}/${className}`,
    name: className,
    parent: parentClass,
    category,
    sourceFile: relPath,
    networkVars: networkFields,
    localFields: localFields,
    kv3Defaults: Object.keys(kv3Defaults).length > 0 ? kv3Defaults : undefined,
  };
}

async function main(): Promise<void> {
  console.log('Parsing CS2 schema files from:', SCHEMAS_DIR);

  const files = await findFiles(SCHEMAS_DIR, '.h');
  console.log(`Found ${files.length} schema files`);

  const schemas: Record<string, SchemaClass> = {};
  let classCount = 0;
  let networkFieldCount = 0;
  const categoryCounts: Record<string, number> = {};

  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    const schema = parseSchemaFile(file, content);
    if (!schema) continue;

    schemas[schema.uid] = schema;
    classCount++;
    networkFieldCount += schema.networkVars.length;
    categoryCounts[schema.category] =
      (categoryCounts[schema.category] || 0) + 1;
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(
    join(OUTPUT_DIR, 'schemas.json'),
    JSON.stringify(schemas, null, 2),
  );

  console.log(`\nParsed ${classCount} schema classes`);
  console.log(`Network fields: ${networkFieldCount}`);
  console.log('Categories:', categoryCounts);
  console.log('Output written to:', OUTPUT_DIR);
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
