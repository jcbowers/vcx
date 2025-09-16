import { test, expect } from "vitest";
import { rankTopK } from "../src/ranker.js";
import type { Excerpt, LoaderInput, Manifest } from "../src/types.ts";


const manifest: Manifest = {
    version: 2,
    globals: { model_window_tokens: 16000, supply_hard_cap_tokens: 3600, reserve_for_reasoning: 1200 },
    keys: { "constraints/policies": {}, "architecture/views": {} }
};


const input: LoaderInput = { task: "design_review", labels: ["api"], diff_summary: { touched_paths: ["src/api/todos.ts"], file_extensions: [".ts"] } };


const excerpts: Excerpt[] = [
    { id: "e1", key: "constraints/policies", text: "policy text", filepath: "ea/policies/log.md", start_line: 1, end_line: 2 },
    { id: "e2", key: "architecture/views", text: "view text", filepath: "solution/views/backend.md", start_line: 3, end_line: 4 }
];


test("rankTopK selects topK excerpts per key", () => {
    const ranked = rankTopK(excerpts, { manifest, input, selectedKeys: ["constraints/policies", "architecture/views"] }, 1);
    expect(ranked.length).toBe(2);
    expect(ranked.find(e => e.key === "constraints/policies")).toBeTruthy();
});