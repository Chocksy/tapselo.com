import { ID_RE } from "./render.ts";

export const DELETE_SECRET_RE = /^[A-Za-z0-9_-]{16,64}$/;

export type DeleteDraftRpc = (
  fn: string,
  args: Record<string, unknown>,
) => Promise<{ ok: boolean; kind?: string; message?: string; data?: unknown }>;

/** Calls `public_tool_delete_draft` when the secret matches. */
export async function deletePublicDraft(
  id: string,
  deleteSecret: string,
  rpc: DeleteDraftRpc,
): Promise<{ ok: true } | { ok: false; status: 400 | 404 | 503; message: string }> {
  if (!ID_RE.test(id)) return { ok: false, status: 404, message: "Documentul nu a fost găsit." };
  if (!DELETE_SECRET_RE.test(deleteSecret)) {
    return { ok: false, status: 400, message: "Secretul de ștergere nu este valid." };
  }
  const res = await rpc("public_tool_delete_draft", { p_id: id, p_delete_secret: deleteSecret });
  if (!res.ok) {
    if (res.kind === "rejected") {
      const msg = (res.message ?? "").toLowerCase();
      if (msg.includes("secret") || msg.includes("parol")) {
        return { ok: false, status: 404, message: "Documentul nu a fost găsit sau secretul este greșit." };
      }
      return { ok: false, status: 404, message: "Documentul nu a fost găsit." };
    }
    return { ok: false, status: 503, message: "Ștergerea nu este disponibilă acum. Încearcă din nou peste câteva minute." };
  }
  const deleted = res.data === true || res.data === "true" || res.data === 1;
  if (!deleted) return { ok: false, status: 404, message: "Documentul nu a fost găsit sau secretul este greșit." };
  return { ok: true };
}
