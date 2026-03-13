import type { ReactNode } from "react";
import { Toaster } from "sonner";
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
            <Toaster
              position="top-right"
              richColors
              closeButton
              toastOptions={{
                style: {
                  background: '#1f2937',
                  border: '1px solid #374151',
                  color: '#f3f4f6',
                },
                classNames: {
                  toast: 'pr-12',
                  closeButton:
                    '!right-3 !top-3 !left-auto !translate-x-0 !translate-y-0 !border-0 !bg-pro-gray-700 !text-pro-gray-100 hover:!bg-pro-gray-600',
                },
              }}
            />
          </Web3Provider>
        </Providers>
      </body>
    </html>
  );
}
