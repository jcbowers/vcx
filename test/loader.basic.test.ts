// tests/loader.pure.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 1) In-memory “files”
const VFS: Record<string, string> = {};

// 2) Mock fs BEFORE importing the SUT
vi.mock('fs', () => {
  return {
    readFileSync: (p: string, enc?: string) => {
      const key = p.replace(/\\/g, '/');
      if (!(key in VFS)) throw new Error(`ENOENT: ${key}`);
      return VFS[key];
    },
    existsSync: (p: string) => {
      const key = p.replace(/\\/g, '/');
      return key in VFS;
    }
  };
});

// 3) Now import the SUT (it will use the mocked fs)
import { buildLoader } from '../src/loader';
import type { Manifest, Excerpt } from '../src/types';

// 4) Helpers to seed the virtual files
function seedGuidance(base = '/repo/.guidance') {
  const manifest: Manifest = {
    version: 2,
    globals: {
      model_window_tokens: 16000,
      supply_hard_cap_tokens: 800,
      reserve_for_reasoning: 200,
      default_topk_per_key: 2,
      compression: { target_ratio: 0.5 },
    },
    keys: {
      'constraints/policies': { kernels: ['kernels/guardrails.md'], max_tokens: 300, compressible: false },
      'architecture/views': { kernels: [], max_tokens: 400, compressible: true },
    },
    triggers: {
      tasks: {
        design_review: {
          include_keys: ['constraints/policies','architecture/views'],
          topk_per_key: 2,
          supply_cap_tokens: 800
        }
      }
    }
  };
  const ex: Excerpt[] = [
    { id:'c1', key:'constraints/policies', text:'All DB-reaching API calls must be authenticated.',
      filepath:'ea/constraints/security.md', start_line:10, end_line:12, tags:['constraint','security'], commit:'abc' },
    { id:'v1', key:'architecture/views', text:'Backend behind a WAF. REST APIs must follow proper REST semantics.',
      filepath:'solution/views/runtime.md', start_line:20, end_line:30, tags:['arch','api','waf'], commit:'ghi' },
  ];

  VFS[`${base}/manifest.yaml`] = JSON.stringify(manifest); // YAML.parse will accept plain JSON too
  VFS[`${base}/excerpts.jsonl`] = ex.map(x => JSON.stringify(x)).join('\n');
  VFS[`${base}/kernels/guardrails.md`] = `* All calls must be logged.\n* Idempotent operations must be supported.`;
}

describe('loader.load_guidance (pure unit, no IO)', () => {
  beforeEach(() => {
    // reset in-memory FS
    for (const k of Object.keys(VFS)) delete VFS[k];
    seedGuidance();
  });

  it('returns kernels + ranked excerpts under budget', () => {
    const loader = buildLoader({ guidanceDir: '/repo/.guidance' });
    const out = loader.load_guidance({
      task: 'design_review',
      diff_summary: { touched_paths: ['src/api/todos.ts'], file_extensions: ['.ts'], message: 'scaffold POST /todos' },
      labels: ['api','security'],
      max_tokens: 800
    });

    expect(out.kernels.length).toBeGreaterThan(0);
    expect(out.excerpts.length).toBeGreaterThan(0);
    expect(out.budget.supplied_tokens).toBeLessThanOrEqual(out.budget.cap_tokens);
    // zero side effects: we never wrote to disk
  });
});
