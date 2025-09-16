import * as path from 'path';
import * as YAML from 'yaml';
import type { BuildLoader, Excerpt, Kernel, LoaderConfig, LoaderInput, LoaderOutput, Manifest } from './types.ts';
import { readJSONLSafe, readTextSafe, join, exists } from './utils/fsx.js';
import { rankTopK } from './ranker.js';
import { enforceBudget } from './budget.js';


function parseManifest(p: string): Manifest {
    const txt = readTextSafe(p);
    if (!txt) throw new Error(`manifest not found at ${p}`);
    const m = YAML.parse(txt) as Manifest;
    if (!m?.globals?.supply_hard_cap_tokens) throw new Error('manifest missing globals');
    return m;
}


function loadKernels(dir: string, manifest: Manifest, keys: string[]): Kernel[] {
    const list: Kernel[] = [];
    for (const key of keys) {
        const kfiles = manifest.keys[key]?.kernels ?? [];
        for (const rel of kfiles) {
            const file = join(dir, rel.startsWith('kernels/') ? rel : path.join('kernels', rel));
            const text = readTextSafe(file) ?? '';
            const id = `${key}#${path.basename(rel)}`;
            if (text.trim().length > 0) list.push({ id, key, text, source: rel });
        }
    }
    return list;
}


function selectKeys(manifest: Manifest, input: LoaderInput): { keys: string[]; topk: number; cap: number } {
    const t = manifest.triggers?.tasks?.[input.task];
    const keys = t?.include_keys ?? Object.keys(manifest.keys);
    const topk = t?.topk_per_key ?? manifest.globals.default_topk_per_key ?? 2;
    const cap = t?.supply_cap_tokens ?? manifest.globals.supply_hard_cap_tokens;
    return { keys, topk, cap };
}


export function buildLoader(config: LoaderConfig) : BuildLoader {
    const base = config.guidanceDir;
    const manifest = parseManifest(join(base, 'manifest.yaml'));
    const allExcerpts = (readJSONLSafe<Excerpt>(join(base, 'excerpts.jsonl'))).map((e) => ({ ...e, text: e.text || '' }));


    function load_guidance(input: LoaderInput): LoaderOutput {
        const { keys, topk, cap } = selectKeys(manifest, input);


        // Always include kernels for selected keys
        const kernels = loadKernels(base, manifest, keys);


        // Filter candidates to selected keys
        const candidateExcerpts = allExcerpts.filter(e => keys.includes(e.key));


        // Rank and pick top-K per key
        const ranked = rankTopK(candidateExcerpts, { manifest, input, selectedKeys: keys }, topk);


        // Enforce budget (kernels first)
        const { output, budget, droppedKeys } = enforceBudget(
            { ...manifest, globals: { ...manifest.globals, supply_hard_cap_tokens: cap } },
            kernels,
            ranked,
            keys
        );


        const citations = output.excerpts.map(e => ({ id: e.id, filepath: e.filepath, commit: e.commit, start_line: e.start_line, end_line: e.end_line }));


        return { kernels: output.kernels, excerpts: output.excerpts, citations, budget, debug: { selected_keys: keys, dropped_keys: droppedKeys } };
    }


    function expand_excerpt(args: { id: string; context_lines?: number }): { text: string } {
        const { id, context_lines = 60 } = args;
        const ex = allExcerpts.find(e => e.id === id);
        if (!ex) throw new Error(`excerpt not found: ${id}`);


        // Expect a read-only mirror at .guidance/mirror/<filepath>
        const mirrorPath = join(base, 'mirror', ex.filepath);
        if (!exists(mirrorPath)) {
            throw new Error(`mirror not found for ${ex.filepath}. Mount .guidance/mirror at pinned commit to enable expand_excerpt.`);
        }

        const content = readTextSafe(mirrorPath) || '';
        const lines = content.split('\n');
        // For now, just return the whole content as text (or implement context_lines logic as needed)
        return { text: content };
    }

    // Return the loader function(s) as required by BuildLoader type
    return {
        manifest,
        load_guidance,
        expand_excerpt
    };
}