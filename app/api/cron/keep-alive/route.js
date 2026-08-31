import { NextResponse } from 'next/server'

// Route appelée périodiquement par Vercel Cron (voir vercel.json).
// Elle fait une requête légère à Supabase pour empêcher la mise en
// pause automatique du projet (plan gratuit = pause après 7 jours
// d'inactivité).
export async function GET(request) {
  // Sécurité : seul Vercel Cron peut déclencher cette route.
  // Vercel envoie automatiquement ce header sur les requêtes cron.
  // IMPORTANT : si CRON_SECRET n'est pas configuré côté env, on refuse
  // TOUT le monde (fail-closed) plutôt que de laisser passer.
  const authHeader = request.headers.get('authorization')
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
      headers: {
        apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
      },
    })

    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error.message, timestamp: new Date().toISOString() },
      { status: 500 }
    )
  }
}
