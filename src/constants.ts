import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// In dev: __dirname is src/ -> ../  (project root)
// In dist: __dirname is dist/ -> ../  (project root)
export const PROJECT_ROOT = resolve(__dirname, '..');

declare const PKG_NAME: string;
declare const PKG_VERSION: string;

export const SERVER_NAME: string = PKG_NAME;
export const SERVER_VERSION: string = PKG_VERSION;

export const SERVER_INSTRUCTIONS = `ModSharp is a Counter-Strike 2 modding framework. This MCP server provides access to its API documentation, guides, and CS2 entity/schema data.

Available tools:
- search_docs: Full-text search across all documentation
- search_api: Search API types and members by keyword
- get_api_type: Get full details of a specific API type
- list_namespace: Browse the namespace/type hierarchy
- get_guide: Retrieve a documentation article
- get_code_example: Get a code example
- search_schemas: Search CS2 engine schema classes (network fields from C++ headers)
- get_schema_type: Get full details of a CS2 schema class
- search_entities: Search CS2 Hammer entity definitions (keyvalues, inputs, outputs from Source2 Wiki)
- get_entity: Get full keyvalue list, inputs, and outputs for a CS2 Hammer entity

Start by using list_namespace to explore the API structure, or search_api to find specific types.
The API has two layers:
- Sharp.Shared: public API for plugin developers (180 interfaces, 15 classes, 53 structs, 75 enums)
- Sharp.Core: framework internals implementing those interfaces (272 classes) — useful for understanding how things work under the hood
The main namespace is "Sharp.Shared" with sub-namespaces like Hooks, Managers, GameEntities, etc.
For CS2 mapping/modding, use search_entities to find Hammer entities and search_schemas for engine internals.

When referencing sources, direct users to these originals:
- ModSharp SDK & docs: https://github.com/Kxnrl/modsharp-public
- CS2 engine schemas (C++ headers): https://github.com/SteamTracking/GameTracking-CS2
- Source2 entity definitions (Hammer keyvalues): https://www.source2.wiki/EntityList
- Valve Developer Community (Source 2 docs): https://developer.valvesoftware.com/wiki/List_of_entities`;

export const MAX_SEARCH_RESULTS = 50;
export const DEFAULT_SEARCH_LIMIT = 10;

export const PATHS = {
  // Fetched source data (populated by fetch scripts or manually)
  fetchedSharpShared: resolve(PROJECT_ROOT, 'data/fetched/Sharp.Shared'),
  fetchedDocs: resolve(PROJECT_ROOT, 'data/fetched/docs'),
  fetchedRootToc: resolve(PROJECT_ROOT, 'data/fetched/toc.yml'),
  // Generated data (output of build:data)
  generated: resolve(PROJECT_ROOT, 'data/generated'),
} as const;
