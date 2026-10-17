import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Checagem otimista (só a presença do cookie, sem ir ao banco). A validação
// real da sessão acontece em cada página/action via lib/session.ts.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*"]
};
