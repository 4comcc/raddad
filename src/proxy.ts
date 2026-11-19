import { NextResponse, type NextRequest } from "next/server";

// Optimistic check only — every page/action re-verifies the signed session.
export function proxy(req: NextRequest) {
  if (!req.cookies.get("raddad_session")?.value) {
    const url = new URL("/login", req.url);
    url.searchParams.set("next", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
