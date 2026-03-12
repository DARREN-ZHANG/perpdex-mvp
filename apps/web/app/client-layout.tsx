// apps/web/app/client-layout.tsx
'use client'

import type { ReactNode } from 'react'
import { Web3Provider } from '@/config/wagmi'
import { Header } from '@/components/layout/header'
import { Sidebar } from '@/components/layout/sidebar'
import { Providers } from './providers'

export function ClientLayout({ children }: { children: ReactNode }) {
  return (
    <Providers>
      <Web3Provider>
        <Header />
        <Sidebar />
        <main className="pt-16 pl-64 min-h-screen">
          <div className="p-6">{children}</div>
        </main>
      </Web3Provider>
    </Providers>
  )
}
