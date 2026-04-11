/**
 * PascalCase-aware tokenization and search.
 * Splits identifiers like "IHookManager" into ["ihookmanager", "ihook", "hook", "manager"].
 */
export function tokenize(text: string): string[] {
  const tokens = new Set<string>();

  // Split on PascalCase boundaries
  const pascalParts = text.replace(/([a-z])([A-Z])/g, '$1 $2').split(/\s+/);
  for (const part of pascalParts) {
    const lower = part.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (lower.length >= 2) {
      tokens.add(lower);
    }
    // Also add the whole combined token
    if (lower.length >= 4) {
      // Add substrings of length >= 3 for partial matching
      for (let i = 0; i <= lower.length - 3; i++) {
        tokens.add(lower.slice(i));
      }
    }
  }

  // Split on non-alphanumeric
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  for (const word of words) {
    if (word.length >= 2) {
      tokens.add(word);
    }
  }

  return Array.from(tokens);
}

export interface SearchEntry {
  id: string;
  title: string;
  /** Pre-tokenized searchable text */
  tokens: string[];
  /** Original content for snippet extraction */
  content: string;
  locale?: string;
  type: 'doc' | 'api-type' | 'example' | 'schema';
}

export function buildSearchEntries(
  searchIndex: Map<string, string[]>,
  // We need the actual data to build entries - passed via callback
): void {
  // The search index is pre-built by the build script.
  // At runtime we just do lookups against it.
}

export interface TextSearchResult {
  id: string;
  type: 'doc' | 'api-type' | 'example' | 'schema';
  title: string;
  snippet: string;
  locale?: string;
  relevanceScore: number;
}

/**
 * Search using pre-built inverted index + full scan of matching entries.
 */
export function searchEntries(
  query: string,
  entries: SearchEntry[],
  limit: number,
): TextSearchResult[] {
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) return [];

  const results: TextSearchResult[] = [];

  for (const entry of entries) {
    let score = 0;
    for (const qt of queryTokens) {
      // Check title (higher weight)
      const titleLower = entry.title.toLowerCase();
      if (titleLower === qt) {
        score += 10; // exact title match
      } else if (titleLower.includes(qt)) {
        score += 5; // title substring
      }

      // Check tokens
      for (const token of entry.tokens) {
        if (token === qt) {
          score += 3; // exact token match
        } else if (token.startsWith(qt)) {
          score += 2; // prefix match
        } else if (token.includes(qt)) {
          score += 1; // substring match
        }
      }
    }

    if (score > 0) {
      results.push({
        id: entry.id,
        type: entry.type,
        title: entry.title,
        locale: entry.locale as 'en' | 'cn' | undefined,
        snippet: extractSnippet(entry.content, query),
        relevanceScore: score,
      });
    }
  }

  results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return results.slice(0, limit);
}

function extractSnippet(content: string, query: string): string {
  const lower = content.toLowerCase();
  const queryLower = query.toLowerCase();
  const idx = lower.indexOf(queryLower);

  if (idx === -1) {
    // Return first 200 chars
    return content.slice(0, 200).trim() + (content.length > 200 ? '...' : '');
  }

  const start = Math.max(0, idx - 60);
  const end = Math.min(content.length, idx + query.length + 140);
  let snippet = content.slice(start, end).trim();
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet += '...';
  return snippet;
}
