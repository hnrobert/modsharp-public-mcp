import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { LoadedData } from "../types.js";

export function registerGetSchemaTypeTool(server: McpServer, data: LoadedData): void {
  server.registerTool(
    "get_schema_type",
    {
      description:
        "Get full details of a CS2 engine schema class (fields, network vars, parent class). " +
        "Use search_schemas to discover available classes.",
      inputSchema: {
        uid: z
          .string()
          .describe(
            "Schema class UID (e.g. 'server/CBaseEntity', 'client/C_CSPlayerPawn')"
          ),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ uid }) => {
      let schema = data.schemas.get(uid);

      // Case-insensitive fallback
      if (!schema) {
        const lower = uid.toLowerCase();
        for (const [key, val] of data.schemas) {
          if (key.toLowerCase() === lower) {
            schema = val;
            break;
          }
        }
      }

      // Try name-only match (without category prefix)
      if (!schema) {
        const lower = uid.toLowerCase();
        for (const [, val] of data.schemas) {
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
              type: "text" as const,
              text: `Schema class not found: ${uid}. Use search_schemas to find the correct UID.`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(schema, null, 2),
          },
        ],
      };
    }
  );
}
