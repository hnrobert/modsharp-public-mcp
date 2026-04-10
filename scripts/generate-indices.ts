import { readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import type { ApiTypeInfo, DocArticle, CodeExample, SchemaClass, SearchIndex } from "../src/types.js";

const PROJECT_ROOT = resolve(import.meta.dirname, "..");
const OUTPUT_DIR = resolve(PROJECT_ROOT, "data/generated");

/**
 * PascalCase-aware tokenizer.
 * Splits "IHookManager" into ["ihookmanager", "ihook", "hook", "manager"]
 */
function tokenize(text: string): string[] {
  const tokens = new Set<string>();

  // PascalCase split
  const pascalParts = text.replace(/([a-z])([A-Z])/g, "$1 $2").split(/\s+/);
  for (const part of pascalParts) {
    const lower = part.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (lower.length >= 2) tokens.add(lower);
  }

  // Word split
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (const word of words) {
    if (word.length >= 2) tokens.add(word);
  }

  return Array.from(tokens);
}

async function main() {
  console.log("Generating search index...");

  const [apiTypesRaw, docsEnRaw, docsCnRaw, examplesRaw, schemasRaw] = await Promise.all([
    readFile(join(OUTPUT_DIR, "api-types.json"), "utf-8"),
    readFile(join(OUTPUT_DIR, "docs-en.json"), "utf-8"),
    readFile(join(OUTPUT_DIR, "docs-cn.json"), "utf-8"),
    readFile(join(OUTPUT_DIR, "examples.json"), "utf-8"),
    readFile(join(OUTPUT_DIR, "schemas.json"), "utf-8"),
  ]);

  const apiTypes = JSON.parse(apiTypesRaw) as Record<string, ApiTypeInfo>;
  const docsEn = JSON.parse(docsEnRaw) as DocArticle[];
  const docsCn = JSON.parse(docsCnRaw) as DocArticle[];
  const examples = JSON.parse(examplesRaw) as CodeExample[];
  const schemas = JSON.parse(schemasRaw) as Record<string, SchemaClass>;

  // Build inverted index: token -> entity IDs
  const invertedIndex = new Map<string, string[]>();

  function addTokens(tokens: string[], entityId: string): void {
    for (const token of tokens) {
      const existing = invertedIndex.get(token);
      if (existing) {
        existing.push(entityId);
      } else {
        invertedIndex.set(token, [entityId]);
      }
    }
  }

  // Index API types
  for (const [uid, type] of Object.entries(apiTypes)) {
    const text = [
      type.name,
      type.summary || "",
      ...type.members.map((m) => `${m.name} ${m.summary || ""}`),
    ].join(" ");
    addTokens(tokenize(text), uid);
  }

  // Index docs
  for (const doc of [...docsEn, ...docsCn]) {
    const text = `${doc.title} ${doc.content.slice(0, 2000)}`;
    addTokens(tokenize(text), doc.id);
  }

  // Index examples
  for (const ex of examples) {
    const text = `${ex.title} ${ex.code.slice(0, 1000)}`;
    addTokens(tokenize(text), `example:${ex.id}`);
  }

  // Index CS2 schemas
  for (const [uid, schema] of Object.entries(schemas)) {
    const text = [
      schema.name,
      schema.parent || "",
      ...schema.networkVars.map((f) => `${f.name} ${f.type}`),
      ...schema.localFields.map((f) => `${f.name} ${f.type}`),
    ].join(" ");
    addTokens(tokenize(text), `schema:${uid}`);
  }

  // Deduplicate index entries and convert to plain object
  const tokensObj: Record<string, string[]> = {};
  for (const [key, val] of invertedIndex) {
    tokensObj[key] = [...new Set(val)];
  }

  const searchIndex: SearchIndex = { tokens: tokensObj };

  await writeFile(
    join(OUTPUT_DIR, "search-index.json"),
    JSON.stringify(searchIndex)
  );

  const uniqueTokens = invertedIndex.size;
  const totalEntries = Array.from(invertedIndex.values()).reduce((sum, v) => sum + v.length, 0);

  console.log(`Search index: ${uniqueTokens} unique tokens, ${totalEntries} total entries`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
