# ModSharp MCP Server

An MCP (Model Context Protocol) server that exposes ModSharp CS2 modding framework documentation and API reference to IDE-integrated AI agents (Claude Code, Cursor, VS Code Copilot, etc.).

## What It Does

Provides 6 MCP tools and 447+ resources that allow AI assistants to:

- **Search documentation** across 88 bilingual (EN/CN) articles
- **Browse the API surface** of 326 types (180 interfaces, 75 enums, 56 structs, 15 classes)
- **Look up type details** with members, summaries, and syntax
- **Retrieve code examples** (34 complete C# examples)
- **Navigate the namespace hierarchy** (21 namespaces)

## Quick Start

```bash
# Install dependencies
pnpm install

# Fetch source data from GitHub + parse + build search index
pnpm build:data

# Build the MCP server
pnpm build

# Run locally
pnpm start
```

The `build:data` command automatically fetches the latest source files from [github.com/Kxnrl/modsharp-public](https://github.com/Kxnrl/modsharp-public) via the GitHub API and caches them locally. Re-running skips already-downloaded files.

## IDE Configuration

### Claude Code

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "modsharp": {
      "command": "node",
      "args": ["/path/to/modsharp-public-mcp/dist/index.js"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "modsharp": {
      "command": "node",
      "args": ["/path/to/modsharp-public-mcp/dist/index.js"]
    }
  }
}
```

## MCP Tools

| Tool | Description |
|------|-------------|
| `search_docs` | Full-text search across all documentation, API types, examples, and CS2 schemas |
| `search_api` | Search ModSharp API types and members by keyword |
| `get_api_type` | Get full details of a specific ModSharp API type |
| `list_namespace` | Browse the ModSharp namespace/type hierarchy |
| `get_guide` | Retrieve a documentation article |
| `get_code_example` | Get a code example by ID |
| `search_schemas` | Search CS2 engine schema classes (CBaseEntity, C_CSPlayerPawn, etc.) |
| `get_schema_type` | Get full details of a CS2 schema class (fields, network vars) |

## MCP Resources

- `modsharp://api/{namespace}/{typeName}` - ModSharp API type info (JSON)
- `modsharp://docs/{locale}/{path}` - Documentation articles (Markdown)
- `modsharp://examples/{id}` - Code examples (plain text)
- `modsharp://schema/{category}/{className}` - CS2 engine schema classes (JSON)
- `modsharp://namespaces` - Full namespace hierarchy (JSON)
- `modsharp://toc` - Documentation table of contents (JSON)

## Data Stats (as of 2026-04-10)

- **326** ModSharp API types with **3,772** members
- **2,536** CS2/Source2 engine schema classes across **44** categories with **3,141** network fields
- **44** English + **44** Chinese documentation articles
- **34** code examples
- **23,153** search index tokens

## Development

```bash
pnpm fetch        # Fetch latest source data from GitHub
pnpm build:data   # Fetch + parse + index (full data rebuild)
pnpm dev          # Run with hot reload
pnpm build        # Build server
pnpm test         # Run tests
pnpm typecheck    # Type check
```

## Architecture

```mermaid
graph LR
  subgraph build["Build-time (pnpm build:data)"]
    A[GitHub: Kxnrl/modsharp-public<br/>ModSharp C# SDK + Docs] -->|fetch| B[data/fetched/<br/>local cache]
    F[GitHub: SteamTracking/GameTracking-CS2<br/>CS2 Engine Schemas] -->|fetch| B
    B -->|parse| C[data/generated/<br/>JSON data]
  end
  subgraph runtime["Runtime (pnpm start)"]
    C -->|load| D[MCP server<br/>stdio transport]
    D --> E[IDE Agent<br/>Claude Code / Cursor]
  end
```

**Build-time** (no network at runtime):

1. `pnpm fetch` — Downloads source files from GitHub (modsharp-public + GameTracking-CS2), caches by file size
2. Parse — Extracts API types from C# sources, articles from markdown, CS2 schemas from engine headers
3. Index — Builds a token-based search index

**Runtime** (offline, no network needed):

- MCP server loads generated JSON into memory, serves via stdio transport

<!-- ## License -->

<!-- TODO -->
