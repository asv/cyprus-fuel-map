import { cp, mkdir, rm } from "node:fs/promises";

const publicDir = new URL("../public/", import.meta.url);
const distDir = new URL("../dist/", import.meta.url);
const clientEntry = new URL("./client.ts", import.meta.url);
const appJs = new URL("app.js", distDir);
const indexHtml = new URL("index.html", distDir);

async function main(): Promise<void> {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await cp(publicDir, distDir, { recursive: true });

  const assetVersion = await buildAssetVersion();

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
  await addAssetVersion(indexHtml, assetVersion);

  console.log(`Built static app in ${distDir.pathname}`);
}

async function buildAssetVersion(): Promise<string> {
  const githubSha = process.env.GITHUB_SHA?.trim();
  if (githubSha) return githubSha.slice(0, 12);

  const proc = Bun.spawn(["git", "rev-parse", "--short=12", "HEAD"], { stdout: "pipe", stderr: "ignore" });
  const text = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  const gitSha = text.trim();
  return exitCode === 0 && gitSha ? gitSha : String(Date.now());
}

async function addAssetVersion(path: URL, version: string): Promise<void> {
  const suffix = `?v=${encodeURIComponent(version)}`;
  const html = await Bun.file(path).text();
  await Bun.write(
    path,
    html
      .replace(/href="style\.css(?:\?v=[^"]*)?"/, `href="style.css${suffix}"`)
      .replace(/src="app\.js(?:\?v=[^"]*)?"/, `src="app.js${suffix}"`),
  );
}

await main();
