import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { LoadedData } from '../types.js';

export function registerGetEntityTool(
  server: McpServer,
  data: LoadedData,
): void {
  server.registerTool(
    'get_entity',
    {
      description:
        'Get full details of a CS2 Hammer entity (keyvalues, inputs, outputs). ' +
        'Use search_entities to discover available entities.',
      inputSchema: {
        classname: z
          .string()
          .describe("Entity classname (e.g. 'trigger_multiple', 'prop_dynamic')"),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ classname }) => {
      let entity = data.entities.get(classname);

      // Case-insensitive fallback
      if (!entity) {
        const lower = classname.toLowerCase();
        for (const [key, val] of data.entities) {
          if (key.toLowerCase() === lower) {
            entity = val;
            break;
          }
        }
      }

      if (!entity) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Entity not found: ${classname}. Use search_entities to find the correct classname.`,
            },
          ],
          isError: true,
        };
      }

      // Build rich response with cross-referenced schema data
      const response: Record<string, unknown> = { ...entity };

      if (entity.relatedSchemaUid) {
        const schema = data.schemas.get(entity.relatedSchemaUid);
        if (schema) {
          response._relatedSchema = {
            uid: schema.uid,
            name: schema.name,
            parent: schema.parent,
            networkFieldCount: schema.networkVars.length,
          };
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(response, null, 2),
          },
        ],
      };
    },
  );
}
