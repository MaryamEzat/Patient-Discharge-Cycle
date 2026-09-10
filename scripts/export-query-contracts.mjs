import { build } from "esbuild";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
fs.mkdirSync(".local", { recursive: true });
await build({
  entryPoints: ["scripts/export-query-contracts.ts"],
  outfile: ".local/query-contracts.mjs",
  bundle: true,
  platform: "node",
  format: "esm",
});
await import(pathToFileURL(path.resolve(".local/query-contracts.mjs")));
