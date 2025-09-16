// src/utils/fsx.ts
import * as fs from 'fs';
import * as path from 'path';

export function readTextSafe(p: string): string | null {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return null;
  }
}

export function readJSONLSafe<T = any>(p: string): T[] {
  const txt = readTextSafe(p);
  if (!txt) return [];
  const lines = txt.split(/\r?\n/).filter(Boolean);
  return lines.map((line, i) => {
    try {
      return JSON.parse(line) as T;
    } catch {
      throw new Error(`Invalid JSONL at ${p}:${i + 1}`);
    }
  });
}

export function join(...parts: string[]) {
  return path.join(...parts);
}

export function exists(p: string) {
  return fs.existsSync(p);
}
