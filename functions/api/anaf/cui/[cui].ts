/**
 * GET /api/anaf/cui/{cui} — cached ANAF PlatitorTvaRest v9 proxy (24h), 1 req/s toward ANAF.
 */

import {
  handleAnafCuiGet,
  todayIsoBucharest,
} from "../../../../src/lib/cui-anaf/proxy.ts";
import { AnafRequestThrottle } from "../../../../src/lib/cui-anaf/throttle.ts";

const throttle = new AnafRequestThrottle();

export async function onRequest(context: {
  request: Request;
  params: Record<string, string | string[]>;
}): Promise<Response> {
  const raw = Array.isArray(context.params.cui) ? context.params.cui[0] : context.params.cui;
  const cache = caches.default;
  const today = todayIsoBucharest();
  return handleAnafCuiGet(context.request, raw, {
    fetch: globalThis.fetch.bind(globalThis),
    throttle,
    today,
    cache,
  });
}
