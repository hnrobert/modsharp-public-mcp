import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { LoadedData, VreSchemaEnum } from '../types.js';

export function registerGetVreEnumTool(
  server: McpServer,
  data: LoadedData,
): void {
  server.registerTool(
    'get_vre_enum',
    {
      description:
        'Get all members of a Valve engine enum (from ValveResourceFormat/SchemaExplorer). ' +
        'Returns each member name, integer value, and metadata (friendly name/description). ' +
        'UID format: "{game}/{module}/{name}". Use search_vre_schemas (kind=enum) to discover.',
      inputSchema: {
        uid: z
          .string()
          .describe("VRE enum UID, e.g. 'cs2/server/MoveType_t'"),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ uid }) => {
      let en: VreSchemaEnum | undefined = data.vreEnums.get(uid);

      // Case-insensitive fallback
      if (!en) {
        const lower = uid.toLowerCase();
        for (const [key, val] of data.vreEnums) {
          if (key.toLowerCase() === lower) {
            en = val;
            break;
          }
        }
      }

      // Name-only fallback (last path segment)
      if (!en) {
        const bare = uid.includes('/')
          ? uid.slice(uid.lastIndexOf('/') + 1)
          : uid;
        const lower = bare.toLowerCase();
        for (const [, val] of data.vreEnums) {
          if (val.name.toLowerCase() === lower) {
            en = val;
            break;
          }
        }
      }

      if (!en) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `VRE enum not found: ${uid}. Use search_vre_schemas with kind=enum to find the correct UID.`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(en, null, 2),
          },
        ],
      };
    },
  );
}
