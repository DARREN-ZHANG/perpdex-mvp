// apps/web/config/constants.ts

export const APP_NAME = 'PerpDex'
export const APP_DESCRIPTION = 'Perpetual DEX MVP'

// 支持的链
export const SUPPORTED_CHAINS = {
  ARBITRUM_SEPOLIA: {
    id: 421614,
    name: 'Arbitrum Sepolia',
    nativeCurrency: {
      name: 'ETH',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: {
      default: {
        http: ['https://sepolia-rollup.arbitrum.io/rpc'],
      },
    },
    blockExplorers: {
      default: {
        name: 'Arbiscan',
        url: 'https://sepolia.arbiscan.io',
      },
    },
    testnet: true,
  },
} as const

// API 配置
export const API_CONFIG = {
  BASE_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
}

// WebSocket 配置
export const WS_CONFIG = {
  URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
  RECONNECTION_ATTEMPTS: 10,
  RECONNECTION_DELAY: 1000,
  RECONNECTION_DELAY_MAX: 5000,
}

// 交易配置
export const TRADING_CONFIG = {
  DEFAULT_SYMBOL: 'BTC',
  MIN_MARGIN: 1,
  MAX_LEVERAGE: 20,
  DEFAULT_LEVERAGE: 10,
}
