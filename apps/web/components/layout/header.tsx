// apps/web/components/layout/header.tsx
import { ConnectButton } from '@/components/wallet/connect-button'
import Link from 'next/link'

const NAV_LINKS = [
  { href: '/', label: '交易' },
  { href: '/positions', label: '仓位' },
  { href: '/assets', label: '资产' },
  { href: '/history', label: '历史' },
]

export function Header() {
  return (
    <header className="h-16 border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm fixed top-0 left-0 right-0 z-50">
      <div className="h-full px-4 flex items-center justify-between max-w-[1920px] mx-auto">
        {/* Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">P</span>
            </div>
            <span className="text-xl font-bold text-white">PerpDex</span>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-4 py-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-4">
          {/* Network Badge */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-800 rounded-lg">
            <span className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm text-gray-300">Arbitrum Sepolia</span>
          </div>

          {/* Connect Button */}
          <ConnectButton />
        </div>
      </div>
    </header>
  )
}
