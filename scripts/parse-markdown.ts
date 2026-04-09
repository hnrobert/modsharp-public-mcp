import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, join, extname, relative, basename } from "node:path";
import type { DocArticle, CodeExample, TocNode, Locale } from "../src/types.js";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const DOCS_DIR = resolve(PROJECT_ROOT, "data/fetched/docs");
const ROOT_TOC = resolve(PROJECT_ROOT, "data/fetched/toc.yml");
const OUTPUT_DIR = resolve(PROJECT_ROOT, "data/generated");

async function findFiles(dir: string, ext: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findFiles(fullPath, ext)));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      files.push(fullPath);
    }
  }
  return files;
}

function detectLocale(filePath: string): Locale | null {
  if (filePath.includes("/en-us/") || filePath.includes("\\en-us\\")) return "en";
  if (filePath.includes("/zh-cn/") || filePath.includes("\\zh-cn\\")) return "cn";
  return null;
}

function detectCategory(filePath: string): string | undefined {
  const locale = detectLocale(filePath);
  const prefix = locale === "en" ? "en-us/" : locale === "cn" ? "zh-cn/" : "";
  const afterLocale = filePath.split(prefix)[1];
  if (!afterLocale) return undefined;
  const firstDir = afterLocale.split("/")[0];
  return firstDir || undefined;
}

function extractTitle(content: string, filename: string): string {
  // Try first # heading
  const headingMatch = content.match(/^#\s+(.+)$/m);
  if (headingMatch) return headingMatch[1].trim();
  // Fallback to filename
  return filename.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function makeArticleId(filePath: string): string {
  // Get relative path from docs root
  const rel = relative(DOCS_DIR, filePath).replace(/\\/g, "/");
  return rel.replace(/\.md$/, "");
}

function parseTocYaml(content: string): TocNode[] {
  const nodes: TocNode[] = [];
  const lines = content.split("\n");
  let i = 0;

  function parseItems(indent: number): TocNode[] {
    const items: TocNode[] = [];
    while (i < lines.length) {
      const line = lines[i];
      if (!line.trim() || line.trim().startsWith("#")) {
        i++;
        continue;
      }

      const currentIndent = line.search(/\S/);
      if (currentIndent < indent) break;

      const nameMatch = line.match(/^- name:\s*(.+)/);
      if (nameMatch) {
        const node: TocNode = { title: nameMatch[1].trim() };
        i++;

        // Look for href and items at the next indent level
        while (i < lines.length) {
          const nextLine = lines[i];
          if (!nextLine.trim()) { i++; continue; }
          const nextIndent = nextLine.search(/\S/);
          if (nextIndent <= currentIndent) break;

          const hrefMatch = nextLine.match(/^\s*href:\s*(.+)/);
          if (hrefMatch) {
            node.path = hrefMatch[1].trim();
            i++;
            continue;
          }

          const itemsMatch = nextLine.match(/^\s*items:\s*$/);
          if (itemsMatch) {
            i++;
            node.children = parseItems(nextIndent + 2);
            continue;
          }

          // Other fields (expanded, etc.) - skip
          i++;
        }

        items.push(node);
      } else {
        i++;
      }
    }
    return items;
  }

  // Handle root-level `items:` format (indented root)
  const hasItemsRoot = lines.some((l) => /^\s*items:\s*$/.test(l) && l.search(/\S/) === 0);
  if (hasItemsRoot) {
    const itemsLine = lines.findIndex((l) => /^\s*items:\s*$/.test(l));
    if (itemsLine >= 0) {
      i = itemsLine + 1;
      return parseItems(2);
    }
  }

  // Default: parse from root (indent 0)
  return parseItems(0);
}

function extractTags(filename: string, content: string): string[] {
  const tags = new Set<string>();
  const name = basename(filename, ".cs");

  // Derive tags from filename
  const parts = name.split(/[-_]/);
  for (const part of parts) {
    if (part.length >= 3) tags.add(part.toLowerCase());
  }

  // Look for interface/type names in code
  const typeMatches = content.match(/\bI[A-Z]\w+/g) || [];
  for (const t of typeMatches) {
    if (t.length >= 4 && t !== "IEnumerable" && t !== "IDisposable" && t !== "IConfiguration") {
      tags.add(t.toLowerCase().replace(/^i/, ""));
    }
  }

  return Array.from(tags).slice(0, 10);
}

function extractRelatedTypes(content: string): string[] {
  const types = new Set<string>();
  const matches = content.match(/\bI[A-Z][A-Za-z]+\b/g) || [];
  for (const m of matches) {
    if (m.length >= 4 && !["IEnumerable", "IDisposable", "IConfiguration", "IReadOnlyDictionary"].includes(m)) {
      types.add(m);
    }
  }
  return Array.from(types).slice(0, 15);
}

async function main() {
  console.log("Parsing documentation from:", DOCS_DIR);

  // Ensure output dir
  await mkdir(OUTPUT_DIR, { recursive: true });

  // Parse markdown files
  const mdFiles = await findFiles(DOCS_DIR, ".md");
  console.log(`Found ${mdFiles.length} markdown files`);

  const docsEn: DocArticle[] = [];
  const docsCn: DocArticle[] = [];

  for (const file of mdFiles) {
    const locale = detectLocale(file);
    if (!locale) continue;

    const content = await readFile(file, "utf-8");
    const id = makeArticleId(file);
    const title = extractTitle(content, basename(file, ".md"));
    const category = detectCategory(file);

    const article: DocArticle = { id, locale, title, content, category };

    if (locale === "en") docsEn.push(article);
    else docsCn.push(article);
  }

  // Parse code examples
  const codeFiles = await findFiles(join(DOCS_DIR, "codes"), ".cs");
  console.log(`Found ${codeFiles.length} code example files`);

  const examples: CodeExample[] = [];
  for (const file of codeFiles) {
    const code = await readFile(file, "utf-8");
    const id = basename(file, ".cs");
    const title = id.replace(/[-_]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());

    examples.push({
      id,
      title,
      code,
      tags: extractTags(file, code),
      relatedTypes: extractRelatedTypes(code),
      sourceFile: relative(DOCS_DIR, file),
    });
  }

  // Also parse the .xml example if it exists
  const xmlFiles = await findFiles(join(DOCS_DIR, "codes"), ".xml").catch(() => [] as string[]);

  // Parse TOC
  let toc: TocNode[] = [];
  try {
    const rootTocContent = await readFile(ROOT_TOC, "utf-8");
    toc = parseTocYaml(rootTocContent);
  } catch {
    console.log("Could not parse root TOC");
  }

  // Write outputs
  await writeFile(join(OUTPUT_DIR, "docs-en.json"), JSON.stringify(docsEn, null, 2));
  await writeFile(join(OUTPUT_DIR, "docs-cn.json"), JSON.stringify(docsCn, null, 2));
  await writeFile(join(OUTPUT_DIR, "examples.json"), JSON.stringify(examples, null, 2));
  await writeFile(join(OUTPUT_DIR, "toc.json"), JSON.stringify(toc, null, 2));

  console.log(`\nParsed ${docsEn.length} English docs, ${docsCn.length} Chinese docs`);
  console.log(`Parsed ${examples.length} code examples`);
  console.log("TOC nodes:", toc.length);
  console.log("Output written to:", OUTPUT_DIR);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
