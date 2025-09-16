// src/ranker.ts
import type { Excerpt, LoaderInput, Manifest } from './types.js';

export type RankContext = {
  manifest: Manifest;
  input: LoaderInput;
  selectedKeys: string[];
};

function setOf<T extends string>(arr?: T[]) {
  return new Set((arr ?? []).map((x) => x.toLowerCase()));
}

export function scoreExcerpt(ex: Excerpt, ctx: RankContext): number {
  const w = ctx.manifest.scoring?.weights ?? {};
  const labels = setOf(ctx.input.labels);
  const tags = setOf(ex.tags);
  const touchedPaths = ctx.input.diff_summary?.touched_paths ?? [];
  const inputExts = setOf(ctx.input.diff_summary?.file_extensions as string[] | undefined);

  let score = 0;

  // Tag overlap (labels vs excerpt tags)
  for (const l of Array.from(labels)) {
    if (tags.has(l)) score += w['tag_overlap'] ?? 2.5;
  }

  // Path match: same top-level directory touched
  for (const p of touchedPaths) {
    const a = ex.filepath.split('/')[0] || '';
    const b = (p || '').split('/')[0] || '';
    if (a && a === b) {
      score += w['path_match'] ?? 2.0;
      break;
    }
  }

  // File extension match
  const exExt = ex.filepath.match(/\.[^.]+$/)?.[0]?.toLowerCase();
  if (exExt && inputExts.has(exExt)) score += w['filetype_match'] ?? 1.0;

  // Recency boost (simple half-life-ish)
  if (ex.last_modified) {
    const days = (Date.now() - Date.parse(ex.last_modified)) / (1000 * 60 * 60 * 24);
    if (isFinite(days) && days <= 180) score += w['recency_boost'] ?? 0.5;
  }

  // Owner trust (light, optional)
  if (ex.owner && /arch|platform/i.test(ex.owner)) score += w['owner_trust'] ?? 0.4;

  return score;
}

export function rankTopK(excerpts: Excerpt[], ctx: RankContext, topKPerKey: number): Excerpt[] {
  // Group by key and rank within each key
  const byKey = new Map<string, Excerpt[]>();
  for (const ex of excerpts) {
    if (!ctx.selectedKeys.includes(ex.key)) continue;
    const arr = byKey.get(ex.key);
    if (arr) arr.push(ex);
    else byKey.set(ex.key, [ex]);
  }

  const out: Excerpt[] = [];
  for (const key of ctx.selectedKeys) {
    const arr = (byKey.get(key) ?? []).slice();
    arr.sort((a, b) => scoreExcerpt(b, ctx) - scoreExcerpt(a, ctx));
    out.push(...arr.slice(0, topKPerKey));
  }
  return out;
}
