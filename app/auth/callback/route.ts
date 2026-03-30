import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

function isSafeInternalPath(path: string | null) {
  return Boolean(path && path.startsWith("/") && !path.startsWith("//"));
}

function toLoginRedirect(requestUrl: URL, nextPath: string, errorCode: string) {
  const loginUrl = new URL("/login", requestUrl.origin);
  loginUrl.searchParams.set("error", errorCode);

  if (nextPath !== "/home") {
    loginUrl.searchParams.set("next", nextPath);
  }

  return NextResponse.redirect(loginUrl);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextParam = requestUrl.searchParams.get("next");
  const nextPath = isSafeInternalPath(nextParam) ? nextParam : "/home";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!code) {
    return toLoginRedirect(requestUrl, nextPath, "missing_oauth_code");
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return toLoginRedirect(requestUrl, nextPath, "missing_supabase_env");
  }

  const response = NextResponse.redirect(new URL(nextPath, requestUrl.origin));
  const cookieStore = await cookies();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return toLoginRedirect(requestUrl, nextPath, "oauth_exchange_failed");
  }

  return response;
}
