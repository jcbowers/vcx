#!/usr/bin/env node
// Minimal MCP-style stdio server exposing two tools: load_guidance & expand_excerpt
// This is a pragmatic JSON-RPC-ish loop to keep things dependency-light.
// If you later adopt an official MCP SDK, replace only this file; keep loader logic intact.


import * as readline from 'readline';
import * as process from 'process';
import { buildLoader } from './loader.js';
import type { LoaderInput } from './types.ts';


const GUIDANCE_DIR = process.env.GUIDANCE_DIR || '.guidance';
const loader = buildLoader({ guidanceDir: GUIDANCE_DIR });


// Simple protocol:
// { id, method: 'load_guidance'|'expand_excerpt'|'ping'|'capabilities', params: {...} }
// Response: { id, result } or { id, error }


const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: false });


function respond(id: any, payload: any) {
    const out = JSON.stringify(payload);
    process.stdout.write(out + '');
}


rl.on('line', (line) => {
    let msg: any;
    try { msg = JSON.parse(line); } catch {
        respond(null, { id: null, error: { code: -32700, message: 'Parse error' } });
        return;
    }


    const { id, method, params } = msg || {};
    try {
        if (method === 'ping') return respond(id, { id, result: 'pong' });
        if (method === 'capabilities') {
            return respond(id, {
                id, result: {
                    tools: [
                        { name: 'load_guidance', params: ['task', 'diff_summary?', 'labels?', 'max_tokens?'] },
                        { name: 'expand_excerpt', params: ['id', 'context_lines?'] }
                    ],
                    manifest_keys: Object.keys(loader.manifest.keys)
                }
            });
        }
        if (method === 'load_guidance') {
            const result = loader.load_guidance(params as LoaderInput);
            return respond(id, { id, result });
        }
        if (method === 'expand_excerpt') {
            const result = loader.expand_excerpt(params as { id: string; context_lines?: number });
            return respond(id, { id, result });
        }
        return respond(id, { id, error: { code: -32601, message: `Method not found: ${method}` } });
    } catch (err: any) {
        return respond(id, { id, error: { code: -32000, message: err?.message || 'Internal error' } });
    }
});


process.on('SIGINT', () => process.exit(0));