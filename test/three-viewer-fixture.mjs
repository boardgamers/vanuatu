import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { resolve, extname } from "node:path";
export async function serveViewerCheck({ port = 0, published } = {}) {
  await mkdir(".local/qa", { recursive: true });
  await build({
    entryPoints: ["test/three-viewer-harness.js"],
    bundle: true,
    format: "esm",
    outfile: ".local/qa/hosted-check.js",
  });
  const script = published?.viewer.url ?? "/viewer.js",
    style = published?.viewer.dependencies.stylesheets[0] ?? "/viewer.css";
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vanuatu release checks</title><link rel="stylesheet" href="${style}"><style>body{margin:0}#qa{padding:8px;background:#faf5e1}#status{display:block;white-space:pre-wrap;font-size:11px}#game{min-height:90vh}</style><div id="qa"><button data-reset>Reset fixture</button><button data-export>Last export</button><button data-remote>Remote view preference</button><button data-german>Deutsch</button><button data-place>Place next tile</button><output id="status"></output></div><div id="game"></div><script src="${script}"></script><script type="module" src="/qa/hosted-check.js"></script></html>`;
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://local");
      if (url.pathname === "/qa/hosted.html") {
        res.setHeader("Content-Type", "text/html");
        return res.end(html);
      }
      const base = resolve(
        url.pathname.startsWith("/qa/") ? ".local/qa" : "dist",
      );
      const name = url.pathname.startsWith("/qa/")
        ? url.pathname.slice(3)
        : url.pathname === "/"
          ? "/index.html"
          : url.pathname;
      const file = resolve(base, "." + name);
      if (!file.startsWith(base + "/")) throw Error("Invalid path");
      res.setHeader(
        "Content-Type",
        {
          ".js": "text/javascript",
          ".css": "text/css",
          ".html": "text/html",
          ".json": "application/json",
          ".webp": "image/webp",
        }[extname(file)] ?? "application/octet-stream",
      );
      res.setHeader("Cache-Control", "no-store");
      res.end(await readFile(file));
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  await new Promise((resolve) => server.listen(port, "127.0.0.1", resolve));
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
