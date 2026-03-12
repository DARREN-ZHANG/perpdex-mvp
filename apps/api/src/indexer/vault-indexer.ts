// apps/api/src/indexer/vault-indexer.ts
/**
 * Vault 合约事件监听器
 * 监听 Deposit/Withdraw 事件并同步到数据库
 */
import {
  createPublicClient,
  http,
  parseAbiItem,
  type Address,
  type Log
} from "viem";
import { arbitrumSepolia } from "viem/chains";
import { config } from "../config/index";
import { logger } from "../utils/logger";
import { BlockCursorManager } from "./block-cursor";
import { EventHandler, type DepositEvent, type WithdrawEvent } from "./event-handler";

// Vault 合约 ABI (事件定义)
const VAULT_EVENTS = [
  parseAbiItem("event Deposit(address indexed user, uint256 amount)"),
  parseAbiItem("event Withdraw(address indexed user, uint256 amount)")
] as const;

export class VaultIndexer {
  private client: ReturnType<typeof createPublicClient>;
  private vaultAddress: Address;
  private cursorManager: BlockCursorManager;
  private eventHandler: EventHandler;
  private isRunning: boolean = false;
  private pollInterval: number = 2000; // 2 秒

  constructor() {
    this.vaultAddress = config.external.vaultContractAddress as Address;
    this.cursorManager = new BlockCursorManager();
    this.eventHandler = new EventHandler();

    this.client = createPublicClient({
      chain: arbitrumSepolia,
      transport: http(config.external.rpcUrl)
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
      chainId: arbitrumSepolia.id
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

    // 没有新区块
    if (fromBlock >= latestBlock) {
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
      event: VAULT_EVENTS[0],
      fromBlock,
      toBlock
    });

    // 获取 Withdraw 事件
    const withdrawLogs = await this.client.getLogs({
      address: this.vaultAddress,
      event: VAULT_EVENTS[1],
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
      await this.processDepositLog(log);
    }

    // 处理 Withdraw 事件
    for (const log of withdrawLogs) {
      await this.processWithdrawLog(log);
    }

    // 更新游标
    await this.cursorManager.advanceCursor(toBlock + 1n);
  }

  /**
   * 处理 Deposit 日志
   */
  private async processDepositLog(log: Log<bigint, number, typeof VAULT_EVENTS[0]>): Promise<void> {
    if (!log.args || log.blockNumber === undefined) {
      return;
    }

    const event: DepositEvent = {
      user: log.args.user,
      amount: log.args.amount,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.logIndex
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
  private async processWithdrawLog(log: Log<bigint, number, typeof VAULT_EVENTS[1]>): Promise<void> {
    if (!log.args || log.blockNumber === undefined) {
      return;
    }

    const event: WithdrawEvent = {
      user: log.args.user,
      amount: log.args.amount,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.logIndex
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
