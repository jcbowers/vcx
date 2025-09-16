// src/types.ts
export type LoaderConfig = {
  guidanceDir: string; // path to .guidance directory
};

export type LoaderInput = {
  task: string;
  diff_summary?: {
    touched_paths?: string[];   // repo-relative paths (e.g., ["src/api/todos.ts"])
    file_extensions?: string[]; // e.g., [".ts", ".py"]
    message?: string;           // first commit message or brief intent
  };
  labels?: string[];            // e.g., ["api","security"]
  max_tokens?: number;          // optional cap override
};

export type BuildLoader = {
    manifest: Manifest;
    load_guidance: (input: LoaderInput) => any;
    expand_excerpt: (params: { id: string; context_lines?: number }) => any;
};

export type Kernel = {
  id: string;
  key: string;
  text: string;
  source?: string;              // relative path inside .guidance (for provenance)
};

export type Excerpt = {
  id: string;                   // stable id (e.g., hash)
  key: string;                  // logical bucket resolved at build time
  text: string;
  filepath: string;             // source path in EA/Solution repo
  start_line: number;
  end_line: number;
  tags?: string[];
  last_modified?: string;       // ISO date
  commit?: string;              // pinned SHA
  owner?: string;
  non_compressible?: boolean;   // e.g., constraints/policies
  score_features?: Partial<Record<string, number>>; // optional debug features
};

export type LoaderOutput = {
  kernels: Kernel[];
  excerpts: Excerpt[];
  citations: Array<{
    id: string;
    filepath: string;
    commit?: string;
    start_line: number;
    end_line: number;
  }>;
  budget: {
    supplied_tokens: number;
    cap_tokens: number;
    reserved_for_reasoning: number;
  };
  debug?: { selected_keys: string[]; dropped_keys?: string[] };
};

export type Manifest = {
  version: number;
  globals: {
    model_window_tokens: number;
    supply_hard_cap_tokens: number;  // max tokens we supply so model has room to think
    reserve_for_reasoning: number;   // tokens reserved for the model
    default_chunk_tokens?: number;
    default_topk_per_key?: number;
    compression?: { target_ratio?: number };
  };
  scoring?: {
    weights?: Record<string, number>;
    gate?: { min_score?: number };
  };
  keys: Record<
    string,
    {
      include?: string[];       // globs at build time (for documentation; not used at runtime)
      tags?: string[];
      kernels?: string[];       // paths relative to .guidance/kernels/
      max_tokens?: number;      // per-key cap
      compressible?: boolean;   // default true
    }
  >;
  triggers?: {
    tasks?: Record<
      string,
      {
        include_keys: string[];
        decision_phase?: string;
        hard_pins?: string[];
        diff_sensitive?: boolean;
        require_tags_any?: string[];
        topk_per_key?: number;
        supply_cap_tokens?: number;
      }
    >;
    diff?: {
      path_rules?: Array<{
        when_path_matches: string; // regex
        boost_keys?: string[];
        add_tag?: string;
      }>;
      filetype_rules?: Array<{
        when_ext_in: string[];
        boost_keys?: string[];
        add_tag?: string;
      }>;
    };
    labels?: Record<string, { task: string }>;
  };
  budgeting?: {
    policy?: { allocate_evenly?: boolean; priority_order?: string[] };
    overflow?: { compress_lowest_scoring_first?: boolean; drop_if_still_over?: string[] };
  };
};
