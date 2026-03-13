// apps/api/src/indexer/vault-indexer.ts
/**
 * Vault 合约事件监听器
 * 监听 Deposit/Withdraw 事件并同步到数据库
 */
import {
  createPublicClient,
  http,
  type Address,
  type Log,
  type Chain
} from "viem";
import { arbitrumSepolia, foundry } from "viem/chains";
import { config } from "../config/index";
import { logger } from "../utils/logger";
import { BlockCursorManager } from "./block-cursor";
import { EventHandler, type DepositEvent, type WithdrawEvent } from "./event-handler";

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

export class VaultIndexer {
  private client: ReturnType<typeof createPublicClient>;
  private vaultAddress: Address;
  private cursorManager: BlockCursorManager;
  private eventHandler: EventHandler;
  private isRunning: boolean = false;
  private pollInterval: number = 2000; // 2 秒

  // 事件 ABI
  private readonly depositEvent = {
    type: "event" as const,
    name: "Deposit" as const,
    inputs: [
      { type: "address", name: "user", indexed: true },
      { type: "uint256", name: "amount", indexed: false }
    ]
  } as const;

  private readonly withdrawEvent = {
    type: "event" as const,
    name: "Withdraw" as const,
    inputs: [
      { type: "address", name: "user", indexed: true },
      { type: "uint256", name: "amount", indexed: false }
    ]
  } as const;

  constructor() {
    this.vaultAddress = config.external.vaultContractAddress as Address;
    this.cursorManager = new BlockCursorManager(config.external.chainId);
    this.eventHandler = new EventHandler();

    const chain = getChain(config.external.chainId);
    this.client = createPublicClient({
      chain,
      transport: http(config.external.rpcUrl)
    });

    logger.info({
      msg: "Vault indexer initialized",
      chainId: chain.id,
      chainName: chain.name,
      vaultAddress: this.vaultAddress
    });
  }

  /**
   * 启动 Indexer
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn({ msg: "Vault indexer already running" });
      return;
    }

    logger.info({
      msg: "Starting Vault indexer",
      vaultAddress: this.vaultAddress,
      chainId: config.external.chainId
    });

    // 初始化游标（从当前区块 - 100 开始，避免错过事件）
    const latestBlock = await this.client.getBlockNumber();
    const startBlock = latestBlock - 100n;
    await this.cursorManager.initialize(startBlock);

    this.isRunning = true;

    // 启动轮询
    this.poll();
  }

  /**
   * 停止 Indexer
   */
  stop(): void {
    this.isRunning = false;
    logger.info({ msg: "Vault indexer stopped" });
  }

  /**
   * 轮询事件
   */
  private async poll(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.fetchAndProcessEvents();
      } catch (error) {
        logger.error({
          msg: "Error in indexer poll loop",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }

      // 等待下一次轮询
      await this.sleep(this.pollInterval);
    }
  }

  /**
   * 获取并处理事件
   */
  private async fetchAndProcessEvents(): Promise<void> {
    const fromBlock = await this.cursorManager.getCursor();
    const latestBlock = await this.client.getBlockNumber();

    // cursor 表示“下一个要处理的区块”，因此当 fromBlock === latestBlock 时
    // 仍然需要处理该最新区块，只有 fromBlock 已经超过最新区块时才能跳过。
    if (fromBlock > latestBlock) {
      return;
    }

    // 限制单次查询的区块范围，避免 RPC 超时
    const toBlock = fromBlock + 1000n > latestBlock ? latestBlock : fromBlock + 1000n;

    logger.debug({
      msg: "Fetching events",
      fromBlock: fromBlock.toString(),
      toBlock: toBlock.toString()
    });

    // 获取 Deposit 事件
    const depositLogs = await this.client.getLogs({
      address: this.vaultAddress,
      event: this.depositEvent,
      fromBlock,
      toBlock
    });

    // 获取 Withdraw 事件
    const withdrawLogs = await this.client.getLogs({
      address: this.vaultAddress,
      event: this.withdrawEvent,
      fromBlock,
      toBlock
    });

    logger.debug({
      msg: "Events fetched",
      depositCount: depositLogs.length,
      withdrawCount: withdrawLogs.length
    });

    // 处理 Deposit 事件
    for (const log of depositLogs) {
      await this.processDepositLog(log as Log);
    }

    // 处理 Withdraw 事件
    for (const log of withdrawLogs) {
      await this.processWithdrawLog(log as Log);
    }

    // 更新游标
    await this.cursorManager.advanceCursor(toBlock + 1n);
  }

  /**
   * 处理 Deposit 日志
   */
  private async processDepositLog(log: Log): Promise<void> {
    // 使用 any 绕过 viem 复杂的类型推断
    const args = (log as any).args;
    if (!args || log.blockNumber === undefined) {
      return;
    }

    const event: DepositEvent = {
      user: args.user as `0x${string}`,
      amount: args.amount as bigint,
      blockNumber: log.blockNumber as bigint,
      transactionHash: log.transactionHash as `0x${string}`,
      logIndex: (log.logIndex ?? 0) as number
    };

    try {
      await this.eventHandler.handleDeposit(event);
    } catch (error) {
      logger.error({
        msg: "Failed to process Deposit event",
        txHash: event.transactionHash,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  /**
   * 处理 Withdraw 日志
   */
  private async processWithdrawLog(log: Log): Promise<void> {
    // 使用 any 绕过 viem 复杂的类型推断
    const args = (log as any).args;
    if (!args || log.blockNumber === undefined) {
      return;
    }

    const event: WithdrawEvent = {
      user: args.user as `0x${string}`,
      amount: args.amount as bigint,
      blockNumber: log.blockNumber as bigint,
      transactionHash: log.transactionHash as `0x${string}`,
      logIndex: (log.logIndex ?? 0) as number
    };

    try {
      await this.eventHandler.handleWithdraw(event);
    } catch (error) {
      logger.error({
        msg: "Failed to process Withdraw event",
        txHash: event.transactionHash,
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
