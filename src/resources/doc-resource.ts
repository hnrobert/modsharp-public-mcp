import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LoadedData } from '../types.js';

export function registerDocResources(
  server: McpServer,
  data: LoadedData,
): void {
  // Register documentation articles
  const allDocs = [...data.docsEn, ...data.docsCn];
  for (const doc of allDocs) {
    const uri = `modsharp://docs/${doc.id}`;
    server.registerResource(
      `doc-${doc.id}`,
      uri,
      {
        description: `${doc.locale === 'cn' ? 'Chinese' : 'English'} doc: ${doc.title}`,
        mimeType: 'text/markdown',
      },
      async () => ({
        contents: [
          {
            uri,
            mimeType: 'text/markdown',
            text: doc.content,
          },
        ],
      }),
    );
  }

  // Register code examples
  for (const [id, example] of data.examples) {
    const uri = `modsharp://examples/${id}`;
    server.registerResource(
      `example-${id}`,
      uri,
      {
        description: `Code example: ${example.title}`,
        mimeType: 'text/plain',
      },
      async () => ({
        contents: [
          {
            uri,
            mimeType: 'text/plain',
            text: example.code,
          },
        ],
      }),
    );
  }
}
