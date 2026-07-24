import './globals.css'

export const metadata = {
  title: 'BoxLog — WOD & Performance',
  description: 'Note le WOD du jour, ton score, et suis tes PR.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  )
}
