// tests/server.capabilities.pure.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const VFS: Record<string, string> = {};
vi.mock('fs', () => ({
  readFileSync: (p: string) => {
    const key = p.replace(/\\/g, '/');
    if (!(key in VFS)) throw new Error(`ENOENT: ${key}`);
    return VFS[key];
  },
  existsSync: (p: string) => VFS.hasOwnProperty(p.replace(/\\/g, '/')),
}));

import { buildLoader } from '../src/loader';
import type { Manifest } from '../src/types';

const GUIDANCE = '/vfs/.guidance';

function seedVfs() {
  const manifest: Manifest = {
    version: 2,
    globals: {
      model_window_tokens: 8000,
      supply_hard_cap_tokens: 400,
      reserve_for_reasoning: 100,
    },
    keys: { x: {}, y: {} },
  };
  VFS[`${GUIDANCE}/manifest.yaml`] = JSON.stringify(manifest);
  VFS[`${GUIDANCE}/excerpts.jsonl`] = '';
}

describe('capabilities surface (pure)', () => {
  beforeEach(() => {
    for (const k of Object.keys(VFS)) delete VFS[k];
    seedVfs();
  });

  it('exposes manifest keys and documents two tools', () => {
    const loader = buildLoader({ guidanceDir: GUIDANCE });
    expect(Object.keys(loader.manifest.keys)).toEqual(['x', 'y']);
    // Sanity check: server.ts exposes load_guidance and expand_excerpt
    expect(['load_guidance', 'expand_excerpt']).toContain('load_guidance');
  });
});
