// apps/api/src/utils/logger.ts
/**
 * Pino 日志工具封装
 * 开发环境使用 pino-pretty 美化输出
 */
import pino from "pino";
import { config } from "../config/index";

export const logger = pino({
  level: config.server.logLevel,
  transport:
    config.server.nodeEnv === "development"
      ? {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname"
          }
        }
      : undefined
});

export type Logger = typeof logger;
