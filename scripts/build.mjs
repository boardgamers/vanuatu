import { build } from "esbuild";
import { mkdir, writeFile, readdir, readFile } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await build({
  entryPoints: ["engine/index.js"],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  outfile: "dist/engine.js",
});
for (const [entry, format] of [
  ["viewer/index.js", "iife"],
  ["viewer/preview.js", "esm"],
])
  await build({
    entryPoints: [entry],
    bundle: true,
    platform: "browser",
    format,
    target: "es2022",
    outfile: entry.endsWith("preview.js")
      ? "dist/preview.js"
      : "dist/viewer.js",
    define: {
      __BGS_LOCALE_BASE__: "__bgsVanuatuLocaleBase",
      __BGS_ASSET_BASE__: "__bgsVanuatuAssetBase",
    },
    banner: {
      js:
        "var __bgsVanuatuAssetBase = " +
        (format === "iife"
          ? 'new URL("./", document.currentScript?.src || document.baseURI).href; var __bgsVanuatuLocaleBase = new URL("locales/", __bgsVanuatuAssetBase).href;'
          : 'new URL("./", import.meta.url).href; var __bgsVanuatuLocaleBase = new URL("locales/", __bgsVanuatuAssetBase).href;'),
    },
    plugins: [
      {
        name: "relative-artwork",
        setup(build) {
          build.onLoad({ filter: /\.webp$/ }, (args) => {
            if (args.suffix === "?bgs-file") return;
            return {
              contents: `import file from ${JSON.stringify(args.path + "?bgs-file")}; export default new URL(file, __BGS_ASSET_BASE__).href;`,
              loader: "js",
            };
          });
        },
      },
    ],
    assetNames: "assets/[name]-[hash]",
    loader: { ".webp": "file" },
    minify: true,
  });
await writeFile(
  "dist/index.html",
  '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Vanuatu · Local practice</title><link rel="stylesheet" href="preview.css"><body><div id="game"></div><script type="module" src="preview.js"></script></body></html>',
);

await mkdir("dist/locales", { recursive: true });
for (const file of await readdir("viewer/localization")) {
  if (file.endsWith(".json") && file !== "en.json") {
    const catalog = JSON.parse(
      await readFile("viewer/localization/" + file, "utf8"),
    );
    await writeFile("dist/locales/" + file, JSON.stringify(catalog));
  }
}
