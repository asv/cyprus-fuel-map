import { mkdir, rename } from "node:fs/promises";

/**
 * Write file contents atomically: write to a sibling `.tmp` path, then rename
 * over the target. Readers never observe a partially written file; on crash
 * only the tmp file is left behind.
 */
export async function atomicWrite(target: URL, contents: string): Promise<void> {
  await mkdir(new URL(".", target), { recursive: true });
  const tmp = new URL(`${target.pathname.split("/").pop()}.tmp`, new URL(".", target));
  await Bun.write(tmp, contents);
  await rename(tmp, target);
}
