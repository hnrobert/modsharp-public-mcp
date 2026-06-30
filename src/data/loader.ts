import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type {
  ApiTypeInfo,
  NamespaceInfo,
  DocArticle,
  CodeExample,
  SchemaClass,
  EntityClass,
  TocNode,
  VreSchemaBundle,
  VreGame,
  VreGameInfo,
  VreSchemaClass,
  VreSchemaEnum,
  LoadedData,
} from '../types.js';
import { PATHS } from '../constants.js';

const DATA_DIR = PATHS.generated;

async function readJson<T>(filename: string): Promise<T> {
  const raw = await readFile(resolve(DATA_DIR, filename), 'utf-8');
  return JSON.parse(raw) as T;
}

export async function loadData(): Promise<LoadedData> {
  const [
    apiTypes,
    apiIndex,
    docsEn,
    docsCn,
    examples,
    schemasRaw,
    entitiesRaw,
    searchIndexRaw,
    toc,
    vreBundle,
  ] = await Promise.all([
    readJson<Record<string, ApiTypeInfo>>('api-types.json'),
    readJson<{ namespaces: Record<string, NamespaceInfo> }>('api-index.json'),
    readJson<DocArticle[]>('docs-en.json'),
    readJson<DocArticle[]>('docs-cn.json'),
    readJson<CodeExample[]>('examples.json'),
    readJson<Record<string, SchemaClass>>('schemas.json'),
    readJson<Record<string, EntityClass>>('entities.json').catch(() => ({})),
    readJson<{ tokens: Record<string, string[]> }>('search-index.json'),
    readJson<TocNode[]>('toc.json'),
    readJson<VreSchemaBundle>('vre-schemas.json').catch(() => null),
  ]);

  // Convert records to Maps for O(1) lookup
  const types = new Map<string, ApiTypeInfo>(Object.entries(apiTypes));
  const namespaces = new Map<string, NamespaceInfo>(
    Object.entries(apiIndex.namespaces),
  );
  const examplesMap = new Map<string, CodeExample>(
    examples.map((e) => [e.id, e]),
  );
  const schemas = new Map<string, SchemaClass>(Object.entries(schemasRaw));
  const entities = new Map<string, EntityClass>(Object.entries(entitiesRaw));
  const searchIndex = new Map<string, string[]>(
    Object.entries(searchIndexRaw.tokens),
  );

  // Build methods index: method name -> type UIDs
  const methodsIndex = new Map<string, string[]>();
  for (const [uid, type] of types) {
    for (const member of type.members) {
      if (member.kind === 'method') {
        const key = member.name.toLowerCase();
        const existing = methodsIndex.get(key);
        if (existing) {
          existing.push(uid);
        } else {
          methodsIndex.set(key, [uid]);
        }
      }
    }
  }

  // VRE schemas (ValveResourceFormat) — optional, loaded per-game
  const vreSchemas = new Map<string, VreSchemaClass>(
    vreBundle ? Object.entries(vreBundle.classes) : [],
  );
  const vreEnums = new Map<string, VreSchemaEnum>(
    vreBundle ? Object.entries(vreBundle.enums) : [],
  );
  const vreSchemasByGame = new Map<VreGame, string[]>([
    ['cs2', []],
    ['dota2', []],
    ['deadlock', []],
  ]);
  const vreEnumsByGame = new Map<VreGame, string[]>([
    ['cs2', []],
    ['dota2', []],
    ['deadlock', []],
  ]);
  for (const [uid, cls] of vreSchemas) vreSchemasByGame.get(cls.game)!.push(uid);
  for (const [uid, en] of vreEnums) vreEnumsByGame.get(en.game)!.push(uid);
  const vreGames = vreBundle
    ? vreBundle.games
    : ({} as Record<VreGame, VreGameInfo>);

  return {
    types,
    namespaces,
    docsEn,
    docsCn,
    examples: examplesMap,
    schemas,
    entities,
    searchIndex,
    toc,
    methodsIndex,
    vreSchemas,
    vreEnums,
    vreSchemasByGame,
    vreEnumsByGame,
    vreGames,
  };
}
