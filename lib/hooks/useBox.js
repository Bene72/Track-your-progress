'use client'
// Façade de compatibilité : la logique vit maintenant dans
// lib/context/BoxContext.js (fetch unique partagé par tout le
// dashboard au lieu d'un fetch par page). Toutes les pages qui font
// `import { useBox } from '../../../lib/hooks/useBox'` continuent de
// fonctionner sans aucune modification.
export { useBoxContext as useBox } from '../context/BoxContext'
