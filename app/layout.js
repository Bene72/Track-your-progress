import './globals.css'
import { headers } from 'next/headers'
import { Inter, Bebas_Neue, Space_Mono } from 'next/font/google'
import PwaRegister from '../components/PwaRegister'

const inter = Inter({ subsets: ['latin'], weight: ['400', '500', '600', '700', '800'], variable: '--font-body', display: 'swap' })
const bebasNeue = Bebas_Neue({ subsets: ['latin'], weight: '400', variable: '--font-display', display: 'swap' })
const spaceMono = Space_Mono({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-mono', display: 'swap' })

export const metadata = {
  title: 'BoxLog — WOD & Performance',
  description: 'Note le WOD du jour, ton score, et suis tes PR.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'BoxLog',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/icons/apple-touch-icon.png',
  },
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
    <html lang="fr" className={`${inter.variable} ${bebasNeue.variable} ${spaceMono.variable}`}>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  )
}
