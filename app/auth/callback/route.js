import { NextResponse } from 'next/server'
import { createServerSupabase } from '../../../lib/supabase-server'

// Supabase envoie ?code=... après confirmation d'email (ou magic link,
// ou reset password) — flow PKCE. Ce code DOIT être échangé contre une
// session côté serveur (exchangeCodeForSession écrit les cookies via
// createServerSupabase) pour que l'utilisateur soit réellement connecté
// en arrivant sur /dashboard. Avant ce fichier, app/page.js redirigeait
// directement vers /dashboard sans jamais faire cet échange : le code
// était silencieusement perdu et l'utilisateur atterrissait déconnecté.
export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const nextParam = searchParams.get('next')
  // On n'accepte qu'un chemin relatif interne ("/dashboard", "/onboarding"...).
  // Toute valeur commençant par "//" (URL protocol-relative) ou contenant
  // un schéma ("http:", "javascript:"...) est rejetée au profit du
  // fallback par défaut — défense en profondeur contre un open redirect,
  // même si la simple concaténation avec `origin` ci-dessous n'en permet
  // pas d'exploitable aujourd'hui.
  const next = nextParam && nextParam.startsWith('/') && !nextParam.startsWith('//')
    ? nextParam
    : '/dashboard'

  if (code) {
    const supabase = createServerSupabase()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('exchangeCodeForSession failed:', error.message)
  }

  return NextResponse.redirect(`${origin}/auth?error=confirmation_failed`)
}
