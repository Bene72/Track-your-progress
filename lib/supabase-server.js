import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

function requiredPublicEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Configuration manquante : ${name}`)
  return value
}

export async function createServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    requiredPublicEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredPublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) => cookieStore.set({ name, value, ...options }),
        remove: (name, options) => cookieStore.set({ name, value: '', ...options }),
      },
    }
  )
}
