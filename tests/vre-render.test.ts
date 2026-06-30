import { describe, it, expect } from 'vitest';
import { renderVreType } from '../src/vre/render.js';
import type { VreFieldType } from '../src/types.js';

describe('renderVreType', () => {
  it('renders builtin', () => {
    const t: VreFieldType = { category: 'builtin', name: 'float32' };
    expect(renderVreType(t)).toBe('float32');
  });

  it('renders declared_class (drops module)', () => {
    const t: VreFieldType = {
      category: 'declared_class',
      module: 'server',
      name: 'CBaseEntity',
    };
    expect(renderVreType(t)).toBe('CBaseEntity');
  });

  it('renders declared_enum', () => {
    const t: VreFieldType = {
      category: 'declared_enum',
      module: 'server',
      name: 'MoveType_t',
    };
    expect(renderVreType(t)).toBe('MoveType_t');
  });

  it('renders atomic without inner', () => {
    const t: VreFieldType = { category: 'atomic', name: 'Vector' };
    expect(renderVreType(t)).toBe('Vector');
  });

  it('renders atomic with inner (CUtlVector<CHandle<CBaseEntity>>)', () => {
    const t: VreFieldType = {
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
    expect(renderVreType(t)).toBe('CUtlVector<CHandle<CBaseEntity>>');
  });

  it('renders ptr', () => {
    const t: VreFieldType = {
      category: 'ptr',
      inner: {
        category: 'declared_class',
        module: 'server',
        name: 'CBasePlayerController',
      },
    };
    expect(renderVreType(t)).toBe('CBasePlayerController*');
  });

  it('renders fixed_array', () => {
    const t: VreFieldType = {
      category: 'fixed_array',
      count: 7,
      inner: { category: 'builtin', name: 'bool' },
    };
    expect(renderVreType(t)).toBe('bool[7]');
  });

  it('renders bitfield', () => {
    const t: VreFieldType = { category: 'bitfield', count: 1 };
    expect(renderVreType(t)).toBe('bitfield:1');
  });

  it('renders 4-level nesting (CUtlVector<CUtlVector<char*>>)', () => {
    const t: VreFieldType = {
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
    expect(renderVreType(t)).toBe('CUtlVector<CUtlVector<char*>>');
  });
});
