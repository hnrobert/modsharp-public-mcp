import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { LoadedData } from '../types.js';

export function registerSearchEntitiesTool(
  server: McpServer,
  data: LoadedData,
): void {
  server.registerTool(
    'search_entities',
    {
      description:
        'Search CS2 Hammer entity definitions (trigger_multiple, prop_dynamic, etc.) from Source2 Wiki. ' +
        'Matches classnames, descriptions, keyvalue names, and input/output names. ' +
        'Returns entity type, description, keyvalue/input/output counts. ' +
        'Use this to find entity classnames, then use get_entity for full keyvalue details.',
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(200)
          .describe(
            "Search term (entity classname like 'trigger', keyvalue name like 'damage')",
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(20)
          .describe('Maximum results'),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query, limit }) => {
      const queryLower = query.toLowerCase();
      const results: Array<{
        classname: string;
        entityType: string;
        description: string;
        propertyCount: number;
        inputCount: number;
        outputCount: number;
        relatedSchemaUid?: string;
        matchedProperties: string[];
        relevanceScore: number;
      }> = [];

      for (const [classname, entity] of data.entities) {
        let score = 0;
        const matchedProperties: string[] = [];

        // Classname match
        if (classname === queryLower) score += 10;
        else if (classname.includes(queryLower)) score += 5;

        // Description match
        if (entity.description.toLowerCase().includes(queryLower)) score += 3;

        // Property match
        for (const prop of entity.properties) {
          const propLower = prop.internalName.toLowerCase();
          const nameLower = prop.friendlyName.toLowerCase();
          if (propLower === queryLower || nameLower === queryLower) {
            score += 4;
            matchedProperties.push(prop.internalName);
          } else if (propLower.includes(queryLower) || nameLower.includes(queryLower)) {
            score += 2;
            matchedProperties.push(prop.internalName);
          }
        }

        // Input/output match
        for (const io of [...entity.inputs, ...entity.outputs]) {
          if (io.name.toLowerCase().includes(queryLower)) score += 3;
        }

        if (score > 0) {
          results.push({
            classname,
            entityType: entity.entityType,
            description: entity.description,
            propertyCount: entity.properties.length,
            inputCount: entity.inputs.length,
            outputCount: entity.outputs.length,
            relatedSchemaUid: entity.relatedSchemaUid,
            matchedProperties: matchedProperties.slice(0, 10),
            relevanceScore: score,
          });
        }
      }

      results.sort((a, b) => b.relevanceScore - a.relevanceScore);
      const limited = results.slice(0, limit ?? 20);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                total: results.length,
                results: limited,
                hasMore: results.length > (limit ?? 20),
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
