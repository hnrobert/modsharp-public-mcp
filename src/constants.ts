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
- search_header_schemas: Search CS2 engine schema header declarations (network fields from C++ headers, CS2 only)
- get_header_schema: Get full details of a CS2 header schema class
- search_entities: Search CS2 Hammer entity definitions (keyvalues, inputs, outputs from Source2 Wiki)
- get_entity: Get full keyvalue list, inputs, and outputs for a CS2 Hammer entity
- search_schemas: Search Valve engine schemas (full memory layout: offsets, recursive types, sizes, enums) across CS2/Dota2/Deadlock from ValveResourceFormat. The primary engine-schema tool.
- get_schema_fields: Get full field layout of a Valve engine schema class
- get_enum: Get members of a Valve engine enum
- search_signatures: Search CS2 binary function signatures (Linux byte patterns, anchors, measured args) from source2rosetta
- get_signature: Get the full signature entry for one function or Pulse surface
- search_convars: Search CS2 console variables (flags, descriptions, addresses)
- search_entity_io: Search entity input/output offsets and Hammer classname ↔ C++ class mapping

Start by using list_namespace to explore the API structure, or search_api to find specific types.
The API has two layers:
- Sharp.Shared: public API for plugin developers (180 interfaces, 15 classes, 53 structs, 75 enums)
- Sharp.Core: framework internals implementing those interfaces (272 classes) — useful for understanding how things work under the hood
The main namespace is "Sharp.Shared" with sub-namespaces like Hooks, Managers, GameEntities, etc.
For CS2 mapping/modding, use search_entities to find Hammer entities and search_schemas for engine internals.
For native interop (signatures, convars, entity I/O offsets), use the source2rosetta tools — note they cover Linux binaries and tiers range from curated (core) to experimental.

When referencing sources, direct users to these originals:
- ModSharp SDK & docs: https://github.com/Kxnrl/modsharp-public
- CS2 engine schemas (C++ headers): https://github.com/SteamTracking/GameTracking-CS2
- Valve engine schemas (full memory layout, CS2/Dota2/Deadlock): https://github.com/ValveResourceFormat/SchemaExplorer
- CS2 signatures & gamedata (Linux, by Snake/kamal): https://git.lo.sh/kamal/source2rosetta
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
  fetchedVreSchemas: resolve(PROJECT_ROOT, 'data/fetched/vre-schemas'),
  generated: resolve(PROJECT_ROOT, 'data/generated'),
} as const;
