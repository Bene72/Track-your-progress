import { createBrowserClient } from '@supabase/ssr'

function requiredPublicEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Configuration manquante : ${name}`)
  return value
}

export function createClient() {
  return createBrowserClient(
    requiredPublicEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requiredPublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  )
}

export const supabase = createClient()

export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  return { user: user ?? null, error: error ?? null }
}
