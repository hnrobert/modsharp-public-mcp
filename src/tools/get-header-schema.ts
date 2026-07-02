import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { LoadedData } from '../types.js';

export function registerGetHeaderSchemaTool(
  server: McpServer,
  data: LoadedData,
): void {
  server.registerTool(
    'get_header_schema',
    {
      description:
        'Get full details of a CS2 engine schema class from GameTracking-CS2 C++ headers (fields, network vars, parent class). ' +
        'Use search_header_schemas to discover available classes.',
      inputSchema: {
        uid: z
          .string()
          .describe(
            "Header schema UID (e.g. 'server/CBaseEntity', 'client/C_CSPlayerPawn')",
          ),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ uid }) => {
      let schema = data.headerSchemas.get(uid);

      // Case-insensitive fallback
      if (!schema) {
        const lower = uid.toLowerCase();
        for (const [key, val] of data.headerSchemas) {
          if (key.toLowerCase() === lower) {
            schema = val;
            break;
          }
        }
      }

      // Try name-only match (without category prefix)
      if (!schema) {
        const lower = uid.toLowerCase();
        for (const [, val] of data.headerSchemas) {
          if (val.name.toLowerCase() === lower) {
            schema = val;
            break;
          }
        }
      }

      if (!schema) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Header schema class not found: ${uid}. Use search_header_schemas to find the correct UID.`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(schema, null, 2),
          },
        ],
      };
    },
  );
}
