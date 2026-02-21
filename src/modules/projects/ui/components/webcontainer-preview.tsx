"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { WebContainerProcess } from "@webcontainer/api";

interface Props {
  files: Record<string, string>;
  refreshKey: number;
}

const FALLBACK_INDEX = "index.html";
const FALLBACK_SERVER = "server.mjs";

const ensurePreviewFiles = (files: Record<string, string>): Record<string, string> => {
  if (Object.keys(files).length > 0) {
    return files;
  }

  return {
    [FALLBACK_INDEX]: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WebContainer Preview</title>
  </head>
  <body>
    <h1>WebContainer Preview Ready</h1>
    <p>No generated files were found for this run.</p>
  </body>
</html>`,
    [FALLBACK_SERVER]: `import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const html = await readFile("${FALLBACK_INDEX}", "utf8");
const server = createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

server.listen(3000, () => {
  console.log("Preview server running on 3000");
});
`,
  };
};

const isNpmProject = (files: Record<string, string>): boolean => "package.json" in files;

const hasLocalServerEntry = (files: Record<string, string>): boolean => "server.mjs" in files || "server.js" in files;

const safeParseJson = <T,>(value: string): T | null => {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
};

export function WebContainerPreview({ files, refreshKey }: Props) {
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const runProcessRef = useRef<WebContainerProcess | null>(null);

  const normalizedFiles = useMemo(() => ensurePreviewFiles(files), [files]);

  useEffect(() => {
    let cancelled = false;
    let activeTimeout: ReturnType<typeof setTimeout> | null = null;
    let teardown: (() => void) | null = null;

    const run = async () => {
      setLoading(true);
      setError("");
      setPreviewUrl("");

      try {
        const { WebContainer } = await import("@webcontainer/api");
        const webcontainer = await WebContainer.boot();
        teardown = () => {
          runProcessRef.current?.kill();
          runProcessRef.current = null;
          webcontainer.teardown();
        };

        webcontainer.on("server-ready", (_, url) => {
          if (cancelled) {
            return;
          }
          if (activeTimeout) {
            clearTimeout(activeTimeout);
            activeTimeout = null;
          }
          setPreviewUrl(url);
          setLoading(false);
        });

        for (const [filePath, contents] of Object.entries(normalizedFiles)) {
          const pathSegments = filePath.split("/").filter(Boolean);
          if (pathSegments.length === 0) {
            continue;
          }

          if (pathSegments.length > 1) {
            const directory = pathSegments.slice(0, -1).join("/");
            await webcontainer.fs.mkdir(directory, { recursive: true });
          }

          await webcontainer.fs.writeFile(filePath, contents);
        }

        if (!hasLocalServerEntry(normalizedFiles) && !isNpmProject(normalizedFiles)) {
          await webcontainer.fs.writeFile(
            FALLBACK_SERVER,
            `import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const html = await readFile("${FALLBACK_INDEX}", "utf8");
const server = createServer((_, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});

server.listen(3000, () => {
  console.log("Preview server running on 3000");
});
`
          );
        }

        if (isNpmProject(normalizedFiles)) {
          const packageJson = safeParseJson<{ scripts?: Record<string, string> }>(normalizedFiles["package.json"]);
          const hasDevScript = Boolean(packageJson?.scripts && packageJson.scripts.dev);

          const installProcess = await webcontainer.spawn("npm", ["install"]);
          const installExitCode = await installProcess.exit;
          if (installExitCode !== 0) {
            throw new Error("npm install failed in WebContainer preview");
          }

          runProcessRef.current = hasDevScript
            ? await webcontainer.spawn("npm", ["run", "dev"])
            : await webcontainer.spawn("node", [FALLBACK_SERVER]);
        } else if ("server.mjs" in normalizedFiles) {
          runProcessRef.current = await webcontainer.spawn("node", ["server.mjs"]);
        } else if ("server.js" in normalizedFiles) {
          runProcessRef.current = await webcontainer.spawn("node", ["server.js"]);
        } else {
          runProcessRef.current = await webcontainer.spawn("node", [FALLBACK_SERVER]);
        }

        activeTimeout = setTimeout(() => {
          if (cancelled) {
            return;
          }
          setLoading(false);
          setError("Preview timed out before WebContainer server became ready.");
        }, 90_000);
      } catch (previewError) {
        if (!cancelled) {
          setLoading(false);
          setError(previewError instanceof Error ? previewError.message : String(previewError));
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (activeTimeout) {
        clearTimeout(activeTimeout);
      }
      teardown?.();
    };
  }, [normalizedFiles, refreshKey]);

  if (loading) {
    return <div className="p-4 text-sm text-muted-foreground">Starting WebContainer preview...</div>;
  }

  if (error) {
    return <div className="p-4 text-sm text-destructive">WebContainer preview failed: {error}</div>;
  }

  if (!previewUrl) {
    return <div className="p-4 text-sm text-muted-foreground">Waiting for preview URL...</div>;
  }

  return <iframe className="h-full w-full" sandbox="allow-forms allow-scripts allow-same-origin" loading="lazy" src={previewUrl} />;
}
