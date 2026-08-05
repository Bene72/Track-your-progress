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
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'BoxLog' },
  icons: { icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }, { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' }], apple: '/icons/apple-touch-icon.png' },
}
export const viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#121316' }

export default async function RootLayout({ children }) {
  await headers() // Rend la page dynamique afin d'associer le nonce CSP à la requête.
  return <html lang="fr" className={`${inter.variable} ${bebasNeue.variable} ${spaceMono.variable}`}><body>{children}<PwaRegister /></body></html>
}
