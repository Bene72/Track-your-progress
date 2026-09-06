import { NextResponse } from 'next/server'
import { createServerSupabase } from './supabase-server'

/**
 * À appeler en première ligne de toute route API qui nécessite un
 * utilisateur connecté (le middleware ne protège PAS /api/*, voir
 * middleware.js — chaque route API doit donc s'auto-protéger).
 *
 * Usage :
 *   export async function GET(request) {
 *     const { user, response } = await requireUser()
 *     if (response) return response
 *     // ... user est garanti non-null à partir d'ici
 *   }
 */
export async function requireUser() {
  const supabase = await createServerSupabase()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    return {
      user: null,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    }
  }

  return { user, response: null }
}

/**
 * À appeler en première ligne de toute route déclenchée par un
 * job externe (Vercel Cron, webhook signé, etc.) authentifié par
 * secret partagé plutôt que par session utilisateur.
 *
 * Fail-closed par construction : si CRON_SECRET n'est pas défini
 * dans l'environnement, la route refuse TOUJOURS la requête plutôt
 * que de devenir publique par accident (c'est le bug qui existait
 * dans l'ancienne version de app/api/cron/route.js).
 *
 * Usage :
 *   export async function GET(request) {
 *     const denied = requireCronSecret(request)
 *     if (denied) return denied
 *     // ... requête authentifiée à partir d'ici
 *   }
 */
export function requireCronSecret(request) {
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
