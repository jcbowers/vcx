// src/utils/tokenize.ts
// Simple deterministic token estimator (~4 chars/token). Fast and stable.
export function estimateTokens(text: string): number {
  if (!text) return 0;
  const chars = text.replace(/\s+/g, ' ').length;
  return Math.max(1, Math.ceil(chars / 4));
}
