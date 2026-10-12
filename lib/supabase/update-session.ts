import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canViewResults, roleHome } from "@/lib/utils";

const PROTECTED_PREFIXES = ["/admin", "/staff", "/supervisor", "/display-control"];

function canAccessPath(pathname: string, role: string | null | undefined) {
  if (pathname.startsWith("/admin")) return role === "admin";
  if (pathname.startsWith("/staff")) return role === "staff";
  if (pathname.startsWith("/supervisor")) return role === "supervisor";
  if (pathname === "/display-control" || pathname.startsWith("/display-control/")) {
    return role === "admin" || role === "supervisor";
  }
  return false;
}

function isResultsLogin(pathname: string) {
  return pathname === "/results/login" || pathname.startsWith("/results/login/");
}

function isResultsBoard(pathname: string) {
  return pathname === "/results" || (pathname.startsWith("/results/") && !isResultsLogin(pathname));
}

export async function updateSession(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    const pathname = request.nextUrl.pathname;
    if (
      PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix)) ||
      isResultsBoard(pathname)
    ) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/setup";
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (!user && isResultsBoard(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/results/login";
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === "/login" || isResultsLogin(pathname))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = roleHome(profile?.role);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && isResultsBoard(pathname)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!canViewResults(profile?.role)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = roleHome(profile?.role);
      return NextResponse.redirect(redirectUrl);
    }
  }

  if (user && isProtected) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (!canAccessPath(pathname, profile?.role)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = roleHome(profile?.role);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}
