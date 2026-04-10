import { randomUUID } from "node:crypto";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { LoadedData } from "../types.js";
import { createServer } from "../server.js";

type Transport = SSEServerTransport | StreamableHTTPServerTransport;

const PORT = parseInt(process.env.PORT || "3045", 10);

export function startHttp(data: LoadedData): void {
  const app = createMcpExpressApp({ host: "0.0.0.0" });
  const transports = new Map<string, Transport>();

  // ── SSE (protocol 2024-11-05) — Cursor, older clients ────────

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

  // ── Streamable HTTP (protocol 2025-03-26) — Claude Code ──────

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.all("/mcp", async (req: any, res: any) => {
    try {
      const sessionId = req.headers["mcp-session-id"] as string | undefined;

      if (sessionId && transports.has(sessionId)) {
        const transport = transports.get(sessionId)!;
        if (!(transport instanceof StreamableHTTPServerTransport)) {
          res.status(400).json({ error: "Wrong transport type for session" });
          return;
        }
        await transport.handleRequest(req, res, req.body);
        return;
      }

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
