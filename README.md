# ModSharp MCP Server

An MCP (Model Context Protocol) server that exposes ModSharp CS2 modding framework documentation and API reference to IDE-integrated AI agents (Claude Code, Cursor, VS Code Copilot, etc.).

## What It Does

Provides 13 MCP tools that allow AI assistants to search and browse ModSharp API documentation, CS2 engine schemas, Valve engine schemas (CS2/Dota2/Deadlock), and Hammer entity definitions.

## IDE Configuration

### Option A: Remote Server

A public instance is available at `modsharp.hnrobert.space`.

| Endpoint | Protocol | Clients |
| ---------- | ---------- | --------- |
| `https://modsharp.hnrobert.space/sse` | SSE (2024-11-05) | Older clients |
| `https://modsharp.hnrobert.space/mcp` | Streamable HTTP (2025-03-26) | Claude Code / Cursor, newer clients |

#### Claude Code

**Project** — add to `.mcp.json` in the project root:

```json
{
  "mcpServers": {
    "modsharp": {
      "type": "http",
      "url": "https://modsharp.hnrobert.space/mcp"
    }
  }
}
```

**Global** — add to `~/.claude/mcp.json`, or run once via CLI:

```bash
claude mcp add --scope user --transport http modsharp https://modsharp.hnrobert.space/mcp
```

#### VSCode + GitHub Copilot

**Project** — add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "modsharp": {
      "type": "http",
      "url": "https://modsharp.hnrobert.space/mcp"
    }
  }
}
```

**Global** — add to User `settings.json` (Command Palette → `Preferences: Open User Settings (JSON)`):

```json
{
  "mcp": {
    "servers": {
      "modsharp": {
        "type": "http",
        "url": "https://modsharp.hnrobert.space/mcp"
      }
    }
  }
}
```

#### Cursor

**Project** — add to `.cursor/mcp.json`. **Global** — add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "modsharp": {
      "type": "http",
      "url": "https://modsharp.hnrobert.space/mcp"
    }
  }
}
```

#### Legacy clients

> For older clients that only support SSE, use the `/sse` endpoint instead. Note that some newer clients may not support SSE, so the `/mcp` endpoint is recommended when possible.

```json
{
  "mcpServers": {
    "modsharp": {
      "url": "https://modsharp.hnrobert.space/sse"
    }
  }
}
```

#### Self-hosting

```bash
docker pull ghcr.io/hnrobert/modsharp-public-mcp:latest
docker run -d -p 3045:3045 -e MCP_TRANSPORT=http ghcr.io/hnrobert/modsharp-public-mcp:latest
```

### Option B: Local Docker (stdio)

```bash
docker pull ghcr.io/hnrobert/modsharp-public-mcp:latest
```

Use in IDE config:

```json
{
  "mcpServers": {
    "modsharp": {
      "command": "docker",
      "args": ["run", "--rm", "-i", "ghcr.io/hnrobert/modsharp-public-mcp:latest"]
    }
  }
}
```

### Option C: Local Node.js

```bash
pnpm install && pnpm build:data && pnpm build
```

Then use `"command": "node", "args": ["/path/to/modsharp-public-mcp/dist/index.js"]` in the config above.

## MCP Tools

| Tool | Description |
| ------ | ------------- |
| `search_docs` | Full-text search across all documentation, API types, examples, and CS2 schemas |
| `search_api` | Search ModSharp API types and members by keyword |
| `get_api_type` | Get full details of a specific ModSharp API type |
| `list_namespace` | Browse the ModSharp namespace/type hierarchy |
| `get_guide` | Retrieve a documentation article |
| `get_code_example` | Get a code example by ID |
| `search_header_schemas` | Search CS2 engine schema header declarations (network fields, C++ headers) |
| `get_header_schema` | Get full details of a CS2 header schema class (fields, network vars) |
| `search_entities` | Search CS2 Hammer entity definitions (trigger_multiple, prop_dynamic, etc.) |
| `get_entity` | Get full details of a CS2 Hammer entity (keyvalues, inputs, outputs) |
| `search_schemas` | Search Valve engine schemas (full memory layout) across CS2/Dota2/Deadlock |
| `get_schema_fields` | Get full field layout of a Valve engine schema class (offsets, types, sizes) |
| `get_enum` | Get members of a Valve engine enum (CS2/Dota2/Deadlock) |

## MCP Resources

- `modsharp://api/{namespace}/{typeName}` - ModSharp API type info (JSON)
- `modsharp://docs/{locale}/{path}` - Documentation articles (Markdown)
- `modsharp://examples/{id}` - Code examples (plain text)
- `modsharp://schema/{category}/{className}` - CS2 engine schema classes (JSON)
- `modsharp://entity/{classname}` - CS2 Hammer entity definitions (JSON)
- `modsharp://namespaces` - Full namespace hierarchy (JSON)
- `modsharp://toc` - Documentation table of contents (JSON)
- `modsharp://schema/games` - Valve engine schema index across CS2/Dota2/Deadlock (JSON)

## Data Stats (as of 2026-08-16)

- **632** ModSharp API types with **7202** members
- **668** CS2/Source2 engine schema classes across **7** categories with **0** network fields
- **0** Valve engine schema classes (CS2/Dota2/Deadlock) with **0** fields + **0** enums (full memory layout from ValveResourceFormat)
- **478** CS2 Hammer entity definitions with **8076** properties, **9207** inputs, **3045** outputs
- **44** English + **44** Chinese documentation articles
- **34** code examples
- **19762** search index tokens

## Development

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

## Architecture

```mermaid
graph LR
  subgraph build["Build-time (docker build / pnpm build:data)"]
    A[GitHub: Kxnrl/modsharp-public<br/>ModSharp C# SDK + Docs] -->|fetch| B[data/fetched/<br/>source cache]
    F[GitHub: SteamTracking/GameTracking-CS2<br/>CS2 Engine Schemas] -->|fetch| B
    G[GitHub: Source2Wiki/Source2Wiki<br/>Entity Definitions] -->|fetch| B
    V[GitHub: ValveResourceFormat/SchemaExplorer<br/>VRE Schemas (CS2/Dota2/Deadlock)] -->|fetch .gz + gunzip| B
    B -->|parse + index| C[data/generated/<br/>JSON data]
  end
  subgraph runtime["Runtime (MCP_TRANSPORT=stdio | http)"]
    C -->|load| D[MCP server]
    D -->|stdio| E[Local IDE]
    D -->|HTTP SSE / Streamable| H[Remote IDEs]
  end
```

**Build-time** (baked into Docker image, no network at runtime):

1. Fetch — Downloads source files from GitHub (modsharp-public + GameTracking-CS2 + Source2Wiki + SchemaExplorer), caches locally
2. Parse — Extracts API types from C# sources, articles from markdown, CS2 schemas from engine headers, entity definitions from Source2 Wiki JSON
3. Index — Builds a token-based search index

Only `data/generated/` (final JSON) enters the Docker image.

**Runtime** (fully offline, no network needed):

- `MCP_TRANSPORT=stdio` (default) — local IDE via stdin/stdout
- `MCP_TRANSPORT=http` — remote IDEs via HTTP (`/sse` + `/mcp` endpoints)

<!-- ## License -->

<!-- TODO -->
