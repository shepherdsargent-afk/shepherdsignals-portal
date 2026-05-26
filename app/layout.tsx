import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ShepherdSignals Portal',
  description: 'Procurement intelligence for golf & hospitality',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#0a1f18] text-white antialiased">{children}</body>
    </html>
  )
}
