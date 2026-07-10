const BACKEND_URL = process.env.SENTINEL_API_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

export async function GET(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return proxyRequest(request, context);
}

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

async function proxyRequest(request: Request, context: RouteContext) {
  const { path } = await context.params;
  const targetUrl = new URL(path.join("/"), withTrailingSlash(BACKEND_URL));
  targetUrl.search = new URL(request.url).search;

  const response = await fetch(targetUrl, {
    method: request.method,
    headers: {
      "Content-Type": request.headers.get("Content-Type") ?? "application/json",
      "X-Request-Id": request.headers.get("X-Request-Id") ?? crypto.randomUUID()
    },
    body: request.method === "GET" || request.method === "HEAD" ? undefined : await request.text(),
    cache: "no-store"
  });

  const headers = new Headers({
    "Content-Type": response.headers.get("Content-Type") ?? "application/json",
    "Cache-Control": "no-store"
  });
  const setCookie = response.headers.get("Set-Cookie");
  if (setCookie) headers.set("Set-Cookie", setCookie);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function withTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}
