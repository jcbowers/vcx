// src/budget.ts
import type { Excerpt, Kernel, LoaderOutput, Manifest } from './types.js';
import { estimateTokens } from './utils/tokenize.js';
import { compressExtractive } from './utils/compress.js';

// Enforce overall cap and per-key caps, with kernels first. Never compress kernels.
// Respect non_compressible excerpts (e.g., constraints/policies).
export function enforceBudget(
  manifest: Manifest,
  kernels: Kernel[],
  excerpts: Excerpt[],
  selectedKeys: string[]
): {
  output: { kernels: Kernel[]; excerpts: Excerpt[] };
  budget: LoaderOutput['budget'];
  droppedKeys: string[];
} {
  const cap = manifest.globals.supply_hard_cap_tokens;
  const reserve = manifest.globals.reserve_for_reasoning;
  const effectiveCap = Math.max(100, cap - reserve);

  // Cost starts with kernels
  let cost = kernels.reduce((sum, k) => sum + estimateTokens(k.text), 0);

  // Per-key caps
  const perKeyMax: Record<string, number> = {};
  for (const key of selectedKeys) {
    perKeyMax[key] = manifest.keys[key]?.max_tokens ?? Math.floor(effectiveCap / Math.max(1, selectedKeys.length));
  }

  const out: Excerpt[] = [];
  const droppedKeys: string[] = [];
  const ratio = manifest.globals.compression?.target_ratio ?? 0.45;

  // Iterate keys in the requested order to honor priority
  for (const key of selectedKeys) {
    const keyEx = excerpts.filter((e) => e.key === key);
    if (keyEx.length === 0) {
      droppedKeys.push(key);
      continue;
    }

    let usedKey = 0;
    const keyCap = perKeyMax[key];

    for (const ex of keyEx) {
      // Try full text first
      let text = ex.text;
      let tokens = estimateTokens(text);

      if (usedKey + tokens > keyCap || cost + tokens > effectiveCap) {
        // Try compression if allowed
        const compressible = (manifest.keys[key]?.compressible ?? true) && !ex.non_compressible;
        if (compressible) {
          const compressed = compressExtractive(text, ratio);
          const compTokens = estimateTokens(compressed);

          if (usedKey + compTokens <= keyCap && cost + compTokens <= effectiveCap) {
            out.push({ ...ex, text: compressed });
            usedKey += compTokens;
            cost += compTokens;
            continue;
          }
        }
        // If can't fit even after compression (or not allowed), skip this excerpt
        continue;
      }

      // Fits as-is
      out.push(ex);
      usedKey += tokens;
      cost += tokens;

      if (cost >= effectiveCap) break;
    }

    if (usedKey === 0) droppedKeys.push(key);
    if (cost >= effectiveCap) break;
  }

  const budget: LoaderOutput['budget'] = {
    supplied_tokens: cost,
    cap_tokens: cap,
    reserved_for_reasoning: reserve,
  };

  return { output: { kernels, excerpts: out }, budget, droppedKeys };
}
