import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { LoadedData } from "../types.js";

export function registerGetGuideTool(server: McpServer, data: LoadedData): void {
  server.registerTool(
    "get_guide",
    {
      description:
        "Retrieve a ModSharp documentation article (guide, configuration, feature, or example). " +
        "Returns full markdown content. Use search_docs to discover available articles.",
      inputSchema: {
        path: z
          .string()
          .describe(
            "Path or ID of the guide (e.g. 'en-us/guides/getting-started', 'zh-cn/examples/hello-world')"
          ),
        locale: z
          .enum(["en", "cn"])
          .default("en")
          .describe("Preferred language. Falls back to available locale."),
      },
      annotations: {
        readOnlyHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ path, locale }) => {
      // Try exact match first
      const docs = locale === "cn" ? data.docsCn : data.docsEn;
      const fallbackDocs = locale === "cn" ? data.docsEn : data.docsCn;

      let article = docs.find(
        (d) => d.id === path || d.id === `${locale === "cn" ? "zh-cn" : "en-us"}/${path}`
      );

      if (!article) {
        // Try with locale prefix
        const prefix = locale === "cn" ? "zh-cn" : "en-us";
        article = docs.find((d) => d.id === `${prefix}/${path}`);
      }

      if (!article) {
        // Try fallback locale
        article = fallbackDocs.find((d) => {
          const prefix = locale === "cn" ? "en-us" : "zh-cn";
          return d.id === path || d.id === `${prefix}/${path}`;
        });
      }

      if (!article) {
        // Try partial match
        const allDocs = [...docs, ...fallbackDocs];
        article = allDocs.find((d) => d.id.includes(path));
      }

      if (!article) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Guide not found: ${path}. Use search_docs to discover available articles.`,
            },
          ],
          isError: true,
        };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                id: article.id,
                title: article.title,
                locale: article.locale,
                category: article.category,
                content: article.content,
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
