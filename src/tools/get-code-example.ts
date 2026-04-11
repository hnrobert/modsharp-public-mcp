import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { LoadedData } from '../types.js';

export function registerGetCodeExampleTool(
  server: McpServer,
  data: LoadedData,
): void {
  server.registerTool(
    'get_code_example',
    {
      description:
        'Get a ModSharp code example by ID. Returns the full C# source code with metadata. ' +
        'Use search_docs with category filter to discover available examples.',
      inputSchema: {
        id: z
          .string()
          .describe(
            "Example ID (filename without extension, e.g. 'hello-world', 'command', 'native-hook')",
          ),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ id }) => {
      const example = data.examples.get(id);
      if (!example) {
        // Try partial match
        const matches = Array.from(data.examples.keys()).filter((k) =>
          k.toLowerCase().includes(id.toLowerCase()),
        );
        return {
          content: [
            {
              type: 'text' as const,
              text: `Example not found: ${id}.${
                matches.length > 0
                  ? ` Available matches: ${matches.join(', ')}`
                  : ''
              }`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                id: example.id,
                title: example.title,
                description: example.description,
                code: example.code,
                tags: example.tags,
                relatedTypes: example.relatedTypes,
                sourceFile: example.sourceFile,
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
