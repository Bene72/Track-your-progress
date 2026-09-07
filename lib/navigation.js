/**
 * Retourne exclusivement un chemin interne. Cette validation bloque aussi
 * les antislashs, que WHATWG URL peut interpréter comme des slashs.
 */
export function safeInternalPath(value, fallback = '/dashboard') {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return fallback

  try {
    const base = 'https://boxlog.invalid'
    const target = new URL(value, base)
    if (target.origin !== base) return fallback
    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return fallback
  }
}
