import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { SentryProvider } from './providers/SentryProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Educação Continuada',
  description: 'Plataforma de Educação Continuada para equipes hospitalares',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <SentryProvider>
          {children}
        </SentryProvider>
      </body>
    </html>
  )
}
