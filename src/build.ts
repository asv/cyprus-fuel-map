import { cp, mkdir, rm } from "node:fs/promises";

const publicDir = new URL("../public/", import.meta.url);
const distDir = new URL("../dist/", import.meta.url);
const clientEntry = new URL("./client.ts", import.meta.url);
const appJs = new URL("app.js", distDir);

async function main(): Promise<void> {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await cp(publicDir, distDir, { recursive: true });

  const result = await Bun.build({
    entrypoints: [clientEntry.pathname],
    target: "browser",
    format: "esm",
    minify: false,
  });
  if (!result.success) throw new Error("Failed to build browser client");

  const output = result.outputs[0];
  if (!output) throw new Error("Browser client build produced no output");
  await Bun.write(appJs, await output.text());

  console.log(`Built static app in ${distDir.pathname}`);
}

await main();
