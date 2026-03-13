// apps/api/src/ws/index.ts
/**
 * Socket.IO 服务骨架
 * 用于实时推送行情和仓位更新
 */
import { Server } from "socket.io";
import type { FastifyInstance } from "fastify";
import { config } from "../config/index";
import { logger } from "../utils/logger";
import { extractBearerToken } from "../utils/jwt";

let io: Server | null = null;

export interface SocketUser {
  id: string;
  walletAddress: string;
}

/**
 * 余额更新数据
 */
export interface BalanceUpdate {
  availableBalance: string;
  lockedBalance: string;
  totalBalance: string;
}

/**
 * 创建 Socket.IO 服务器
 */
export function createSocketServer(app: FastifyInstance): Server {
  if (io) {
    return io;
  }

  const httpServer = app.server;

  io = new Server(httpServer, {
    cors: {
      origin: [config.socket.corsOrigin],
      methods: ["GET", "POST"],
      credentials: true
    },
    path: "/socket.io"
  });

  // Authentication middleware
  io.use((socket, next) => {
    const authToken = socket.handshake.auth.token;
    const bearerToken = extractBearerToken(
      typeof socket.handshake.headers.authorization === "string"
        ? socket.handshake.headers.authorization
        : undefined
    );
    const token = authToken || bearerToken;

    if (!token) {
      // Allow anonymous connections for market data
      socket.data.user = null;
      return next();
    }

    try {
      // Verify JWT token
      const decoded = app.jwt.verify(token) as {
        sub: string;
        walletAddress: string;
      };
      socket.data.user = {
        id: decoded.sub,
        walletAddress: decoded.walletAddress
      } as SocketUser;
      next();
    } catch {
      // Token invalid, allow anonymous connection
      socket.data.user = null;
      next();
    }
  });

  io.on("connection", (socket) => {
    logger.info({ socketId: socket.id }, "Client connected");

    // Market data subscription
    socket.on("subscribe:market", (data: { symbol: string }) => {
      socket.join(`market:${data.symbol}`);
      logger.debug(
        { socketId: socket.id, symbol: data.symbol },
        "Subscribed to market"
      );
    });

    socket.on("unsubscribe:market", (data: { symbol: string }) => {
      socket.leave(`market:${data.symbol}`);
      logger.debug(
        { socketId: socket.id, symbol: data.symbol },
        "Unsubscribed from market"
      );
    });

    // Position updates subscription (requires auth)
    socket.on("subscribe:position", (data: { userId: string }) => {
      if (!socket.data.user) {
        socket.emit("error", { message: "Authentication required" });
        return;
      }
      const subscribedUserId = socket.data.user.id;
      socket.join(`position:${subscribedUserId}`);
      logger.debug(
        {
          socketId: socket.id,
          requestedUserId: data.userId,
          subscribedUserId
        },
        "Subscribed to position"
      );
    });

    socket.on("unsubscribe:position", (data: { userId: string }) => {
      const subscribedUserId = socket.data.user?.id ?? data.userId;
      socket.leave(`position:${subscribedUserId}`);
    });

    socket.on("disconnect", (reason) => {
      logger.info({ socketId: socket.id, reason }, "Client disconnected");
    });
  });

  logger.info("Socket.IO server initialized");

  return io;
}

/**
 * 获取 Socket.IO 服务器实例
 */
export function getSocketServer(): Server | null {
  return io;
}

/**
 * 推送市场更新
 */
export function emitMarketUpdate(symbol: string, data: unknown): void {
  if (!io) return;
  io.to(`market:${symbol}`).emit(`market:${symbol}:update`, data);
}

/**
 * 推送仓位更新
 */
export function emitPositionUpdate(userId: string, data: unknown): void {
  if (!io) return;
  io.to(`position:${userId}`).emit(`position:${userId}:update`, data);
}

/**
 * 推送余额更新
 * Balance updates use the same room as positions
 */
export function emitBalanceUpdate(userId: string, data: BalanceUpdate): void {
  if (!io) return;
  io.to(`position:${userId}`).emit(`balance:${userId}:update`, data);
}

/**
 * 关闭 Socket.IO 服务器
 */
export function closeSocketServer(): void {
  if (io) {
    io.close();
    io = null;
  }
}
