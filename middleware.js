import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

const isDev = process.env.NODE_ENV === 'development'

// style-src garde 'unsafe-inline' volontairement : l'app utilise beaucoup
// de style={{...}} en JSX (attribut style="" sur le DOM), et un nonce CSP
// ne peut PAS couvrir les attributs style — seulement les balises <style>
// et <script>. Le retirer casserait tout le rendu. script-src, en
// revanche, passe en nonce + strict-dynamic : c'est le vecteur XSS qui
// compte vraiment (injection de <script> malveillant).
function buildSecurityHeaders(nonce) {
  return {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'Content-Security-Policy': [
      "default-src 'self'",
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
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

const PUBLIC_PATHS = ['/auth']
const STATIC_REGEX = /\.(svg|png|jpg|jpeg|gif|webp|ico|woff2?)$/

export async function middleware(request) {
  const { pathname } = request.nextUrl
  if (STATIC_REGEX.test(pathname)) return NextResponse.next()

  // Nonce unique par requête. Next.js le détecte automatiquement dans le
  // header CSP de la requête entrante et l'applique lui-même à ses
  // propres scripts inline (hydratation) — aucun changement requis dans
  // app/layout.js tant qu'on n'ajoute pas de <script> custom.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')
  const SECURITY_HEADERS = buildSecurityHeaders(nonce)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('Content-Security-Policy', SECURITY_HEADERS['Content-Security-Policy'])

  let response = NextResponse.next({ request: { headers: requestHeaders } })
  Object.entries(SECURITY_HEADERS).forEach(([k, v]) => response.headers.set(k, v))

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        get(name) { return request.cookies.get(name)?.value },
        set(name, value, options) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({ request: { headers: requestHeaders } })
          Object.entries(SECURITY_HEADERS).forEach(([k, v]) => response.headers.set(k, v))
          response.cookies.set({ name, value, ...options })
        },
        remove(name, options) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({ request: { headers: requestHeaders } })
          Object.entries(SECURITY_HEADERS).forEach(([k, v]) => response.headers.set(k, v))
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p))

  if (!user && !isPublic) {
    const redirectUrl = new URL('/auth', request.url)
    redirectUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(redirectUrl)
  }
  if (user && pathname === '/auth') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
