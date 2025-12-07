export class NextResponse extends Response {
  static json(data: unknown, init?: ResponseInit) {
    const headers = new Headers(init?.headers);
    if (!headers.has("content-type")) {
      headers.set("content-type", "application/json");
    }
    return new Response(JSON.stringify(data), {
      ...init,
      headers,
    });
  }

  static redirect(url: string | URL, status = 307) {
    return Response.redirect(typeof url === "string" ? url : url.toString(), status);
  }
}

export type NextRequest = Request;
