// apps/web/app/layout.tsx
import type { ReactNode } from "react";
import { Web3Provider } from "@/config/wagmi";

export const metadata = {
  title: "PerpDex - Perpetual DEX",
  description: "Perpetual DEX MVP",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <Web3Provider>{children}</Web3Provider>
      </body>
    </html>
  );
}
