'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabase'

// "Ressenti du jour" d'un programme : l'athlète note sa séance de 1 à 5 avec un
// mot, le coach de la box le lit (cf. supabase_migration_v12.sql). Une seule
// ligne par (programme, athlète, date) : réécrire le même jour met à jour.
//   feelings : { 'YYYY-MM-DD': { feeling_date, rating, comment } }
// Si la migration v12 n'est pas encore passée, la lecture échoue
// silencieusement (pas de ressenti affiché) au lieu de casser la page.
export function useProgramFeelings(programId, athleteId) {
  const [feelings, setFeelings] = useState({})

  const load = useCallback(async () => {
    if (!programId || !athleteId) return
    const { data, error } = await supabase
      .from('program_day_feelings')
      .select('feeling_date, rating, comment')
      .eq('program_id', programId)
      .eq('athlete_id', athleteId)
    if (error) {
      console.warn('Ressenti indisponible :', error.message)
      return
    }
    setFeelings(Object.fromEntries((data || []).map(row => [row.feeling_date, row])))
  }, [programId, athleteId])

  useEffect(() => { load() }, [load])

  const saveFeeling = useCallback(async (dateKey, rating, comment) => {
    const { data, error } = await supabase
      .from('program_day_feelings')
      .upsert({
        program_id: programId,
        athlete_id: athleteId,
        feeling_date: dateKey,
        rating,
        comment: (comment || '').trim() || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'program_id,athlete_id,feeling_date' })
      .select('feeling_date, rating, comment')
      .single()
    if (error) throw error
    setFeelings(prev => ({ ...prev, [data.feeling_date]: data }))
    return data
  }, [programId, athleteId])

  return { feelings, saveFeeling, reload: load }
}
