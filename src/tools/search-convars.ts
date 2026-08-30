import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { LoadedData } from '../types.js';

export function registerSearchConvarsTool(
  server: McpServer,
  data: LoadedData,
): void {
  server.registerTool(
    'search_convars',
    {
      description:
        'Search CS2 console variables from source2rosetta (1.5k+ convars with server/client ' +
        'library, description, flags like cheat/replicated, and resolved address). ' +
        'Matches name, description, and flags.',
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(200)
          .describe("Convar name, flag, or description text, e.g. 'friendly', 'bot_quota', 'cheat'"),
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
    async ({ query, limit }) => {
      if (!data.rosetta) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'Rosetta dataset is not built (data/generated/rosetta.json missing). Run `pnpm run fetch && pnpm run generate`.',
            },
          ],
          isError: true,
        };
      }

      const q = query.toLowerCase();
      const max = limit ?? 20;
      const results: string[] = [];

      for (const c of data.rosetta.convars) {
        const nameHit = c.name.toLowerCase().includes(q);
        const descHit =
          !nameHit && c.description?.toLowerCase().includes(q);
        const flagHit =
          !nameHit && !descHit && c.flags?.some((f) => f.toLowerCase().includes(q));
        if (!nameHit && !descHit && !flagHit) continue;

        const flags = c.flags?.length ? ` [${c.flags.join(', ')}]` : '';
        results.push(
          `${c.name}${flags} (${c.library ?? '?'}${c.addr ? `, ${c.addr}` : ''})` +
            `${c.description ? ` — ${c.description}` : ''}`,
        );
        if (results.length >= max) break;
      }

      const header =
        `Rosetta build ${data.rosetta.meta.build} — ${results.length} convar match(es)` +
        (results.length === max ? ' (truncated)' : '');

      return {
        content: [
          {
            type: 'text' as const,
            text:
              results.length > 0
                ? `${header}\n${results.join('\n')}`
                : `${header}.`,
          },
        ],
      };
    },
  );
}
