import type { ReactNode } from "react";
import { Web3Provider } from "@/config/wagmi";
import { Header } from "@/components/layout/header";
import { Providers } from "./providers";
import "./globals.css";

export const metadata = {
  title: "PerpDex - Perpetual DEX",
  description: "Perpetual DEX MVP",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="bg-pro-gray-50 text-pro-gray-800 min-h-screen">
        <Providers>
          <Web3Provider>
            <Header />
            <main className="min-h-[calc(100vh-64px)]">
              {children}
            </main>
          </Web3Provider>
        </Providers>
      </body>
    </html>
  );
}
