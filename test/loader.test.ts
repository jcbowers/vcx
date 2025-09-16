// tests/loader.pure.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- In-memory VFS and fs mock (no real disk) ---
const VFS: Record<string, string> = {};
vi.mock('fs', () => ({
  readFileSync: (p: string) => {
    const key = p.replace(/\\/g, '/');
    if (!(key in VFS)) throw new Error(`ENOENT: ${key}`);
    return VFS[key];
  },
  existsSync: (p: string) => VFS.hasOwnProperty(p.replace(/\\/g, '/')),
}));

// Important: import SUT *after* the mock
import { buildLoader } from '../src/loader';
import type { Manifest, Excerpt } from '../src/types';

const GUIDANCE = '/vfs/.guidance';

function seedVfs() {
  // YAML parser accepts JSON too; easier fixtures, still exercises the YAML path
  const manifest: Manifest = {
    version: 2,
    globals: {
      model_window_tokens: 16000,
      supply_hard_cap_tokens: 3600,
      reserve_for_reasoning: 1200,
      default_topk_per_key: 2,
      compression: { target_ratio: 0.5 },
    },
    keys: {
      'constraints/policies': { kernels: ['kernels/auth.md'], compressible: false, max_tokens: 800 },
      'architecture/views':   { kernels: [],                 compressible: true,  max_tokens: 1200 },
    },
    triggers: {
      tasks: {
        design_review: {
          include_keys: ['constraints/policies','architecture/views'],
          topk_per_key: 2,
          supply_cap_tokens: 3600,
        },
      },
    },
  };

  const excerpts: Excerpt[] = [
    {
      id: 'ex1',
      key: 'constraints/policies',
      text: 'All calls must be logged.',
      filepath: 'ea/policies/logging.md',
      start_line: 1,
      end_line: 2,
      commit: 'abc123',
      tags: ['constraint','logging'],
      non_compressible: true,
    },
    {
      id: 'ex2',
      key: 'architecture/views',
      text: 'Backend will be a REST API behind a WAF.',
      filepath: 'solution/views/backend.md',
      start_line: 10,
      end_line: 12,
      commit: 'abc123',
      tags: ['arch','api','waf'],
    },
  ];

  VFS[`${GUIDANCE}/manifest.yaml`] = JSON.stringify(manifest);
  VFS[`${GUIDANCE}/excerpts.jsonl`] = excerpts.map(e => JSON.stringify(e)).join('\n');
  VFS[`${GUIDANCE}/kernels/auth.md`] = 'All DB-reaching API calls must be authenticated.';
}

describe('loader.load_guidance (pure unit, no IO)', () => {
  beforeEach(() => {
    for (const k of Object.keys(VFS)) delete VFS[k];
    seedVfs();
  });

  it('returns kernels and excerpts with budget enforcement', () => {
    const loader = buildLoader({ guidanceDir: GUIDANCE });

    const result = loader.load_guidance({
      task: 'design_review',
      diff_summary: {
        touched_paths: ['src/api/todos.ts'],
        file_extensions: ['.ts'],
        message: 'scaffold POST /todos',
      },
      labels: ['api'],
      max_tokens: 2000,
    });

    expect(result.kernels.length).toBe(1);
    expect(result.kernels[0].text).toMatch(/authenticated/i);

    expect(result.excerpts.length).toBeGreaterThan(0);
    expect(result.citations[0]).toHaveProperty('filepath');
    // overall hard cap for task is 3600 (reserve is enforced inside loader/budget)
    expect(result.budget.supplied_tokens).toBeLessThanOrEqual(result.budget.cap_tokens);
    expect(result.budget.cap_tokens).toBe(3600);
  });

  it('expand_excerpt fails when no mirror present', () => {
    const loader = buildLoader({ guidanceDir: GUIDANCE });
    expect(() => loader.expand_excerpt({ id: 'ex1' })).toThrow(/mirror not found/i);
  });
});
