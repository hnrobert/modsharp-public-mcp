import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { LoadedData } from '../types.js';

export function registerSearchSignaturesTool(
  server: McpServer,
  data: LoadedData,
): void {
  server.registerTool(
    'search_signatures',
    {
      description:
        'Search CS2 binary function signatures from source2rosetta (Linux byte-pattern ' +
        'signatures, string anchors, measured argument types). Covers 8k+ engine/server ' +
        'functions across tiers core / high_confidence / experimental, plus Pulse runtime ' +
        'surfaces. Use get_signature for the full entry (signature bytes, anchors, ABI).',
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(200)
          .describe(
            "Function or surface name (e.g. 'AG2_OnResourceChanged', 'TakeDamage', 'CBarnLightAPI')",
          ),
        tier: z
          .enum(['core', 'high_confidence', 'experimental', 'all'])
          .default('all')
          .describe('Confidence tier filter (core = curated, experimental = unverified)'),
        kind: z
          .enum(['function', 'pulse', 'all'])
          .default('all')
          .describe('Search engine functions, Pulse runtime surfaces, or both'),
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
    async ({ query, tier, kind, limit }) => {
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

      if (kind === 'function' || kind === 'all') {
        for (const f of data.rosetta.functions) {
          if (tier !== 'all' && f.tier !== tier) continue;
          const nameHit = f.name.toLowerCase().includes(q);
          const anchorHit =
            !nameHit &&
            f.anchors?.some((a) => a.toLowerCase().includes(q));
          if (!nameHit && !anchorHit) continue;

          const desc = f.description?.text
            ? ` — ${f.description.text.slice(0, 100)}`
            : '';
          const sig = f.signature?.library ? ` [${f.signature.library}]` : '';
          results.push(
            `${nameHit ? '' : '(anchor) '}${f.name}${sig} ` +
              `{tier: ${f.tier}${f.validated ? ', validated' : ''}}${desc}`,
          );
          if (results.length >= max) break;
        }
      }

      if ((kind === 'pulse' || kind === 'all') && results.length < max) {
        for (const p of data.rosetta.pulse) {
          if (p.name.toLowerCase().includes(q) || p.display?.toLowerCase().includes(q)) {
            results.push(
              `${p.name} {pulse surface, ${p.library ?? '?'}} — ${p.display ?? ''}`,
            );
            if (results.length >= max) break;
          }
        }
      }

      const header =
        `Rosetta build ${data.rosetta.meta.build} — ` +
        `${results.length} match(es)` +
        (results.length === max ? ' (truncated)' : '');

      return {
        content: [
          {
            type: 'text' as const,
            text:
              results.length > 0
                ? `${header}\n${results.join('\n')}`
                : `${header}. Try get_signature("<name>") to check the unresolved list, ` +
                  `or a shorter query.`,
          },
        ],
      };
    },
  );
}
