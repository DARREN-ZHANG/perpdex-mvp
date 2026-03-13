'use client'

import { useAuth } from '@/hooks/use-auth'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectButton as WalletButton } from '../wallet/connect-button'

const navItems = [
  { label: '交易', href: '/' },
  { label: '资产', href: '/assets' },
  { label: '历史', href: '/history' },
]

export function Header() {
  const { isAuthenticated } = useAuth()
  const pathname = usePathname()

  return (
    <header className="h-16 bg-pro-gray-900 flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-10">
        <Link href="/" className="text-white font-bold text-2xl tracking-tight">
          PerpDex
        </Link>
        <nav className="flex gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                pathname === item.href
                  ? 'text-pro-accent-cyan bg-pro-accent-cyan/10'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <WalletButton />
      </div>
    </header>
  )
}
