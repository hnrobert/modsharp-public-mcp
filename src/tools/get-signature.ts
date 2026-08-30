import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { LoadedData } from '../types.js';

export function registerGetSignatureTool(
  server: McpServer,
  data: LoadedData,
): void {
  server.registerTool(
    'get_signature',
    {
      description:
        'Get the full source2rosetta entry for one function or Pulse surface: Linux ' +
        'byte-pattern signature, string anchors, measured argument/return types, ' +
        'prototype and description when known, vtable/offset info, and bound ' +
        'script/command/entity-input names. If the name is in the unresolved list, ' +
        'returns why it could not be located.',
      inputSchema: {
        name: z
          .string()
          .min(1)
          .describe(
            "Exact function or surface name, e.g. 'AG2_OnResourceChanged' or 'CBarnLightAPI::CastDynamicShadows'",
          ),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ name }) => {
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

      const fn = data.rosettaFunctions.get(name);
      if (fn) {
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(fn, null, 2) },
          ],
        };
      }

      // Pulse surface fallback
      const pulse = data.rosetta.pulse.find((p) => p.name === name);
      if (pulse) {
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(pulse, null, 2) },
          ],
        };
      }

      // Unresolved — explain why rather than a bare 404
      const un = data.rosettaUnresolved.get(name);
      if (un) {
        return {
          content: [
            {
              type: 'text' as const,
              text:
                `${name} is in the unresolved list (${data.rosetta.meta.build}):\n` +
                `${un.reason ?? 'unknown reason'}\n${un.detail ?? ''}`,
            },
          ],
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text:
              `No entry for ${name} in Rosetta build ${data.rosetta.meta.build}. ` +
              `Use search_signatures to find nearby names.`,
          },
        ],
        isError: true,
      };
    },
  );
}
