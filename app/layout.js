import './globals.css'
import { headers } from 'next/headers'
export const metadata = {
  title: 'BoxLog — WOD & Performance',
  description: 'Note le WOD du jour, ton score, et suis tes PR.',
}
export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover', // gère les safe-areas (encoche/home indicator) en plein écran
  themeColor: '#121316',
}
export default function RootLayout({ children }) {
  // Lire headers() force Next.js à rendre chaque page dynamiquement
  // (par requête) au lieu de la pré-générer une seule fois au build.
  // C'est indispensable pour que le nonce que middleware.js injecte
  // dans le header CSP corresponde bien à celui que Next.js applique
  // à ses propres scripts d'hydratation — sinon la CSP bloque tout
  // et l'app reste sur un écran blanc/noir en production.
  headers()
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
