// apps/api/src/clients/blockchain.ts
/**
 * 区块链客户端
 * 封装 viem 与合约交互
 */
import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
  type Hash,
  type Chain
} from "viem";
import { arbitrumSepolia, foundry } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../config/index";
import { logger } from "../utils/logger";

// 根据配置选择链
function getChain(chainId: number): Chain {
  if (chainId === 31337) {
    // 本地 Anvil 链
    return {
      ...foundry,
      id: 31337,
      name: "Localhost 31337",
      rpcUrls: {
        default: { http: ["http://localhost:8545"] }
      }
    };
  }
  return arbitrumSepolia;
}

// Vault ABI (仅包含需要的方法)
const VAULT_ABI = [
  {
    inputs: [
      { name: "user", type: "address" },
      { name: "amount", type: "uint256" }
    ],
    name: "withdraw",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

/**
 * 区块链客户端类
 */
export class BlockchainClient {
  private publicClient: ReturnType<typeof createPublicClient>;
  private walletClient: ReturnType<typeof createWalletClient> | null = null;
  private vaultAddress: Address;
  private chain: Chain;

  constructor() {
    this.vaultAddress = config.external.vaultContractAddress as Address;
    this.chain = getChain(config.external.chainId);

    this.publicClient = createPublicClient({
      chain: this.chain,
      transport: http(config.external.rpcUrl)
    });

    // Initialize wallet client if private key is available
    const privateKey =
      process.env.HEDGE_PRIVATE_KEY ?? process.env.HYPERLIQUID_PRIVATE_KEY;
    if (privateKey) {
      const account = privateKeyToAccount(privateKey as Hex);
      this.walletClient = createWalletClient({
        chain: this.chain,
        transport: http(config.external.rpcUrl),
        account
      });
      logger.info({
        msg: "Wallet client initialized",
        source: process.env.HEDGE_PRIVATE_KEY
          ? "HEDGE_PRIVATE_KEY"
          : "HYPERLIQUID_PRIVATE_KEY"
      });
    } else {
      logger.warn({
        msg: "No onchain private key set, onchain operations disabled",
        expectedEnvVars: ["HEDGE_PRIVATE_KEY", "HYPERLIQUID_PRIVATE_KEY"]
      });
    }

    logger.info({
      msg: "Blockchain client initialized",
      chainId: this.chain.id,
      chainName: this.chain.name,
      vaultAddress: this.vaultAddress
    });
  }

  /**
   * 获取 Vault 合约中的用户余额
   */
  async getVaultBalance(userAddress: Address): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.vaultAddress,
      abi: VAULT_ABI,
      functionName: "balanceOf",
      args: [userAddress]
    }) as Promise<bigint>;
  }

  /**
   * 执行链上提现
   */
  async executeWithdraw(userAddress: Address, amount: bigint): Promise<string> {
    if (!this.walletClient) {
      throw new Error(
        "Wallet client not initialized. Set HEDGE_PRIVATE_KEY or HYPERLIQUID_PRIVATE_KEY"
      );
    }

    const { request } = await this.publicClient.simulateContract({
      address: this.vaultAddress,
      abi: VAULT_ABI,
      functionName: "withdraw",
      args: [userAddress, amount],
      account: this.walletClient.account
    });

    const hash = await this.walletClient.writeContract(request);

    logger.info({
      msg: "Withdraw transaction submitted",
      userAddress,
      amount: amount.toString(),
      txHash: hash
    });

    return hash;
  }

  /**
   * 等待交易确认
   */
  async waitForTransaction(txHash: string): Promise<"success" | "reverted"> {
    const receipt = await this.publicClient.waitForTransactionReceipt({
      hash: txHash as Hash
    });

    return receipt.status === "success" ? "success" : "reverted";
  }
}

export const blockchainClient = new BlockchainClient();

/**
 * 导出 publicClient 用于健康检查
 */
export const publicClient = blockchainClient["publicClient"];
