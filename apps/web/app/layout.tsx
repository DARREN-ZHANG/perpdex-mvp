// apps/web/app/layout.tsx
import type { ReactNode } from "react";
import { Web3Provider } from "@/config/wagmi";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { Providers } from "./providers";
import "./globals.css";

export const metadata = {
  title: "PerpDex - Perpetual DEX",
  description: "Perpetual DEX MVP",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-gray-950 text-white min-h-screen">
        <Providers>
          <Web3Provider>
            <Header />
            <Sidebar />
            <main className="pt-16 pl-64 min-h-screen">
              <div className="p-6">
                {children}
              </div>
            </main>
          </Web3Provider>
        </Providers>
      </body>
    </html>
  );
}
