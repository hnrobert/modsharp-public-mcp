import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { LoadedData } from "../types.js";
import { registerSearchDocsTool } from "./search-docs.js";
import { registerSearchApiTool } from "./search-api.js";
import { registerGetApiTypeTool } from "./get-api-type.js";
import { registerListNamespaceTool } from "./list-namespace.js";
import { registerGetGuideTool } from "./get-guide.js";
import { registerGetCodeExampleTool } from "./get-code-example.js";

export function registerAllTools(server: McpServer, data: LoadedData): void {
  registerSearchDocsTool(server, data);
  registerSearchApiTool(server, data);
  registerGetApiTypeTool(server, data);
  registerListNamespaceTool(server, data);
  registerGetGuideTool(server, data);
  registerGetCodeExampleTool(server, data);
}
