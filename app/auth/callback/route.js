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
  const next = searchParams.get('next') || '/dashboard'

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
