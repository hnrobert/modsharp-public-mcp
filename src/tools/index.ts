import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { LoadedData } from '../types.js';
import { registerSearchDocsTool } from './search-docs.js';
import { registerSearchApiTool } from './search-api.js';
import { registerGetApiTypeTool } from './get-api-type.js';
import { registerListNamespaceTool } from './list-namespace.js';
import { registerGetGuideTool } from './get-guide.js';
import { registerGetCodeExampleTool } from './get-code-example.js';
import { registerSearchSchemasTool } from './search-schemas.js';
import { registerGetSchemaTypeTool } from './get-schema-type.js';
import { registerSearchEntitiesTool } from './search-entities.js';
import { registerGetEntityTool } from './get-entity.js';
import { registerSearchVreSchemasTool } from './search-vre-schemas.js';
import { registerGetVreSchemaTypeTool } from './get-vre-schema-type.js';
import { registerGetVreEnumTool } from './get-vre-enum.js';

export function registerAllTools(server: McpServer, data: LoadedData): void {
  registerSearchDocsTool(server, data);
  registerSearchApiTool(server, data);
  registerGetApiTypeTool(server, data);
  registerListNamespaceTool(server, data);
  registerGetGuideTool(server, data);
  registerGetCodeExampleTool(server, data);
  registerSearchSchemasTool(server, data);
  registerGetSchemaTypeTool(server, data);
  registerSearchEntitiesTool(server, data);
  registerGetEntityTool(server, data);
  registerSearchVreSchemasTool(server, data);
  registerGetVreSchemaTypeTool(server, data);
  registerGetVreEnumTool(server, data);
}
