'use client'

import { useAuth } from '@/hooks/use-auth'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu } from 'lucide-react'
import { ConnectButton as WalletButton } from '../wallet/connect-button'
import { Drawer } from '../ui/drawer'

const navItems = [
  { label: '交易', href: '/' },
  { label: '资产', href: '/assets' },
  { label: '历史', href: '/history' },
]

export function Header() {
  const { isAuthenticated } = useAuth()
  const pathname = usePathname()
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  const handleNavClick = () => {
    setIsDrawerOpen(false)
  }

  return (
    <>
      <header className="h-16 bg-pro-gray-900 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-40">
        <div className="flex items-center gap-4 lg:gap-10">
          <Link href="/" className="text-white font-bold text-2xl tracking-tight">
            PerpDex
          </Link>
          <nav className="hidden md:flex gap-1">
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

        <div className="flex items-center gap-2 lg:gap-4">
          <WalletButton />
          <button
            className="md:hidden p-2 rounded-md text-gray-400 hover:text-white hover:bg-pro-gray-800 transition-colors"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="打开菜单"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </header>

      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        position="left"
        title="菜单"
      >
        <nav className="flex flex-col p-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
              className={`px-4 py-3 rounded-md text-base font-medium transition-colors ${
                pathname === item.href
                  ? 'text-pro-accent-cyan bg-pro-accent-cyan/10'
                  : 'text-pro-gray-700 hover:text-pro-gray-900 hover:bg-pro-gray-100'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </Drawer>
    </>
  )
}
