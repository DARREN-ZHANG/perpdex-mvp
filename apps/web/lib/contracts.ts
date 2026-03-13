// apps/web/lib/contracts.ts

// 检测是否为本地链
const isLocalChain = process.env.NEXT_PUBLIC_CHAIN_ID === '31337'

// 合约地址配置
export const CONTRACT_ADDRESSES = {
  // Vault 合约地址
  VAULT: process.env.NEXT_PUBLIC_VAULT_ADDRESS || (isLocalChain
    ? '0x0000000000000000000000000000000000000000' // 本地链需要部署后设置
    : '0x0000000000000000000000000000000000000000'),
  // USDC 合约地址
  USDC: process.env.NEXT_PUBLIC_USDC_ADDRESS || (isLocalChain
    ? '0x0000000000000000000000000000000000000000' // 本地链使用 MockUSDC
    : '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d'), // Arbitrum Sepolia USDC
} as const

// 检查合约是否已配置
export function areContractsConfigured(): boolean {
  return CONTRACT_ADDRESSES.VAULT !== '0x0000000000000000000000000000000000000000' &&
         CONTRACT_ADDRESSES.USDC !== '0x0000000000000000000000000000000000000000'
}

// ERC20 标准 ABI（USDC）
export const ERC20_ABI = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: 'remaining', type: 'uint256' }],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'decimals', type: 'uint8' }],
  },
  {
    name: 'symbol',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'symbol', type: 'string' }],
  },
] as const

// Vault 合约 ABI
export const VAULT_ABI = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: 'balance', type: 'uint256' }],
  },
  {
    name: 'USDC',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'usdc', type: 'address' }],
  },
  {
    name: 'totalAssets',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'total', type: 'uint256' }],
  },
  {
    name: 'Deposit',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256' },
    ],
  },
  {
    name: 'Withdraw',
    type: 'event',
    inputs: [
      { name: 'user', type: 'address', indexed: true },
      { name: 'amount', type: 'uint256' },
    ],
  },
] as const

// USDC 精度
export const USDC_DECIMALS = 6

// 格式化 USDC 金额（从 wei 到可读格式）
export function formatUSDC(amount: bigint | string): string {
  const value = typeof amount === 'string' ? BigInt(amount) : amount
  const divisor = BigInt(10 ** USDC_DECIMALS)
  const integerPart = value / divisor
  const fractionalPart = value % divisor
  const fractionalStr = fractionalPart.toString().padStart(USDC_DECIMALS, '0')
  // 移除末尾的0
  const trimmedFractional = fractionalStr.replace(/0+$/, '')
  return trimmedFractional ? `${integerPart}.${trimmedFractional}` : integerPart.toString()
}

// 解析 USDC 金额（从可读格式到 wei）
export function parseUSDC(amount: string): bigint {
  const [integerPart, fractionalPart = ''] = amount.split('.')
  const paddedFractional = fractionalPart.padEnd(USDC_DECIMALS, '0').slice(0, USDC_DECIMALS)
  return BigInt(integerPart) * BigInt(10 ** USDC_DECIMALS) + BigInt(paddedFractional)
}
