import type { WebContainer, FileSystemTree } from "@webcontainer/api";

/**
 * WebContainer File Sync — converts agent file output to FileSystemTree and mounts files.
 *
 * The agent yields `{ type: "files", data: Record<string, string> }` events
 * (see code-agent.ts:1015). This module bridges that flat path→content map
 * into the nested FileSystemTree structure WebContainer.mount() expects.
 */

/**
 * Normalise a file path coming from the agent.
 *
 * Handles:
 *  - Leading `/home/user/` prefix (E2B sandbox convention)
 *  - Leading `/` (absolute paths)
 *  - Trailing slashes
 *  - Double slashes
 */
function normalisePath(filePath: string): string {
  let p = filePath;

  // Strip E2B sandbox prefix
  if (p.startsWith("/home/user/")) {
    p = p.slice("/home/user/".length);
  }

  // Strip leading slash (WebContainer paths are relative to workdir)
  if (p.startsWith("/")) {
    p = p.slice(1);
  }

  // Strip trailing slash
  if (p.endsWith("/")) {
    p = p.slice(0, -1);
  }

  // Collapse double slashes
  p = p.replace(/\/\/+/g, "/");

  return p;
}

/**
 * Convert a flat `Record<string, string>` (path → content) into a
 * WebContainer `FileSystemTree`.
 *
 * Deeply nested paths like `src/app/api/auth/route.ts` are expanded into
 * the correct directory/file node hierarchy.
 *
 * @example
 * ```ts
 * const tree = convertToFileSystemTree({
 *   "package.json": '{ "name": "app" }',
 *   "src/index.ts": 'console.log("hi")',
 * });
 * // => {
 * //   "package.json": { file: { contents: '{ "name": "app" }' } },
 * //   "src": { directory: { "index.ts": { file: { contents: 'console.log("hi")' } } } },
 * // }
 * ```
 */
export function convertToFileSystemTree(
  files: Record<string, string>
): FileSystemTree {
  const tree: FileSystemTree = {};

  for (const [rawPath, contents] of Object.entries(files)) {
    const normalised = normalisePath(rawPath);
    if (!normalised) continue; // skip empty paths

    const segments = normalised.split("/");
    let current: FileSystemTree = tree;

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isLast = i === segments.length - 1;

      if (isLast) {
        // Leaf node — file
        current[segment] = {
          file: { contents },
        };
      } else {
        // Intermediate node — directory
        if (!(segment in current)) {
          current[segment] = { directory: {} };
        }

        const node = current[segment];
        // If a file already exists at this path, convert it to a directory
        // (shouldn't happen with well-formed input, but be defensive)
        if ("file" in node) {
          current[segment] = { directory: {} };
        }

        current = (current[segment] as { directory: FileSystemTree }).directory;
      }
    }
  }

  return tree;
}

/**
 * Mount agent-generated files into a WebContainer instance.
 *
 * This is the primary entry point for syncing files from the agent
 * into the browser-side WebContainer.
 *
 * @param wc - The booted WebContainer instance
 * @param files - Flat path→content map from the agent (e.g. `state.files`)
 * @param mountPoint - Optional nested path to mount under (default: root)
 */
export async function mountFiles(
  wc: WebContainer,
  files: Record<string, string>,
  mountPoint?: string
): Promise<void> {
  const fileCount = Object.keys(files).length;
  if (fileCount === 0) {
    console.log("[webcontainer-sync] No files to mount");
    return;
  }

  console.log(`[webcontainer-sync] Mounting ${fileCount} file(s)...`);

  const tree = convertToFileSystemTree(files);

  await wc.mount(tree, mountPoint ? { mountPoint } : undefined);

  console.log(`[webcontainer-sync] Mounted ${fileCount} file(s) successfully`);
}
