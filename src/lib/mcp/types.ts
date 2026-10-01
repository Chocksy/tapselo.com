// Shared contract for MCP tools (answer tools in src/lib/mcp/answers, generators in src/lib/generators).
// Pure types: safe under node --test type stripping (use `import type`).

export interface ToolEnv {
  /** Calls the Supabase RPC with the anon key; injected so tests can stub it. */
  rpc: <T>(fn: string, args: Record<string, unknown>) => Promise<
    { ok: true; data: T } | { ok: false; kind: string; message: string }
  >;
  /** fetch, injected so tests can stub outside APIs (ANAF, BNR, Open Food Facts). */
  fetch: typeof fetch;
}

export interface ToolResult {
  /** Romanian markdown shown to the model. */
  text: string;
  structured?: Record<string, unknown>;
  isError?: boolean;
}

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: boolean;
  };
  handler: (args: Record<string, unknown>, env: ToolEnv) => Promise<ToolResult>;
}
