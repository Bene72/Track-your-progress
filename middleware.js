import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

const isDev = process.env.NODE_ENV === 'development'

function securityHeaders(nonce) {
  return {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Resource-Policy': 'same-origin',
    'X-Permitted-Cross-Domain-Policies': 'none',
    'Content-Security-Policy': [
      "default-src 'self'",
      isDev ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'" : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: https://*.supabase.co",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "font-src 'self' https://fonts.gstatic.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  }
}

function applyHeaders(response, headers) {
  for (const [name, value] of Object.entries(headers)) response.headers.set(name, value)
  return response
}

function isPublicPath(pathname) {
  return pathname === '/auth' || pathname.startsWith('/auth/')
}

export async function middleware(request) {
  const nonce = btoa(crypto.randomUUID())
  const headers = securityHeaders(nonce)
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('Content-Security-Policy', headers['Content-Security-Policy'])

  let response = applyHeaders(NextResponse.next({ request: { headers: requestHeaders } }), headers)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get: (name) => request.cookies.get(name)?.value,
        set: (name, value, options) => {
          request.cookies.set({ name, value, ...options })
          response = applyHeaders(NextResponse.next({ request: { headers: requestHeaders } }), headers)
          response.cookies.set({ name, value, ...options })
        },
        remove: (name, options) => {
          request.cookies.set({ name, value: '', ...options })
          response = applyHeaders(NextResponse.next({ request: { headers: requestHeaders } }), headers)
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) console.warn('Impossible de vérifier la session:', error.message)

  const { pathname, search } = request.nextUrl
  if (!user && !isPublicPath(pathname)) {
    const redirectUrl = new URL('/auth', request.url)
    redirectUrl.searchParams.set('next', `${pathname}${search}`)
    return applyHeaders(NextResponse.redirect(redirectUrl), headers)
  }
  if (user && pathname === '/auth') {
    return applyHeaders(NextResponse.redirect(new URL('/dashboard', request.url)), headers)
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)'],
}
