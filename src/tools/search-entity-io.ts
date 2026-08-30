import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { LoadedData } from '../types.js';

export function registerSearchEntityIoTool(
  server: McpServer,
  data: LoadedData,
): void {
  server.registerTool(
    'search_entity_io',
    {
      description:
        'Search CS2 entity input/output internals from source2rosetta: event member offsets ' +
        '(e.g. m_OnBombDefused @ 3056 in CBombTarget), unjoined input handlers with ABI, and ' +
        'the Hammer-classname ↔ C++-class mapping (trigger_multiple → CTriggerMultiple). ' +
        'Complements get_entity (Source2 Wiki keyvalues) with binary-level offsets.',
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(200)
          .describe(
            "Output/input name, member name, C++ class, or Hammer classname — e.g. 'BombDefused', 'CBombTarget', 'trigger_multiple'",
          ),
        kind: z
          .enum(['input', 'output', 'class', 'all'])
          .default('all')
          .describe('Restrict to entity inputs, outputs, or the classname mapping'),
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
    async ({ query, kind, limit }) => {
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

      if (kind === 'output' || kind === 'all') {
        for (const o of data.rosetta.entityOutputs) {
          if (
            o.output?.toLowerCase().includes(q) ||
            o.member?.toLowerCase().includes(q) ||
            o.class?.toLowerCase().includes(q)
          ) {
            results.push(
              `output ${o.class}::${o.member} → "${o.output}" (offset ${o.offset}, ${o.library ?? '?'})`,
            );
            if (results.length >= max) break;
          }
        }
      }

      if ((kind === 'input' || kind === 'all') && results.length < max) {
        for (const i of data.rosetta.entityInputs) {
          if (
            i.input?.toLowerCase().includes(q) ||
            i.handler?.toLowerCase().includes(q) ||
            i.class?.toLowerCase().includes(q)
          ) {
            const abi = i.abi
              ? ` (int:${i.abi.int ?? 0} float:${i.abi.float ?? 0} ${i.abi.ret ?? ''})`
              : '';
            results.push(
              `input ${i.class}::${i.handler} ← "${i.input}"${abi} @${i.addr ?? '?'} (${i.library ?? '?'})`,
            );
            if (results.length >= max) break;
          }
        }
      }

      if ((kind === 'class' || kind === 'all') && results.length < max) {
        for (const [hammer, cpp] of Object.entries(data.rosetta.entityClasses)) {
          if (
            hammer.toLowerCase().includes(q) ||
            cpp.toLowerCase().includes(q)
          ) {
            results.push(`class ${hammer} → ${cpp}`);
            if (results.length >= max) break;
          }
        }
      }

      const header =
        `Rosetta build ${data.rosetta.meta.build} — ${results.length} entity I/O match(es)` +
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
