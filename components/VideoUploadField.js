'use client'
import { useState, useRef } from 'react'
import { supabase } from '../lib/supabase'

const MAX_SIZE_MB = 100

// Upload direct vers le bucket Storage "media" (cf. supabase_migration_v4.sql).
// Complète un champ URL existant : après upload, appelle onUploaded(url) pour
// remplir le champ ; l'utilisateur garde aussi la possibilité de coller un
// lien externe (YouTube, etc.) dans le champ texte à côté.
export default function VideoUploadField({ userId, folder = 'videos', onUploaded }) {
  const [uploading, setUploading] = useState(false)
  const [progressLabel, setProgressLabel] = useState('')
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    e.target.value = '' // permet de re-sélectionner le même fichier plus tard
    if (!file) return
    setError(null)

    if (!file.type.startsWith('video/')) {
      setError('Ce fichier n\'est pas une vidéo.')
      return
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`Fichier trop volumineux (max ${MAX_SIZE_MB} Mo). Héberge-le ailleurs (YouTube, Loom…) et colle le lien.`)
      return
    }

    setUploading(true)
    setProgressLabel('Envoi en cours…')
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const path = `${userId}/${folder}/${Date.now()}-${safeName}`
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(path, file, { cacheControl: '3600', upsert: false })
      if (uploadError) throw uploadError

      const { data: publicData } = supabase.storage.from('media').getPublicUrl(path)
      onUploaded(publicData.publicUrl)
    } catch (err) {
      setError(err.message || 'Échec de l\'upload.')
    } finally {
      setUploading(false)
      setProgressLabel('')
    }
  }

  return (
    <div className="video-upload">
      <style jsx>{`
        .video-upload { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
        .upload-btn { min-height: 32px; padding: 0 12px; border: 1px dashed rgba(255,255,255,.2); border-radius: 8px; color: rgba(255,255,255,.65); background: transparent; font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; }
        .upload-btn:hover:not(:disabled) { border-color: rgba(249,115,22,.5); color: #FDBA74; }
        .upload-btn:disabled { opacity: .5; cursor: wait; }
        .upload-error { color: #ff9d9d; font-size: 10.5px; }
      `}</style>
      <input ref={inputRef} type="file" accept="video/*" hidden onChange={handleFile} />
      <button type="button" className="upload-btn" disabled={uploading || !userId} onClick={() => inputRef.current?.click()}>
        {uploading ? progressLabel : '📤 Uploader une vidéo'}
      </button>
      {error && <span className="upload-error">{error}</span>}
    </div>
  )
}
