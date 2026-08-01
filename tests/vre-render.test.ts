import { describe, it, expect } from 'vitest';
import { renderSchemaType } from '../src/vre/render.js';
import type { SchemaFieldType } from '../src/types.js';

describe('renderSchemaType', () => {
  it('renders builtin', () => {
    const t: SchemaFieldType = { category: 'builtin', name: 'float32' };
    expect(renderSchemaType(t)).toBe('float32');
  });

  it('renders declared_class (drops module)', () => {
    const t: SchemaFieldType = {
      category: 'declared_class',
      module: 'server',
      name: 'CBaseEntity',
    };
    expect(renderSchemaType(t)).toBe('CBaseEntity');
  });

  it('renders declared_enum', () => {
    const t: SchemaFieldType = {
      category: 'declared_enum',
      module: 'server',
      name: 'MoveType_t',
    };
    expect(renderSchemaType(t)).toBe('MoveType_t');
  });

  it('renders atomic without inner', () => {
    const t: SchemaFieldType = { category: 'atomic', name: 'Vector' };
    expect(renderSchemaType(t)).toBe('Vector');
  });

  it('renders atomic with inner (CUtlVector<CHandle<CBaseEntity>>)', () => {
    const t: SchemaFieldType = {
      category: 'atomic',
      name: 'CUtlVector',
      inner: {
        category: 'atomic',
        name: 'CHandle',
        inner: {
          category: 'declared_class',
          module: 'client',
          name: 'CBaseEntity',
        },
      },
    };
    expect(renderSchemaType(t)).toBe('CUtlVector<CHandle<CBaseEntity>>');
  });

  it('renders ptr', () => {
    const t: SchemaFieldType = {
      category: 'ptr',
      inner: {
        category: 'declared_class',
        module: 'server',
        name: 'CBasePlayerController',
      },
    };
    expect(renderSchemaType(t)).toBe('CBasePlayerController*');
  });

  it('renders fixed_array', () => {
    const t: SchemaFieldType = {
      category: 'fixed_array',
      count: 7,
      inner: { category: 'builtin', name: 'bool' },
    };
    expect(renderSchemaType(t)).toBe('bool[7]');
  });

  it('renders bitfield', () => {
    const t: SchemaFieldType = { category: 'bitfield', count: 1 };
    expect(renderSchemaType(t)).toBe('bitfield:1');
  });

  it('renders 4-level nesting (CUtlVector<CUtlVector<char*>>)', () => {
    const t: SchemaFieldType = {
      category: 'atomic',
      name: 'CUtlVector',
      inner: {
        category: 'atomic',
        name: 'CUtlVector',
        inner: {
          category: 'ptr',
          inner: { category: 'builtin', name: 'char' },
        },
      },
    };
    expect(renderSchemaType(t)).toBe('CUtlVector<CUtlVector<char*>>');
  });
});
