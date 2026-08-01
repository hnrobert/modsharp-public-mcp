import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { LoadedData } from '../types.js';
import { tokenize } from '../search/index.js';

interface SchemaSearchHit {
  uid: string;
  kind: 'class' | 'enum';
  game: string;
  name: string;
  module: string;
  size?: number;
  parentNames?: string[];
  fieldCount?: number;
  memberCount?: number;
  matched: string[];
  relevanceScore: number;
}

export function registerSearchSchemasTool(
  server: McpServer,
  data: LoadedData,
): void {
  server.registerTool(
    'search_schemas',
    {
      description:
        'Search Valve engine schemas — full memory layout (offsets, recursive types, sizes, enums) across CS2, Dota 2, and Deadlock, from ValveResourceFormat/SchemaExplorer. ' +
        'Matches class names, enum names, parent classes, and field/member names. ' +
        'This is the primary engine-schema tool. (For CS2-only header declarations with network-field markers, use search_header_schemas.) ' +
        'Use get_schema_fields for a class field layout or get_enum for enum members.',
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(200)
          .describe(
            "Search term (class name like 'CBaseEntity', enum name like 'MoveType_t', or field name like 'm_iHealth')",
          ),
        game: z
          .enum(['cs2', 'dota2', 'deadlock', 'all'])
          .default('all')
          .describe('Filter by game, or "all"'),
        kind: z
          .enum(['class', 'enum', 'all'])
          .default('all')
          .describe('Filter to classes, enums, or both'),
        module: z
          .string()
          .optional()
          .describe(
            "Filter by engine module (e.g. 'server', 'client', 'particles', 'pulse_runtime_lib')",
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(20)
          .describe('Maximum results'),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query, game, kind, module, limit }) => {
      const queryLower = query.toLowerCase();
      const queryTokens = tokenize(query);
      const results: SchemaSearchHit[] = [];
      const max = limit ?? 20;

      const wantClass = kind === 'class' || kind === 'all';
      const wantEnum = kind === 'enum' || kind === 'all';

      if (wantClass) {
        for (const [uid, cls] of data.schemas) {
          if (game !== 'all' && cls.game !== game) continue;
          if (module && cls.module !== module) continue;

          let score = 0;
          const matched: string[] = [];

          const nameLower = cls.name.toLowerCase();
          if (nameLower === queryLower) score += 10;
          else if (nameLower.includes(queryLower)) score += 5;

          for (const p of cls.parents) {
            if (p.name.toLowerCase().includes(queryLower)) score += 3;
          }

          const nameTokens = new Set(tokenize(cls.name));
          for (const qt of queryTokens) if (nameTokens.has(qt)) score += 3;

          for (const f of cls.fields) {
            const fl = f.name.toLowerCase();
            if (fl === queryLower) {
              score += 4;
              matched.push(f.name);
            } else if (fl.includes(queryLower)) {
              score += 2;
              matched.push(f.name);
            }
          }

          if (score > 0) {
            results.push({
              uid,
              kind: 'class',
              game: cls.game,
              name: cls.name,
              module: cls.module,
              size: cls.size,
              parentNames: cls.parents.map((p) => p.name),
              fieldCount: cls.fields.length,
              matched: matched.slice(0, 10),
              relevanceScore: score,
            });
          }
        }
      }

      if (wantEnum) {
        for (const [uid, en] of data.enums) {
          if (game !== 'all' && en.game !== game) continue;
          if (module && en.module !== module) continue;

          let score = 0;
          const matched: string[] = [];

          const nameLower = en.name.toLowerCase();
          if (nameLower === queryLower) score += 10;
          else if (nameLower.includes(queryLower)) score += 5;

          const nameTokens = new Set(tokenize(en.name));
          for (const qt of queryTokens) if (nameTokens.has(qt)) score += 3;

          for (const m of en.members) {
            const ml = m.name.toLowerCase();
            if (ml === queryLower) {
              score += 4;
              matched.push(m.name);
            } else if (ml.includes(queryLower)) {
              score += 2;
              matched.push(m.name);
            }
          }

          if (score > 0) {
            results.push({
              uid,
              kind: 'enum',
              game: en.game,
              name: en.name,
              module: en.module,
              memberCount: en.members.length,
              matched: matched.slice(0, 10),
              relevanceScore: score,
            });
          }
        }
      }

      results.sort((a, b) => b.relevanceScore - a.relevanceScore);
      const limited = results.slice(0, max);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                total: results.length,
                results: limited,
                hasMore: results.length > max,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
