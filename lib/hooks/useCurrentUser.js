'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../supabase'

export function useCurrentUser({ redirectIfNull = false } = {}) {
  const router = useRouter()
  const [userId, setUserId] = useState(null)
  const [userName, setUserName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(async ({ data }) => {
      if (cancelled) return
      const user = data?.user
      if (!user) {
        if (redirectIfNull) router.push('/auth')
        setLoading(false)
        return
      }
      setUserId(user.id)
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single()
      if (!cancelled) {
        setUserName(profile?.full_name || user.email?.split('@')[0] || 'Toi')
        setLoading(false)
      }
    })
    return () => { cancelled = true }
  }, [])

  const userInitials = userName
    ? userName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return { userId, userName, userInitials, loading }
}
