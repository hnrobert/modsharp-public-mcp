import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LoadedData } from '../types.js';
import { registerSearchDocsTool } from './search-docs.js';
import { registerSearchApiTool } from './search-api.js';
import { registerGetApiTypeTool } from './get-api-type.js';
import { registerListNamespaceTool } from './list-namespace.js';
import { registerGetGuideTool } from './get-guide.js';
import { registerGetCodeExampleTool } from './get-code-example.js';
import { registerSearchEntitiesTool } from './search-entities.js';
import { registerGetEntityTool } from './get-entity.js';
import { registerSearchHeaderSchemasTool } from './search-header-schemas.js';
import { registerGetHeaderSchemaTool } from './get-header-schema.js';
import { registerSearchSchemasTool } from './search-schemas.js';
import { registerGetSchemaFieldsTool } from './get-schema-fields.js';
import { registerGetEnumTool } from './get-enum.js';

export function registerAllTools(server: McpServer, data: LoadedData): void {
  registerSearchDocsTool(server, data);
  registerSearchApiTool(server, data);
  registerGetApiTypeTool(server, data);
  registerListNamespaceTool(server, data);
  registerGetGuideTool(server, data);
  registerGetCodeExampleTool(server, data);
  registerSearchEntitiesTool(server, data);
  registerGetEntityTool(server, data);
  registerSearchHeaderSchemasTool(server, data);
  registerGetHeaderSchemaTool(server, data);
  registerSearchSchemasTool(server, data);
  registerGetSchemaFieldsTool(server, data);
  registerGetEnumTool(server, data);
}
