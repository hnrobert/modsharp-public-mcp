import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type {
  ApiTypeInfo,
  NamespaceInfo,
  DocArticle,
  CodeExample,
  SchemaClass,
  TocNode,
  LoadedData,
} from "../types.js";
import { PATHS } from "../constants.js";

const DATA_DIR = PATHS.generated;

async function readJson<T>(filename: string): Promise<T> {
  const raw = await readFile(resolve(DATA_DIR, filename), "utf-8");
  return JSON.parse(raw) as T;
}

export async function loadData(): Promise<LoadedData> {
  const [apiTypes, apiIndex, docsEn, docsCn, examples, schemasRaw, searchIndexRaw, toc] =
    await Promise.all([
      readJson<Record<string, ApiTypeInfo>>("api-types.json"),
      readJson<{ namespaces: Record<string, NamespaceInfo> }>("api-index.json"),
      readJson<DocArticle[]>("docs-en.json"),
      readJson<DocArticle[]>("docs-cn.json"),
      readJson<CodeExample[]>("examples.json"),
      readJson<Record<string, SchemaClass>>("schemas.json"),
      readJson<{ tokens: Record<string, string[]> }>("search-index.json"),
      readJson<TocNode[]>("toc.json"),
    ]);

  // Convert records to Maps for O(1) lookup
  const types = new Map<string, ApiTypeInfo>(Object.entries(apiTypes));
  const namespaces = new Map<string, NamespaceInfo>(
    Object.entries(apiIndex.namespaces)
  );
  const examplesMap = new Map<string, CodeExample>(
    examples.map((e) => [e.id, e])
  );
  const schemas = new Map<string, SchemaClass>(Object.entries(schemasRaw));
  const searchIndex = new Map<string, string[]>(
    Object.entries(searchIndexRaw.tokens)
  );

  // Build methods index: method name -> type UIDs
  const methodsIndex = new Map<string, string[]>();
  for (const [uid, type] of types) {
    for (const member of type.members) {
      if (member.kind === "method") {
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

  return {
    types,
    namespaces,
    docsEn,
    docsCn,
    examples: examplesMap,
    schemas,
    searchIndex,
    toc,
    methodsIndex,
  };
}
