import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { LoadedData } from '../types.js';
import { tokenize } from '../search/index.js';

export function registerSearchHeaderSchemasTool(
  server: McpServer,
  data: LoadedData,
): void {
  server.registerTool(
    'search_header_schemas',
    {
      description:
        'Search CS2 engine schema header declarations (CBaseEntity, C_CSPlayerPawn, etc.) from GameTracking-CS2 C++ headers. ' +
        'CS2 only, 7 categories. Matches class names, parent classes, and field names; returns network + local fields. ' +
        'For complete struct memory layouts (offsets, recursive types, enums) across CS2/Dota2/Deadlock, use search_schemas instead.',
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(200)
          .describe(
            "Search term (class name like 'CBaseEntity', field name like 'm_iHealth')",
          ),
        category: z
          .string()
          .default('all')
          .describe(
            "Schema category to filter by (e.g. 'server', 'client', 'particles', 'animlib') or 'all'",
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
    async ({ query, category, limit }) => {
      const queryLower = query.toLowerCase();
      const queryTokens = tokenize(query);
      const results: Array<{
        uid: string;
        name: string;
        parent?: string;
        category: string;
        networkFieldCount: number;
        matchedFields: string[];
        relevanceScore: number;
      }> = [];

      for (const [uid, schema] of data.headerSchemas) {
        if (category && category !== 'all' && schema.category !== category)
          continue;

        let score = 0;
        const matchedFields: string[] = [];

        // Class name match
        const nameLower = schema.name.toLowerCase();
        if (nameLower === queryLower) score += 10;
        else if (nameLower.includes(queryLower)) score += 5;

        // Parent match
        if (schema.parent && schema.parent.toLowerCase().includes(queryLower))
          score += 3;

        // Token match on class name
        const classTokens = new Set(tokenize(schema.name));
        for (const qt of queryTokens) {
          if (classTokens.has(qt)) score += 3;
        }

        // Field name match
        for (const field of [...schema.networkVars, ...schema.localFields]) {
          const fieldLower = field.name.toLowerCase();
          if (fieldLower === queryLower) {
            score += 4;
            matchedFields.push(field.name);
          } else if (fieldLower.includes(queryLower)) {
            score += 2;
            matchedFields.push(field.name);
          }
        }

        if (score > 0) {
          results.push({
            uid,
            name: schema.name,
            parent: schema.parent,
            category: schema.category,
            networkFieldCount: schema.networkVars.length,
            matchedFields: matchedFields.slice(0, 10),
            relevanceScore: score,
          });
        }
      }

      results.sort((a, b) => b.relevanceScore - a.relevanceScore);
      const limited = results.slice(0, limit ?? 20);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                total: results.length,
                results: limited,
                hasMore: results.length > (limit ?? 20),
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
