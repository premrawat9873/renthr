import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import {
  CUSTOM_SESSION_COOKIE_NAME,
  verifyCustomSessionToken,
} from '@/lib/custom-session';

const PROTECTED_ROUTES = ['/home'];

function isProtectedRoute(pathname: string) {
  return PROTECTED_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}

function isSafeInternalPath(path: string | null) {
  if (!path) return false;
  return path.startsWith('/') && !path.startsWith('//');
}

function getPostLoginRedirectPath(request: NextRequest) {
  const nextParam = request.nextUrl.searchParams.get('next');
  if (isSafeInternalPath(nextParam)) {
    return nextParam;
  }
  return '/home';
}

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  let user = null;

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    });

    const {
      data: { user: supabaseUser },
    } = await supabase.auth.getUser();

    user = supabaseUser;
  }

  const pathname = request.nextUrl.pathname;
  const customSession = verifyCustomSessionToken(
    request.cookies.get(CUSTOM_SESSION_COOKIE_NAME)?.value
  );
  const isAuthenticated = Boolean(user) || Boolean(customSession);

  if (pathname === '/') {
    return NextResponse.redirect(new URL('/home', request.url));
  }

  if (isProtectedRoute(pathname) && !isAuthenticated) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = '/login';
    redirectUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(redirectUrl);
  }

  if (pathname === '/login' && isAuthenticated) {
    return NextResponse.redirect(new URL(getPostLoginRedirectPath(request), request.url));
  }

  return response;
}