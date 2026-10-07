/** Static vendor logos under /public/vendors (id + extension). */
export const VENDOR_LOGO_EXT: Record<string, string> = {
  tapselo: "png",
  "smartbill-pos": "png",
  oblio: "ico",
  ebriza: "png",
  freyapos: "png",
  boogit: "png",
  vilicorest: "png",
  noxta: "ico",
  "pob-soft-retail": "png",
  "selectsoft-retail": "png",
};

export function vendorLogoPath(id: string): string | undefined {
  const ext = VENDOR_LOGO_EXT[id];
  return ext ? `/vendors/${id}.${ext}` : undefined;
}
