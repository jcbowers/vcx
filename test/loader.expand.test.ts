// tests/expand.pure.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
const VFS: Record<string, string> = {};
vi.mock('fs', () => ({
  readFileSync: (p: string) => {
    const key = p.replace(/\\/g, '/');
    if (!(key in VFS)) throw new Error(`ENOENT: ${key}`);
    return VFS[key];
  },
  existsSync: (p: string) => (p.replace(/\\/g,'/') in VFS),
}));
import { buildLoader } from '../src/loader';
import type { Manifest, Excerpt } from '../src/types';

function seed(base='/x/.guidance') {
  const manifest: Manifest = {
    version: 2,
    globals: { model_window_tokens: 8000, supply_hard_cap_tokens: 400, reserve_for_reasoning: 100 },
    keys: { a: { kernels: [] } },
    triggers: { tasks: { t: { include_keys: ['a'] } } }
  };
  const ex: Excerpt = { id:'e1', key:'a', text:'snippet', filepath:'ea/doc.md', start_line:3, end_line:3 };
  VFS[`${base}/manifest.yaml`] = JSON.stringify(manifest);
  VFS[`${base}/excerpts.jsonl`] = JSON.stringify(ex) + '\n';
  // Mirror content for expand
  VFS[`${base}/mirror/ea/doc.md`] = `line1\nline2\nline3\nline4\nline5`;
}

describe('expand_excerpt (virtual mirror)', () => {
  beforeEach(() => { for (const k of Object.keys(VFS)) delete VFS[k]; seed(); });
  it('returns surrounding text from mirror', () => {
    const loader = buildLoader({ guidanceDir: '/x/.guidance' });
    const res = loader.expand_excerpt({ id: 'e1', context_lines: 1 });
    expect(res.text).toContain('line2');
    expect(res.text).toContain('line3');
    expect(res.text).toContain('line4');
  });
});
