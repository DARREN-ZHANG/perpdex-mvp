// apps/api/src/indexer/block-cursor.ts
/**
 * 区块游标管理器
 * 追踪已处理的区块高度，支持断点续传
 */
import { prisma } from "../db/client";
import { logger } from "../utils/logger";

export const CHAIN_ID = 421614; // Arbitrum Sepolia

export class BlockCursorManager {
  private chainId: number;
  private cursorId: string | null = null;

  constructor(chainId: number = CHAIN_ID) {
    this.chainId = chainId;
  }

  /**
   * 初始化游标
   * 如果不存在则创建，从起始区块开始
   */
  async initialize(startBlock: bigint): Promise<void> {
    const existing = await prisma.blockCursor.findUnique({
      where: { chainId: this.chainId }
    });

    if (existing) {
      this.cursorId = existing.id;
      logger.info({
        msg: "Block cursor loaded",
        chainId: this.chainId,
        cursor: existing.cursor.toString()
      });
    } else {
      const created = await prisma.blockCursor.create({
        data: {
          chainId: this.chainId,
          cursor: startBlock
        }
      });
      this.cursorId = created.id;
      logger.info({
        msg: "Block cursor created",
        chainId: this.chainId,
        startBlock: startBlock.toString()
      });
    }
  }

  /**
   * 获取当前游标
   */
  async getCursor(): Promise<bigint> {
    if (!this.cursorId) {
      throw new Error("Cursor not initialized. Call initialize() first.");
    }

    const cursor = await prisma.blockCursor.findUnique({
      where: { id: this.cursorId }
    });

    if (!cursor) {
      throw new Error("Cursor record not found");
    }

    return cursor.cursor;
  }

  /**
   * 更新游标
   * 仅当新区块 > 当前游标时才更新
   */
  async advanceCursor(newBlock: bigint): Promise<void> {
    if (!this.cursorId) {
      throw new Error("Cursor not initialized. Call initialize() first.");
    }

    const current = await this.getCursor();

    if (newBlock > current) {
      await prisma.blockCursor.update({
        where: { id: this.cursorId },
        data: { cursor: newBlock }
      });

      logger.debug({
        msg: "Block cursor advanced",
        chainId: this.chainId,
        fromBlock: current.toString(),
        toBlock: newBlock.toString()
      });
    }
  }

  /**
   * 批量更新游标（带事务）
   */
  async advanceCursorWithTx(newBlock: bigint, tx: typeof prisma): Promise<void> {
    if (!this.cursorId) {
      throw new Error("Cursor not initialized. Call initialize() first.");
    }

    await tx.blockCursor.update({
      where: { id: this.cursorId },
      data: { cursor: newBlock }
    });
  }
}
