'use client'

import { useAuth } from '@/hooks/use-auth'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { WalletButton } from '../wallet/connect-button'
import { useBalance } from '@/hooks/use-balance'

const navItems = [
  { label: '交易', href: '/' },
  { label: '资产', href: '/assets' },
  { label: '历史', href: '/history' },
]

export function Header() {
  const { isAuthenticated } = useAuth()
  const { balance } = useBalance()
  const pathname = usePathname()

  return (
    <header className="h-16 bg-pro-gray-900 flex items-center justify-between px-6 sticky top-0 z-50">
      <div className="flex items-center gap-10">
        <Link href="/" className="text-white font-bold text-xl tracking-tight">
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
        {isAuthenticated && balance && (
          <div className="text-sm text-gray-400">
            <span className="text-white font-medium">
              {Number(balance.available).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>{' '}
            USDC
          </div>
        )}
        <WalletButton />
      </div>
    </header>
  )
}
