import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LoadedData } from '../types.js';
import { registerApiResources } from './api-resource.js';
import { registerDocResources } from './doc-resource.js';

export function registerAllResources(
  server: McpServer,
  data: LoadedData,
): void {
  registerApiResources(server, data);
  registerDocResources(server, data);

  // Static resources
  // Namespaces index
  server.registerResource(
    'namespaces',
    'modsharp://namespaces',
    {
      description: 'Full ModSharp namespace hierarchy',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'modsharp://namespaces',
          mimeType: 'application/json',
          text: JSON.stringify(
            Object.fromEntries(
              Array.from(data.namespaces.entries()).map(([uid, ns]) => [
                uid,
                {
                  name: ns.name,
                  childNamespaces: ns.childNamespaces,
                  typeCount: ns.types.length,
                },
              ]),
            ),
            null,
            2,
          ),
        },
      ],
    }),
  );

  // TOC
  server.registerResource(
    'toc',
    'modsharp://toc',
    {
      description: 'ModSharp documentation table of contents',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'modsharp://toc',
          mimeType: 'application/json',
          text: JSON.stringify(data.toc, null, 2),
        },
      ],
    }),
  );

  // CS2 Schema classes
  for (const [uid, schema] of data.schemas) {
    server.registerResource(
      `schema-${uid}`,
      `modsharp://schema/${uid}`,
      {
        description: `CS2 schema: ${schema.name}${schema.parent ? ` extends ${schema.parent}` : ''} (${schema.networkVars.length} net vars)`,
        mimeType: 'application/json',
      },
      async () => ({
        contents: [
          {
            uri: `modsharp://schema/${uid}`,
            mimeType: 'application/json',
            text: JSON.stringify(schema, null, 2),
          },
        ],
      }),
    );
  }
}
