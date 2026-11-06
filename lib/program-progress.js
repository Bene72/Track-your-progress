// Avancement "fait / pas fait" d'un programme, vu du côté de l'ATHLÈTE du
// programme (pas forcément l'utilisateur connecté : un coach consulte le
// programme d'un athlète).

// myLog est la version la plus fraîche quand l'athlète est l'utilisateur
// connecté (mise à jour immédiatement après un upsert) ; sinon on lit les logs
// chargés avec le bloc.
export function athleteLog(block, athleteId) {
  if (block.myLog && block.myLog.athlete_id === athleteId) return block.myLog
  return (block.logs || []).find(l => l.athlete_id === athleteId) || null
}

// Les blocs "Optionnel" ne comptent pas pour savoir si la séance est terminée
// (sauter l'échauffement ne doit pas laisser la séance "à faire"). Si TOUS les
// blocs sont optionnels, on les compte tous.
export function sessionProgress(session, athleteId) {
  const blocks = session.blocks || []
  const required = blocks.filter(b => !b.is_optional)
  const counted = required.length > 0 ? required : blocks
  const done = counted.filter(b => athleteLog(b, athleteId)?.status === 'done').length
  return { total: counted.length, done }
}
