import { NextResponse } from 'next/server'
import { requireCronSecret } from '@/lib/api-auth' // adapte le chemin si pas d'alias @/ configuré

// Route appelée périodiquement par Vercel Cron (voir vercel.json).
// Elle fait une requête légère à Supabase pour empêcher la mise en
// pause automatique du projet (plan gratuit = pause après 7 jours
// d'inactivité).
export async function GET(request) {
  const denied = requireCronSecret(request)
  if (denied) return denied

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
