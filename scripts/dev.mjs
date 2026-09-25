import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, extname } from "node:path";
const root = resolve("dist");
const port = Number(process.env.PORT ?? 5246);
createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://local");
    const path = resolve(
      root,
      "." + (url.pathname === "/" ? "/index.html" : url.pathname),
    );
    if (!path.startsWith(root + "/")) throw Error();
    const data = await readFile(path);
    res.writeHead(200, {
      "Content-Type":
        {
          ".html": "text/html",
          ".js": "text/javascript",
          ".css": "text/css",
          ".webp": "image/webp",
        }[extname(path)] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}).listen(port, "127.0.0.1", () =>
  console.log(`Vanuatu: http://127.0.0.1:${port}`),
);
