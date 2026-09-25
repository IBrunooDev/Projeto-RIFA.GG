import { NextRequest, NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function proxy(request: NextRequest) {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 6_000_000) {
    return NextResponse.json({ error: "A requisição é maior que o limite permitido." }, { status: 413 });
  }

  if (!SAFE_METHODS.has(request.method)) {
    const fetchSite = request.headers.get("sec-fetch-site");
    if (fetchSite === "cross-site") {
      return NextResponse.json({ error: "Origem da requisição não permitida." }, { status: 403 });
    }

    const origin = request.headers.get("origin");
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
    const host = forwardedHost || request.headers.get("host");
    if (origin && host) {
      try {
        if (new URL(origin).host !== host) {
          return NextResponse.json({ error: "Origem da requisição não permitida." }, { status: 403 });
        }
      } catch {
        return NextResponse.json({ error: "Origem da requisição inválida." }, { status: 403 });
      }
    }
  }

  const response = NextResponse.next();
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export const config = { matcher: "/api/:path*" };
