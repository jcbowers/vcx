# vcx — Guidance Loader MCP Utility

`vcx` is a lightweight [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that deterministically injects **enterprise architecture** and **solution architecture** guidance into LLM coding agents.  
It does **not** guess — it fetches, ranks, budgets, and compresses pinned context from a project’s `.guidance/` directory.

Think of it as the **context loader** that keeps your agents “between the lines.”

---

## Features
- **Two tools exposed to MCP clients**:
  - `load_guidance` — return kernels + excerpts + citations under token budget.
  - `expand_excerpt` — expand a pinned excerpt to show surrounding context.
- Deterministic: no hidden LLM calls; same inputs → same outputs.
- Budget enforcement: global cap + per-key caps + reserved reasoning tokens.
- Extractive compression (bullets/sentences) for compressible sections.
- Verbatim inclusion of non-compressible guardrails (e.g. policies).
- Side-effect free, unit-tested with mocked FS (FIRST principles).
- Deploy once, consume everywhere via npm.

---

## Installation

```bash
npm install --save-dev vcx
# or
pnpm add -D vcx

The package ships a CLI named vcx:

npx vcx

Project requirements

Each feature repo that uses vcx must have a .guidance/ directory:

.guidance/
  manifest.yaml        # defines keys, caps, and tasks
  excerpts.jsonl       # pinned, chunked slices from EA/Solution docs
  kernels/             # always-include guardrails (markdown)
  mirror/              # optional, full files for expand_excerpt

Minimal example:

# .guidance/manifest.yaml
version: 2
globals:
  model_window_tokens: 16000
  supply_hard_cap_tokens: 800
  reserve_for_reasoning: 200
keys:
  constraints/policies:
    kernels: ["kernels/guardrails.md"]
    max_tokens: 300
    compressible: false
  architecture/views:
    max_tokens: 400
    compressible: true
triggers:
  tasks:
    design_review:
      include_keys: ["constraints/policies","architecture/views"]
      topk_per_key: 2
      supply_cap_tokens: 800
```
## Usage
Run server (stdio JSON-RPC)

```
GUIDANCE_DIR=.guidance npx vcx
```

The process waits on stdin for JSON-RPC requests.

### Ping
```
printf '{"id":1,"method":"ping"}\n' | GUIDANCE_DIR=.guidance npx vcx
```

### Capabilities
```
printf '{"id":2,"method":"capabilities"}\n' | GUIDANCE_DIR=.guidance npx vcx
```

### Load guidance

```
printf '{"id":3,"method":"load_guidance","params":{
  "task":"design_review",
  "diff_summary":{"touched_paths":["src/api/todos.ts"],"file_extensions":[".ts"],"message":"scaffold POST /todos"},
  "labels":["api","security"],
  "max_tokens":800
}}\n' | GUIDANCE_DIR=.guidance npx vcx
```

### Expand excerpt
```
printf '{"id":4,"method":"expand_excerpt","params":{"id":"c1","context_lines":2}}\n' | GUIDANCE_DIR=.guidance npx vcx
```

## Integrating with MCP clients
Configure your MCP-aware IDE/agent (Copilot Agents, Cursor, Claude Desktop, etc.) to spawn:

command: npx
args: ["vcx"]
env: { "GUIDANCE_DIR": "<workspace>/.guidance" }


Your agent can now call:

load_guidance at branch start, file open, or chat start.

expand_excerpt when devs request “show more” for a citation.

## Development
Clone and build

```
git clone https://github.com/yourorg/vcx.git
cd vcx
npm install
npm run build

Run tests
npm test
```

Unit tests are side-effect free — all FS is mocked with an in-memory VFS.

## Clean
npm run clean:src

## License

Jason Bowers © 2025 - All Rights Reserved 


