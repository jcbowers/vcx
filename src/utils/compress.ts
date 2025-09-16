// src/utils/compress.ts
import { estimateTokens } from './tokenize.js';

// Deterministic extractive compression:
// 1) Keep leading sentences until target ratio is reached
// 2) Then keep leading bullet lines ( -/*/• ) if room remains
export function compressExtractive(text: string, targetRatio = 0.45): string {
  const target = Math.max(20, Math.floor(estimateTokens(text) * targetRatio));
  const lines = text.split(/\r?\n/);
  const sentences = text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);

  const bullets = lines.filter((l) => /^\s*[-*•]/.test(l));

  const acc: string[] = [];
  let tokens = 0;

  for (const s of sentences) {
    const t = estimateTokens(s);
    if (tokens + t > target) break;
    acc.push(s);
    tokens += t;
  }

  for (const b of bullets) {
    const t = estimateTokens(b);
    if (tokens + t > target) break;
    acc.push(b);
    tokens += t;
  }

  const out = acc.join('\n');
  // Fallback: if we somehow produced nothing, return first few sentences.
  return out.length > 0 ? out : sentences.slice(0, 3).join(' ');
}
