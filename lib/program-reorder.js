// Logique pure de réordonnancement des blocs d'une séance (testable sans React
// ni Supabase). Les lettres A/ B/ C/ ne sont pas stockées : elles dérivent de
// l'index du bloc dans la séance, donc changer l'ordre change les lettres.

// Déplace l'élément d'index `from` à l'index `to` (nouvelle liste, l'original
// n'est pas modifié). Renvoie la même liste si le déplacement est impossible.
export function moveInOrder(ids, from, to) {
  if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return ids
  const next = [...ids]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

// À partir des blocs actuels et du nouvel ordre d'ids, renvoie :
//   reordered : les blocs dans le nouvel ordre, position = index (0..n-1)
//   changed   : seulement ceux dont la position en base doit être mise à jour
// Lève une erreur si orderedIds n'est pas exactement le même ensemble de blocs
// (un bloc ajouté/supprimé entre-temps) : mieux vaut refuser que corrompre.
export function planReorder(blocks, orderedIds) {
  if (orderedIds.length !== blocks.length || new Set(orderedIds).size !== orderedIds.length) {
    throw new Error('Ordre invalide : la séance a changé, réessaie.')
  }
  const byId = new Map(blocks.map(b => [b.id, b]))
  const reordered = orderedIds.map((id, index) => {
    const block = byId.get(id)
    if (!block) throw new Error('Ordre invalide : bloc introuvable.')
    return { ...block, position: index }
  })
  const changed = reordered.filter(b => byId.get(b.id).position !== b.position)
  return { reordered, changed }
}
