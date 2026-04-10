import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { LoadedData, DocArticle } from "../types.js";
import { tokenize, searchEntries, type SearchEntry } from "../search/index.js";

export function registerSearchDocsTool(server: McpServer, data: LoadedData): void {
  server.registerTool(
    "search_docs",
    {
      description:
        "Full-text search across all ModSharp documentation, API types, and code examples. " +
        "Returns ranked results with snippets. Use this to find guides, API references, or examples.",
      inputSchema: {
        query: z.string().min(1).max(500).describe("Search query string"),
        locale: z
          .enum(["en", "cn"])
          .optional()
          .describe("Filter by language. Omit to search both."),
        category: z
          .string()
          .optional()
          .describe("Filter by category: guides, configurations, features, examples"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe("Maximum results to return"),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query, locale, category, limit }) => {
      // Build search entries from all data sources
      const entries: SearchEntry[] = [];

      // Add docs
      const allDocs = [...data.docsEn, ...data.docsCn];
      for (const doc of allDocs) {
        if (locale && doc.locale !== locale) continue;
        if (category && doc.category !== category) continue;
        entries.push({
          id: doc.id,
          title: doc.title,
          tokens: tokenize(doc.title + " " + doc.content.slice(0, 2000)),
          content: doc.content,
          locale: doc.locale,
          type: "doc",
        });
      }

      // Add API types
      for (const [uid, type] of data.types) {
        const text = `${type.name} ${type.summary || ""} ${type.members
          .map((m) => m.name + " " + (m.summary || ""))
          .join(" ")}`;
        entries.push({
          id: uid,
          title: type.name,
          tokens: tokenize(text),
          content: type.summary || type.name,
          type: "api-type",
        });
      }

      // Add examples
      for (const [id, ex] of data.examples) {
        entries.push({
          id,
          title: ex.title,
          tokens: tokenize(ex.title + " " + ex.code.slice(0, 1000)),
          content: ex.code,
          type: "example",
        });
      }

      // Add CS2 schemas
      for (const [uid, schema] of data.schemas) {
        const text = `${schema.name} ${schema.parent || ""} ${schema.networkVars.map((f) => f.name).join(" ")}`;
        entries.push({
          id: uid,
          title: schema.name,
          tokens: tokenize(text),
          content: `${schema.name} extends ${schema.parent || "none"} (${schema.networkVars.length} net vars, ${schema.localFields.length} fields)`,
          type: "schema",
        });
      }

      const results = searchEntries(query, entries, limit ?? 10);
      const total = results.length;

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                total,
                results: results.map((r) => ({
                  id: r.id,
                  type: r.type,
                  title: r.title,
                  locale: r.locale,
                  snippet: r.snippet.slice(0, 300),
                })),
                hasMore: false,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
