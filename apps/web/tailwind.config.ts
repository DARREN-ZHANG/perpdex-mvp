import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      colors: {
        // Pro Light 配色系统
        "pro-gray": {
          50: "#F8F9FA",   // 珍珠灰 - 主背景
          100: "#F1F5F9",  // 边框/分割线
          200: "#E2E8F0",  // 输入框边框
          300: "#CBD5E1",
          400: "#94A3B8",  // 次要文字
          500: "#64748B",  // 辅助灰
          600: "#475569",
          700: "#334155",
          800: "#1E293B",  // 碳黑色 - 主要文字
          900: "#0F172A",  // 曜石黑 - 品牌主色
        },
        "pro-accent": {
          cyan: "#0EA5E9",     // 科技青
          green: "#059669",    // 森林绿
          red: "#DC2626",      // 砖红色
        },
      },
      fontFamily: {
        mono: ["SF Mono", "Monaco", "monospace"],
      },
      borderRadius: {
        lg: "8px",
        md: "6px",
      },
      boxShadow: {
        panel: "0 1px 3px rgba(0,0,0,0.04)",
        float: "0 2px 8px rgba(0,0,0,0.08)",
        hover: "0 4px 12px rgba(0,0,0,0.1)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
