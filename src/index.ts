import { randomUUID } from "node:crypto";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { LoadedData } from "./types.js";
import { loadData } from "./data/loader.js";
import { createServer } from "./server.js";

const TRANSPORT = process.env.MCP_TRANSPORT || "stdio";
const PORT = parseInt(process.env.PORT || "3000", 10);

// ── Stdio (default, local IDE) ──────────────────────────────

async function startStdio(data: LoadedData): Promise<void> {
  const server = createServer(data);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// ── HTTP (remote / Docker) ──────────────────────────────────
// Supports both:
//   SSE             → GET /sse + POST /messages  (Cursor, older clients)
//   Streamable HTTP → POST /mcp                  (Claude Code, newer clients)

type Transport = SSEServerTransport | StreamableHTTPServerTransport;

async function startHttp(data: LoadedData): Promise<void> {
  const app = createMcpExpressApp();
  const transports = new Map<string, Transport>();

  // ── SSE transport (protocol 2024-11-05) ─────────────────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.get("/sse", async (_req: any, res: any) => {
    const transport = new SSEServerTransport("/messages", res);
    transports.set(transport.sessionId, transport);
    transport.onclose = () => transports.delete(transport.sessionId);
    const server = createServer(data);
    await server.connect(transport);
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.post("/messages", async (req: any, res: any) => {
    const sessionId = req.query.sessionId as string;
    const transport = sessionId ? transports.get(sessionId) : undefined;
    if (!transport || !(transport instanceof SSEServerTransport)) {
      res.status(400).json({ error: "No transport for sessionId" });
      return;
    }
    await transport.handlePostMessage(req, res, req.body);
  });

  // ── Streamable HTTP transport (protocol 2025-03-26) ─────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.all("/mcp", async (req: any, res: any) => {
    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      // Existing session → reuse transport
      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        if (!(transport instanceof StreamableHTTPServerTransport)) {
          res.status(400).json({ error: "Wrong transport type for session" });
          return;
        }
        await transport.handleRequest(req, res, req.body);
        return;
      }

      // New session → create transport
      if (!sessionId && req.method === "POST" && isInitializeRequest(req.body)) {
        const transport: Transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sid: string) => { transports.set(sid, transport); },
        });
        transport.onclose = () => {
          if (transport.sessionId) transports.delete(transport.sessionId);
        };
        const server = createServer(data);
        await server.connect(transport);
        await transport.handleRequest(req, res, req.body);
        return;
      }

      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad request: no valid session" },
        id: null,
      });
    } catch (err) {
      console.error("Error handling /mcp:", err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  app.listen(PORT, () => {
    console.log(`ModSharp MCP server (HTTP) listening on port ${PORT}`);
    console.log(`  SSE:             http://localhost:${PORT}/sse`);
    console.log(`  Streamable HTTP: http://localhost:${PORT}/mcp`);
  });

  process.on("SIGINT", async () => {
    for (const [sid, t] of transports) {
      try { await t.close(); } catch { /* ignore */ }
      transports.delete(sid);
    }
    process.exit(0);
  });
}

// ── Main ────────────────────────────────────────────────────

async function main(): Promise<void> {
  const data = await loadData();

  if (TRANSPORT === "http") {
    await startHttp(data);
  } else {
    await startStdio(data);
  }
}

main().catch((err) => {
  console.error("Fatal error starting ModSharp MCP server:", err);
  process.exit(1);
});
