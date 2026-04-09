import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadData } from "./data/loader.js";
import { createServer } from "./server.js";

async function main() {
  const data = await loadData();
  const server = createServer(data);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error starting ModSharp MCP server:", err);
  process.exit(1);
});
