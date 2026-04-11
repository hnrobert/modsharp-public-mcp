import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { LoadedData } from '../types.js';

export function registerGetApiTypeTool(
  server: McpServer,
  data: LoadedData,
): void {
  server.registerTool(
    'get_api_type',
    {
      description:
        'Get full details of a specific ModSharp API type (interface, class, struct, enum). ' +
        'Returns members, summary, inheritance, and syntax. Use search_api or list_namespace to discover UIDs.',
      inputSchema: {
        uid: z
          .string()
          .describe(
            "Full UID of the type (e.g. 'Sharp.Shared.Managers.IHookManager', 'Sharp.Shared.Enums.CStrikeTeam')",
          ),
        includeMembers: z
          .boolean()
          .default(true)
          .describe('Include member details. Set false for a summary view.'),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ uid, includeMembers }) => {
      const typeInfo = data.types.get(uid);
      if (!typeInfo) {
        // Try case-insensitive search
        for (const [key, val] of data.types) {
          if (key.toLowerCase() === uid.toLowerCase()) {
            return formatType(val, includeMembers ?? true);
          }
        }
        return {
          content: [
            {
              type: 'text' as const,
              text: `Type not found: ${uid}. Use search_api to find the correct UID.`,
            },
          ],
          isError: true,
        };
      }
      return formatType(typeInfo, includeMembers ?? true);
    },
  );
}

function formatType(
  typeInfo: LoadedData['types'] extends Map<string, infer V> ? V : never,
  includeMembers: boolean,
) {
  const result: Record<string, unknown> = {
    uid: typeInfo.uid,
    name: typeInfo.name,
    kind: typeInfo.kind,
    namespace: typeInfo.namespace,
    summary: typeInfo.summary,
    syntax: typeInfo.syntax,
    inheritance: typeInfo.inheritance,
    implements: typeInfo.implements,
    deprecated: typeInfo.deprecated,
    isStatic: typeInfo.isStatic,
    typeParameters: typeInfo.typeParameters,
  };

  if (includeMembers) {
    result.members = typeInfo.members.map((m) => ({
      name: m.name,
      kind: m.kind,
      summary: m.summary,
      syntax: m.syntax,
      parameters: m.parameters,
      returnType: m.returnType,
      propertyType: m.propertyType,
      fieldType: m.fieldType,
      enumValue: m.enumValue,
      isStatic: m.isStatic,
      deprecated: m.deprecated,
      hasGetter: m.hasGetter,
      hasSetter: m.hasSetter,
    }));
  } else {
    result.memberCount = typeInfo.members.length;
  }

  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
  };
}
