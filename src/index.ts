import { loadData } from "./data/loader.js";
import { createServer } from "./server.js";
import { startStdio } from "./transports/stdio.js";
import { startHttp } from "./transports/http.js";

const TRANSPORT = process.env.MCP_TRANSPORT || "stdio";

async function main(): Promise<void> {
  const data = await loadData();

  if (TRANSPORT === "http") {
    startHttp(data);
  } else {
    const server = createServer(data);
    await startStdio(server);
  }
}

main().catch((err) => {
  console.error("Fatal error starting ModSharp MCP server:", err);
  process.exit(1);
});
