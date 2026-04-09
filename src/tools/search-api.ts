import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { LoadedData, TypeKind } from "../types.js";
import { tokenize } from "../search/index.js";

export function registerSearchApiTool(server: McpServer, data: LoadedData): void {
  server.registerTool(
    "search_api",
    {
      description:
        "Search the ModSharp API surface by keyword. Matches against type names, member names, " +
        "method signatures, and summaries. Returns matching types with highlighted members.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .max(200)
          .describe("Search term (type name, method name, or keyword)"),
        kind: z
          .enum(["interface", "class", "struct", "enum", "delegate", "all"])
          .default("all")
          .describe("Filter by type kind"),
        namespace: z
          .string()
          .optional()
          .describe("Restrict search to a namespace (e.g. 'Sharp.Shared.Hooks')"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(20)
          .describe("Maximum results"),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ query, kind, namespace, limit }) => {
      const queryLower = query.toLowerCase();
      const queryTokens = tokenize(query);
      const results: Array<{
        uid: string;
        name: string;
        kind: TypeKind;
        namespace: string;
        summary?: string;
        matchedMembers: Array<{ name: string; kind: string; summary?: string }>;
        relevanceScore: number;
      }> = [];

      for (const [uid, type] of data.types) {
        // Filter by kind
        if (kind && kind !== "all" && type.kind !== kind) continue;

        // Filter by namespace
        if (namespace && !type.namespace.startsWith(namespace)) continue;

        let score = 0;
        const matchedMembers: Array<{
          name: string;
          kind: string;
          summary?: string;
        }> = [];

        // Check type name
        const nameLower = type.name.toLowerCase();
        if (nameLower === queryLower) {
          score += 10;
        } else if (nameLower.includes(queryLower)) {
          score += 5;
        }

        // Check tokens
        const typeTokens = new Set(tokenize(type.name + " " + (type.summary || "")));
        for (const qt of queryTokens) {
          if (typeTokens.has(qt)) score += 3;
          for (const t of typeTokens) {
            if (t.startsWith(qt)) score += 1;
          }
        }

        // Check members
        for (const member of type.members) {
          const memberNameLower = member.name.toLowerCase();
          let memberMatch = false;
          if (memberNameLower === queryLower) {
            score += 4;
            memberMatch = true;
          } else if (memberNameLower.includes(queryLower)) {
            score += 2;
            memberMatch = true;
          }

          // Also check member summary tokens
          if (member.summary) {
            const memberTokens = new Set(tokenize(member.name + " " + member.summary));
            for (const qt of queryTokens) {
              if (memberTokens.has(qt)) {
                score += 1;
                memberMatch = true;
              }
            }
          }

          if (memberMatch) {
            matchedMembers.push({
              name: member.name,
              kind: member.kind,
              summary: member.summary?.slice(0, 100),
            });
          }
        }

        if (score > 0) {
          results.push({
            uid,
            name: type.name,
            kind: type.kind,
            namespace: type.namespace,
            summary: type.summary?.slice(0, 200),
            matchedMembers: matchedMembers.slice(0, 10),
            relevanceScore: score,
          });
        }
      }

      results.sort((a, b) => b.relevanceScore - a.relevanceScore);
      const limited = results.slice(0, limit ?? 20);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              { total: results.length, results: limited, hasMore: results.length > (limit ?? 20) },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
