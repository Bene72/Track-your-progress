import { randomBytes } from 'crypto'

// Alphabet sans caractères ambigus (pas de 0/O, 1/I/l) — les codes
// sont destinés à être lus/tapés à la main dans certains cas (ex:
// affiché sur un tableau à la box), autant éviter les confusions.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

// 20 caractères sur un alphabet de 32 symboles ≈ 100 bits d'entropie
// (log2(32) * 20 = 100), largement suffisant pour résister à un
// brute-force via l'API PostgREST exposée (join_box_via_code).
// Doit rester ≥ 20 pour respecter la contrainte DB
// `box_invites_code_min_length` posée dans fix-invite-codes.sql.
const DEFAULT_LENGTH = 20

/**
 * Génère un code d'invitation cryptographiquement aléatoire.
 * À appeler UNIQUEMENT côté serveur (route handler / server action) —
 * `crypto.randomBytes` n'est pas disponible côté client.
 */
export function generateInviteCode(length = DEFAULT_LENGTH) {
  const bytes = randomBytes(length)
  let code = ''
  for (let i = 0; i < length; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length]
  }
  return code
}

/**
 * Durée de vie par défaut d'une invite, en jours. À faire correspondre
 * avec le défaut posé côté DB (`fix-invite-codes.sql`) si tu changes
 * l'un des deux.
 */
export const DEFAULT_INVITE_TTL_DAYS = 14

export function defaultInviteExpiry() {
  return new Date(Date.now() + DEFAULT_INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

// Exemple d'utilisation lors de la création d'une invite (à adapter
// à l'emplacement réel de ce code dans ton app — route handler,
// server action, etc.) :
//
//   const code = generateInviteCode()
//   await supabase.from('box_invites').insert({
//     box_id: boxId,
//     code,
//     role: 'member',
//     created_by: user.id,
//     expires_at: defaultInviteExpiry(),
//   })
