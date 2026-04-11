import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { LoadedData } from '../types.js';

export function registerListNamespaceTool(
  server: McpServer,
  data: LoadedData,
): void {
  server.registerTool(
    'list_namespace',
    {
      description:
        'Browse the ModSharp namespace hierarchy. List all namespaces or get types within a specific namespace. ' +
        "Root namespace is 'Sharp.Shared'.",
      inputSchema: {
        namespace: z
          .string()
          .optional()
          .describe(
            "Namespace to list (e.g. 'Sharp.Shared.Hooks'). Omit to list all root namespaces.",
          ),
        recursive: z
          .boolean()
          .default(false)
          .describe('Include types from child namespaces'),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ namespace, recursive }) => {
      if (!namespace) {
        // List all namespaces
        const roots: Array<{ uid: string; name: string; typeCount: number }> =
          [];
        for (const [uid, ns] of data.namespaces) {
          if (!ns.parentNamespace || ns.parentNamespace === 'Sharp.Shared') {
            roots.push({
              uid,
              name: ns.name,
              typeCount: ns.types.length,
            });
          }
        }
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(
                {
                  namespace: 'Sharp.Shared',
                  childNamespaces: roots,
                  types: getTypesForNamespace(data, 'Sharp.Shared'),
                },
                null,
                2,
              ),
            },
          ],
        };
      }

      const nsInfo = data.namespaces.get(namespace);
      if (!nsInfo) {
        // Try to find close matches
        const matches = Array.from(data.namespaces.keys()).filter((k) =>
          k.toLowerCase().includes(namespace.toLowerCase()),
        );
        return {
          content: [
            {
              type: 'text' as const,
              text: `Namespace not found: ${namespace}.${matches.length > 0 ? ` Did you mean: ${matches.join(', ')}?` : ''}`,
            },
          ],
          isError: true,
        };
      }

      // Get child namespaces
      const children = nsInfo.childNamespaces.map((childUid) => {
        const child = data.namespaces.get(childUid);
        return {
          uid: childUid,
          name: child?.name || childUid.split('.').pop() || childUid,
          typeCount: child?.types.length || 0,
        };
      });

      // Get types
      let types = getTypesForNamespace(data, namespace);
      if (recursive) {
        for (const childUid of nsInfo.childNamespaces) {
          types = types.concat(getTypesForNamespace(data, childUid));
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                namespace,
                childNamespaces: children,
                types,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}

function getTypesForNamespace(
  data: LoadedData,
  namespace: string,
): Array<{ uid: string; name: string; kind: string; summary?: string }> {
  const nsInfo = data.namespaces.get(namespace);
  if (!nsInfo) return [];

  return nsInfo.types
    .map((uid) => {
      const t = data.types.get(uid);
      if (!t) return null;
      return {
        uid: t.uid,
        name: t.name,
        kind: t.kind,
        summary: t.summary?.slice(0, 150),
      };
    })
    .filter(Boolean) as Array<{
    uid: string;
    name: string;
    kind: string;
    summary?: string;
  }>;
}
