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
  type Hex
} from "viem";
import { arbitrumSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { config } from "../config/index";
import { logger } from "../utils/logger";

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

  constructor() {
    this.vaultAddress = config.external.vaultContractAddress as Address;

    this.publicClient = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(config.external.rpcUrl)
    });

    // Initialize wallet client if private key is available
    const privateKey = process.env.HEDGE_PRIVATE_KEY;
    if (privateKey) {
      const account = privateKeyToAccount(privateKey as Hex);
      this.walletClient = createWalletClient({
        chain: arbitrumSepolia,
        transport: http(config.external.rpcUrl),
        account
      });
      logger.info({ msg: "Wallet client initialized" });
    } else {
      logger.warn({
        msg: "HEDGE_PRIVATE_KEY not set, onchain operations disabled"
      });
    }
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
      throw new Error("Wallet client not initialized. Set HEDGE_PRIVATE_KEY");
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
      hash: txHash as Address
    });

    return receipt.status === "success" ? "success" : "reverted";
  }
}

export const blockchainClient = new BlockchainClient();
