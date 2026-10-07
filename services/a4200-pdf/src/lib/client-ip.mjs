export function trustProxyEnabled() {
  return process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true";
}

export function clientIp(req) {
  if (trustProxyEnabled()) {
    const fwd = req.headers["x-forwarded-for"];
    if (typeof fwd === "string" && fwd.length) {
      const parts = fwd.split(",").map((s) => s.trim()).filter(Boolean);
      if (parts.length) return parts[parts.length - 1];
    }
  }
  return req.socket?.remoteAddress ?? "unknown";
}
