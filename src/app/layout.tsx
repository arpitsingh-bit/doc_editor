import type { Metadata } from 'next'
import { Lora, Inter, JetBrains_Mono } from 'next/font/google'
import './globals.css'

// ── Document body face — Lora (warm transitional serif) ───────────────────
// Used exclusively in .ProseMirror (the document surface).
// NOT used in UI chrome — chrome uses the ui sans below.
const serif = Lora({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'], // italic permitted in body-copy (blockquotes, em)
})

// ── Chrome face — Inter (compact humanist sans) ────────────────────────────
// Used for topbar, buttons, labels, sidebar text — any UI element.
const ui = Inter({
  subsets: ['latin'],
  variable: '--font-ui',
  display: 'swap',
  weight: ['400', '500', '600'],
})

// ── Monospace face — JetBrains Mono ───────────────────────────────────────
// Used for inline code, code blocks, and metadata (room name, timestamps).
const mono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: 'Collaborative Document Editor',
  description: 'Real-time collaborative writing powered by Yjs CRDT + TipTap',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    // Apply all three font CSS variables to the root so they cascade everywhere
    <html lang="en" className={`${serif.variable} ${ui.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
