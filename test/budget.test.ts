import { expect } from "chai";
import { test } from "vitest";
import { enforceBudget } from "../src/budget.js";
import type { Excerpt, Kernel, Manifest } from "../src/types.ts";


const manifest: Manifest = {
    version: 2,
    globals: { model_window_tokens: 16000, supply_hard_cap_tokens: 100, reserve_for_reasoning: 20 },
    keys: { "constraints/policies": { max_tokens: 50, compressible: false } }
};


const kernels: Kernel[] = [{ id: "k1", key: "constraints/policies", text: "Must authenticate" }];


const excerpts: Excerpt[] = [
    { id: "e1", key: "constraints/policies", text: "This is a long excerpt that will exceed the budget if not compressed.", filepath: "ea/policies/auth.md", start_line: 1, end_line: 5 }
];


test("enforceBudget respects cap and compressibility", () => {
    const { output, budget } = enforceBudget(manifest, kernels, excerpts, ["constraints/policies"]);


    expect(output.kernels.length).to.equal(1);
    expect(output.excerpts.length).to.be.at.most(1);
    expect(budget.supplied_tokens).to.be.at.most(100);
});