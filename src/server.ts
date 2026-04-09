import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SERVER_NAME, SERVER_VERSION, SERVER_INSTRUCTIONS } from "./constants.js";
import type { LoadedData } from "./types.js";
import { registerAllTools } from "./tools/index.js";
import { registerAllResources } from "./resources/index.js";

export function createServer(data: LoadedData): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Register capabilities with instructions
  server.server.registerCapabilities({
    tools: {},
    resources: {},
  });

  // Register all tools and resources
  registerAllTools(server, data);
  registerAllResources(server, data);

  return server;
}
