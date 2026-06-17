import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title:       'Faultline',
  description: 'Assumption auditor for prediction markets — find fault lines in market consensus',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-950 text-gray-100 min-h-screen font-mono">
        <nav className="border-b border-gray-800 px-6 py-3 flex items-center gap-6">
          <span className="font-bold text-white">Faultline</span>
          <a href="/"          className="text-gray-400 hover:text-white text-sm">Home</a>
          <a href="/dashboard" className="text-gray-400 hover:text-white text-sm">Dashboard</a>
        </nav>
        {children}
      </body>
    </html>
  )
}
