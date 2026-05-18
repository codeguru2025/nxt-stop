import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const PROTECTED_PATHS = ['/dashboard', '/admin', '/gate']
const ADMIN_PATHS = ['/admin']
const GATE_PATHS = ['/gate']
const CSRF_COOKIE = 'csrf-token'
const CSRF_HEADER = 'x-csrf-token'
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']

const CSRF_EXEMPT = ['/api/paynow/webhook', '/api/health', '/api/admin/seed', '/api/auth/login', '/api/scan', '/api/auth/change-password', '/api/auth/request-password-reset']

// Middleware runs in Edge Runtime — must use static process.env access
// (dynamic process.env[name] doesn't work in Edge; Next.js inlines static refs at build)
function getJwtSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET)
}

function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

function setCsrfCookie(req: NextRequest, res: NextResponse): void {
  if (!req.cookies.get(CSRF_COOKIE)?.value) {
    res.cookies.set(CSRF_COOKIE, generateToken(), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24,
    })
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  const response = NextResponse.next()

  // Issue CSRF cookie on every response (pages + API)
  setCsrfCookie(req, response)

  // CSRF: verify on state-changing API requests
  if (
    pathname.startsWith('/api/') &&
    !SAFE_METHODS.includes(req.method) &&
    !CSRF_EXEMPT.some((p) => pathname.startsWith(p))
  ) {
    const csrfCookie = req.cookies.get(CSRF_COOKIE)?.value
    const csrfHeader = req.headers.get(CSRF_HEADER)
    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
      return NextResponse.json({ success: false, error: 'Invalid CSRF token' }, { status: 403 })
    }
  }

  // Auth: only enforce on protected page routes
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p))
  if (!isProtected) return response

  const token = req.cookies.get('nxt-session')?.value
  if (!token) {
    const redirect = NextResponse.redirect(new URL(`/login?from=${encodeURIComponent(pathname)}`, req.url))
    setCsrfCookie(req, redirect)
    return redirect
  }

  try {
    const { payload } = await jwtVerify(token, getJwtSecret())
    const role = payload.role as string

    if (ADMIN_PATHS.some((p) => pathname.startsWith(p)) && role !== 'admin') {
      const redirect = NextResponse.redirect(new URL('/dashboard', req.url))
      setCsrfCookie(req, redirect)
      return redirect
    }

    if (GATE_PATHS.some((p) => pathname.startsWith(p)) && !['admin', 'gate_staff'].includes(role)) {
      const redirect = NextResponse.redirect(new URL('/dashboard', req.url))
      setCsrfCookie(req, redirect)
      return redirect
    }

    return response
  } catch {
    const redirect = NextResponse.redirect(new URL(`/login?from=${encodeURIComponent(pathname)}`, req.url))
    redirect.cookies.delete('nxt-session')
    setCsrfCookie(req, redirect)
    return redirect
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|icons/).*)',
  ],
}
