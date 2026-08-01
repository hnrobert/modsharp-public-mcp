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

  // CS2 header schema classes (GameTracking C++ headers)
  for (const [uid, schema] of data.headerSchemas) {
    server.registerResource(
      `header-schema-${uid}`,
      `modsharp://header-schema/${uid}`,
      {
        description: `CS2 header schema: ${schema.name}${schema.parent ? ` extends ${schema.parent}` : ''} (${schema.networkVars.length} net vars)`,
        mimeType: 'application/json',
      },
      async () => ({
        contents: [
          {
            uri: `modsharp://header-schema/${uid}`,
            mimeType: 'application/json',
            text: JSON.stringify(schema, null, 2),
          },
        ],
      }),
    );
  }

  // CS2 Entity definitions
  for (const [classname, entity] of data.entities) {
    server.registerResource(
      `entity-${classname}`,
      `modsharp://entity/${classname}`,
      {
        description: `CS2 entity: ${classname} (${entity.entityType}, ${entity.properties.length} props, ${entity.inputs.length} inputs, ${entity.outputs.length} outputs)`,
        mimeType: 'application/json',
      },
      async () => ({
        contents: [
          {
            uri: `modsharp://entity/${classname}`,
            mimeType: 'application/json',
            text: JSON.stringify(entity, null, 2),
          },
        ],
      }),
    );
  }

  // Engine schema index (ValveResourceFormat: CS2/Dota2/Deadlock).
  // Single aggregate resource — per-item registration (29k+) would overwhelm resources/list.
  server.registerResource(
    'schema-games',
    'modsharp://schema/games',
    {
      description:
        'Valve engine schema index (ValveResourceFormat/SchemaExplorer) across CS2/Dota2/Deadlock — per-game revision, version, class/enum counts',
      mimeType: 'application/json',
    },
    async () => ({
      contents: [
        {
          uri: 'modsharp://schema/games',
          mimeType: 'application/json',
          text: JSON.stringify(
            {
              source: 'ValveResourceFormat/SchemaExplorer',
              note: 'Use search_schemas / get_schema_fields / get_enum tools to query individual classes and enums.',
              games: data.schemaGames,
              totalClasses: data.schemas.size,
              totalEnums: data.enums.size,
            },
            null,
            2,
          ),
        },
      ],
    }),
  );
}
