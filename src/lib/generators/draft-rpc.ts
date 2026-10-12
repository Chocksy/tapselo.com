import { ID_RE } from "./render.ts";

export interface CreateDraftRpcResult {
  id: string;
  delete_secret: string | null;
}

/** Parses `public_tool_create_draft` return (legacy text id or `{ id, delete_secret }`). */
export function parseCreateDraftRpc(data: unknown): CreateDraftRpcResult | null {
  if (typeof data === "string") {
    const id = data.trim();
    return ID_RE.test(id) ? { id, delete_secret: null } : null;
  }
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const o = data as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    if (!ID_RE.test(id)) return null;
    const secret = typeof o.delete_secret === "string" ? o.delete_secret.trim() : null;
    return { id, delete_secret: secret && /^[A-Za-z0-9_-]{16,64}$/.test(secret) ? secret : null };
  }
  if (Array.isArray(data) && data.length) return parseCreateDraftRpc(data[0]);
  return null;
}

export function deleteDraftRpcArgs(id: string, deleteSecret: string): Record<string, unknown> {
  return { p_id: id, p_delete_secret: deleteSecret };
}
