// lib/fitness-math.js
// Petits calculs indépendants de l'UI, testables isolément.

// Formule d'Epley : la plus utilisée par les apps grand public (Hevy, Strong)
// pour estimer un 1RM à partir d'une série sous-maximale. Fiable jusqu'à
// ~10-12 reps, moins au-delà (on la garde volontairement simple).
export function estimate1RM(weightKg, reps) {
  const w = Number(weightKg)
  const r = Number(reps)
  if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r <= 0) return null
  if (r === 1) return Math.round(w * 10) / 10
  return Math.round(w * (1 + r / 30) * 10) / 10
}

// Poids standard des disques olympiques disponibles (kg), du plus lourd au
// plus léger. Adapté aux barres 20kg (homme) ou 15kg (femme) via barWeightKg.
const DEFAULT_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]

// Décompose le poids à charger (par côté) en disques disponibles, glouton
// du plus lourd au plus léger. Retourne null si le poids cible est
// inférieur au poids de la barre (rien à charger) ou infaisable proprement
// avec le jeu de disques donné (reste non nul en dessous du plus petit disque).
export function calculatePlates(targetWeightKg, barWeightKg = 20, availablePlatesKg = DEFAULT_PLATES_KG) {
  const target = Number(targetWeightKg)
  const bar = Number(barWeightKg)
  if (!Number.isFinite(target) || !Number.isFinite(bar) || target < bar) return null

  let perSide = (target - bar) / 2
  const plates = []
  const sorted = [...availablePlatesKg].sort((a, b) => b - a)
  const EPSILON = 0.001

  for (const plate of sorted) {
    while (perSide + EPSILON >= plate) {
      plates.push(plate)
      perSide -= plate
    }
  }

  return {
    barWeightKg: bar,
    perSide: plates,
    remainder: Math.round(perSide * 100) / 100, // poids qu'on ne peut pas charger exactement avec ce jeu de disques
    totalWeightKg: target,
  }
}
