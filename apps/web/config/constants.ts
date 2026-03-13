// apps/web/config/constants.ts

export const APP_NAME = 'PerpDex'
export const APP_DESCRIPTION = 'Perpetual DEX MVP'

// 本地 Anvil 链配置
const LOCALHOST_CHAIN = {
  id: 31337,
  name: 'Localhost 31337',
  nativeCurrency: {
    name: 'ETH',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['http://localhost:8545'],
    },
  },
  testnet: true,
} as const

// Arbitrum Sepolia 配置
const ARBITRUM_SEPOLIA_CHAIN = {
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
} as const

// 根据环境变量选择链
const chainId = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '421614')
export const CURRENT_CHAIN = chainId === 31337 ? LOCALHOST_CHAIN : ARBITRUM_SEPOLIA_CHAIN

// 支持的链
export const SUPPORTED_CHAINS = {
  LOCALHOST: LOCALHOST_CHAIN,
  ARBITRUM_SEPOLIA: ARBITRUM_SEPOLIA_CHAIN,
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
