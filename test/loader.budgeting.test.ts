// tests/budgeting.pure.test.ts
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

function seed(base='/g/.guidance') {
  const manifest: Manifest = {
    version: 2,
    globals: { model_window_tokens: 8000, supply_hard_cap_tokens: 300, reserve_for_reasoning: 100, default_topk_per_key: 2, compression:{target_ratio:0.4} },
    keys: {
      'constraints/policies': { kernels: ['kernels/min.md'], max_tokens: 150, compressible: false },
      'architecture/views': { kernels: [], max_tokens: 120, compressible: true },
    }
  };
  const big = 'A'.repeat(2000); // large excerpt to force compression
  const ex: Excerpt[] = [
    { id:'nc1', key:'constraints/policies', text:'All DB-reaching API calls must be authenticated.',
      filepath:'ea/sec.md', start_line:1, end_line:3, tags:['constraint'], commit:'sha1', non_compressible:true },
    { id:'c3', key:'architecture/views', text:big, filepath:'sol/huge.md', start_line:1, end_line:200, tags:['arch'], commit:'sha3' },
  ];
  VFS[`${base}/manifest.yaml`] = JSON.stringify(manifest);
  VFS[`${base}/excerpts.jsonl`] = ex.map(x=>JSON.stringify(x)).join('\n');
  VFS[`${base}/kernels/min.md`] = 'Guardrails min.';
}

describe('budgeting with non-compressible constraints', () => {
  beforeEach(() => { for (const k of Object.keys(VFS)) delete VFS[k]; seed(); });
  it('keeps constraints verbatim and compresses others to fit cap', () => {
    const loader = buildLoader({ guidanceDir: '/g/.guidance' });
    const out = loader.load_guidance({ task: 'design_review' });
    const constraints = out.excerpts.filter(e => e.key === 'constraints/policies');
    expect(constraints.length).greaterThan(0);
    // non-compressible constraint text should be unchanged
    expect(constraints[0].text).toContain('must be authenticated');
    // budget respected
    expect(out.budget.supplied_tokens).toBeLessThanOrEqual(out.budget.cap_tokens);
  });
});
