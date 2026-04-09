import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
// In dev: __dirname is src/ -> ../  (project root)
// In dist: __dirname is dist/ -> ../  (project root)
export const PROJECT_ROOT = resolve(__dirname, "..");

export const SERVER_NAME = "modsharp-docs";
export const SERVER_VERSION = "1.0.0";

export const SERVER_INSTRUCTIONS = `ModSharp is a Counter-Strike 2 modding framework. This MCP server provides access to its API documentation and guides.

Available tools:
- search_docs: Full-text search across all documentation
- search_api: Search API types and members by keyword
- get_api_type: Get full details of a specific API type
- list_namespace: Browse the namespace/type hierarchy
- get_guide: Retrieve a documentation article
- get_code_example: Get a code example

Start by using list_namespace to explore the API structure, or search_api to find specific types.
The main namespace is "Sharp.Shared" with sub-namespaces like Hooks, Managers, GameEntities, etc.`;

export const MAX_SEARCH_RESULTS = 50;
export const DEFAULT_SEARCH_LIMIT = 10;

export const PATHS = {
  // Fetched source data (populated by fetch scripts or manually)
  fetchedSharpShared: resolve(PROJECT_ROOT, "data/fetched/Sharp.Shared"),
  fetchedDocs: resolve(PROJECT_ROOT, "data/fetched/docs"),
  fetchedRootToc: resolve(PROJECT_ROOT, "data/fetched/toc.yml"),
  // Generated data (output of build:data)
  generated: resolve(PROJECT_ROOT, "data/generated"),
} as const;
