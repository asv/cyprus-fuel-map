import { cp, mkdir, rm } from "node:fs/promises";

const publicDir = new URL("../public/", import.meta.url);
const distDir = new URL("../dist/", import.meta.url);
const clientEntry = new URL("./client.ts", import.meta.url);
const appJs = new URL("app.js", distDir);

async function main(): Promise<void> {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
  await cp(publicDir, distDir, { recursive: true });

  const transpiler = new Bun.Transpiler({ loader: "ts", target: "browser" });
  const clientJs = transpiler.transformSync(await Bun.file(clientEntry).text());
  await Bun.write(appJs, clientJs);

  console.log(`Built static app in ${distDir.pathname}`);
}

await main();
