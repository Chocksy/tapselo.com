import type { Connect } from "vite";
import { handleAnafCuiGet } from "./proxy.ts";
import { AnafRequestThrottle } from "./throttle.ts";

const throttle = new AnafRequestThrottle();

function anafCuiMiddleware(): Connect.NextHandleFunction {
  return (req, res, next) => {
    const url = req.url ?? "";
    const match = url.match(/^\/api\/anaf\/cui\/([^/?]+)/);
    if (!match) {
      next();
      return;
    }
    void (async () => {
      try {
        const response = await handleAnafCuiGet(
          new Request(`http://127.0.0.1${url}`, { method: req.method ?? "GET" }),
          decodeURIComponent(match[1]),
          { fetch: globalThis.fetch.bind(globalThis), throttle },
        );
        res.statusCode = response.status;
        response.headers.forEach((value, key) => {
          if (key.toLowerCase() === "transfer-encoding") return;
          res.setHeader(key, value);
        });
        const body = await response.text();
        res.end(body);
      } catch (err) {
        console.error("anaf-cui dev proxy", err);
        res.statusCode = 503;
        res.setHeader("Content-Type", "application/json; charset=utf-8");
        res.end(JSON.stringify({ error: "ANAF indisponibil. Încearcă din nou peste câteva minute.", code: "anaf_unavailable" }));
      }
    })();
  };
}

/** Astro/Vite dev + preview: serve GET /api/anaf/cui/:cui without Cloudflare Pages Functions. */
export function anafCuiDevProxyPlugin() {
  const attach = (middlewares: Connect.Server) => {
    middlewares.use(anafCuiMiddleware());
  };
  return {
    name: "anaf-cui-dev-proxy",
    configureServer(server: { middlewares: Connect.Server }) {
      attach(server.middlewares);
    },
    configurePreviewServer(server: { middlewares: Connect.Server }) {
      attach(server.middlewares);
    },
  };
}
