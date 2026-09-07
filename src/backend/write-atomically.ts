import { randomUUID } from "node:crypto";
import { mkdir, rename } from "node:fs/promises";

/**
 * Write file contents atomically: write to a unique sibling `.tmp` path, then
 * rename over the target. Readers never observe a partially written file.
 *
 * The tmp name is unique per call so concurrent writers to the same target do
 * not collide on the intermediate path (two renames of the same tmp would race
 * and one could fail with ENOENT). On crash only a stray *.tmp file is left
 * behind; those are gitignored and never served for real names.
 */
export async function atomicWrite(target: URL, contents: string): Promise<void> {
  await mkdir(new URL(".", target), { recursive: true });
  const tmp = new URL(`${target.pathname.split("/").pop()}.${randomUUID()}.tmp`, new URL(".", target));
  await Bun.write(tmp, contents);
  await rename(tmp, target);
}
