import type { SchemaFieldType } from '../types.js';

// Safety bound against future malformed data; observed max depth is 4.
const MAX_DEPTH = 20;

/**
 * Render a recursive SchemaFieldType into a readable string.
 * e.g. CUtlVector<CHandle<CBaseEntity>>, bool[7], CBasePlayerController*, Vector
 */
export function renderSchemaType(t: SchemaFieldType, depth = 0): string {
  if (depth > MAX_DEPTH) return '…';
  switch (t.category) {
    case 'builtin':
      return t.name;
    case 'declared_class':
      return t.name;
    case 'declared_enum':
      return t.name;
    case 'atomic':
      return t.inner
        ? `${t.name}<${renderSchemaType(t.inner, depth + 1)}>`
        : t.name;
    case 'ptr':
      return `${renderSchemaType(t.inner, depth + 1)}*`;
    case 'fixed_array':
      return `${renderSchemaType(t.inner, depth + 1)}[${t.count}]`;
    case 'bitfield':
      return `bitfield:${t.count}`;
  }
}
