import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LoadedData } from '../types.js';

export function registerApiResources(
  server: McpServer,
  data: LoadedData,
): void {
  // Register each API type as a resource
  for (const [uid, typeInfo] of data.types) {
    const uri = `modsharp://api/${typeInfo.namespace}/${typeInfo.name}`;
    server.registerResource(
      `api-${uid}`,
      uri,
      {
        description: `${typeInfo.kind} ${typeInfo.name}${typeInfo.summary ? ': ' + typeInfo.summary.slice(0, 100) : ''}`,
        mimeType: 'application/json',
      },
      async () => ({
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify(typeInfo, null, 2),
          },
        ],
      }),
    );
  }
}
