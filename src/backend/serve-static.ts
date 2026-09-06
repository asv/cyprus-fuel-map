/** Serve files from a directory, guarding against path traversal. */
export function createStaticFileServer(root: URL): (pathname: string) => Promise<Response | null> {
  return async (pathname) => {
    const relativePath = pathname === "/" ? "index.html" : decodeURIComponent(pathname.slice(1));
    if (relativePath.includes("..") || relativePath.startsWith("/")) return null;

    const file = Bun.file(new URL(relativePath, root));
    if (!(await file.exists())) return null;

    return new Response(file, {
      headers: { "content-type": contentType(relativePath) },
    });
  };
}

export function contentType(path: string): string {
  if (path.endsWith(".html")) return "text/html; charset=utf-8";
  if (path.endsWith(".css")) return "text/css; charset=utf-8";
  if (path.endsWith(".js")) return "application/javascript; charset=utf-8";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".json")) return "application/json; charset=utf-8";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".ico")) return "image/x-icon";
  if (path.endsWith(".map")) return "application/json; charset=utf-8";
  return "application/octet-stream";
}
