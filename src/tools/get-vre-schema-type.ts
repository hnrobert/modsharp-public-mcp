import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { LoadedData, VreSchemaClass } from '../types.js';

export function registerGetVreSchemaTypeTool(
  server: McpServer,
  data: LoadedData,
): void {
  server.registerTool(
    'get_vre_schema_type',
    {
      description:
        'Get the full field layout of a Valve engine schema class (from ValveResourceFormat/SchemaExplorer). ' +
        'Returns every field with byte offset, rendered type (e.g. CHandle<CBaseEntity>, CUtlVector<T>, bool[7]), class size, parents, and metadata. ' +
        'UID format: "{game}/{module}/{name}". Use search_vre_schemas to discover UIDs.',
      inputSchema: {
        uid: z
          .string()
          .describe(
            "VRE schema class UID, e.g. 'cs2/server/CBaseEntity', 'dota2/client/C_DOTA_BaseNPC'",
          ),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ uid }) => {
      let cls: VreSchemaClass | undefined = data.vreSchemas.get(uid);

      // Case-insensitive fallback
      if (!cls) {
        const lower = uid.toLowerCase();
        for (const [key, val] of data.vreSchemas) {
          if (key.toLowerCase() === lower) {
            cls = val;
            break;
          }
        }
      }

      // Name-only fallback (last path segment)
      if (!cls) {
        const bare = uid.includes('/')
          ? uid.slice(uid.lastIndexOf('/') + 1)
          : uid;
        const lower = bare.toLowerCase();
        for (const [, val] of data.vreSchemas) {
          if (val.name.toLowerCase() === lower) {
            cls = val;
            break;
          }
        }
      }

      if (!cls) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `VRE schema class not found: ${uid}. Use search_vre_schemas to find the correct UID (format: {game}/{module}/{name}).`,
            },
          ],
          isError: true,
        };
      }

      const found = cls;

      // Resolve parents within the same game for inheritance navigation
      const _resolvedParents = found.parents
        .map((p) => {
          const pUid = `${found.game}/${p.module}/${p.name}`;
          const pCls = data.vreSchemas.get(pUid);
          return pCls
            ? { uid: pUid, size: pCls.size, fieldCount: pCls.fields.length }
            : null;
        })
        .filter(
          (p): p is { uid: string; size: number; fieldCount: number } =>
            p !== null,
        );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ ...found, _resolvedParents }, null, 2),
          },
        ],
      };
    },
  );
}
