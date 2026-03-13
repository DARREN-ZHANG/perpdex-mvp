// apps/api/src/app.ts
/**
 * Fastify 应用配置
 * 注册插件、中间件和路由
 */
import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import {
  serializerCompiler,
  validatorCompiler
} from "fastify-type-provider-zod";
import { config } from "./config/index";
import { errorHandler } from "./middleware/error-handler";
import { registerRoutes } from "./routes/index";
import { logger } from "./utils/logger";

export async function buildServer() {
  const app = Fastify({
    logger: {
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
    },
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "requestId"
  });

  // Set Zod validator and serializer
  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // Register CORS
  await app.register(cors, {
    origin: config.socket.corsOrigin,
    credentials: true
  });

  // Register JWT
  await app.register(jwt, {
    secret: config.jwt.secret,
    sign: {
      expiresIn: config.jwt.expiresIn
    }
  });

  // Register rate limiting (skip in test)
  if (config.server.nodeEnv !== "test") {
    await app.register(rateLimit, {
      max: 100,
      timeWindow: "1 minute"
    });
  }

  // Set error handler
  app.setErrorHandler(errorHandler);

  // Register routes
  await registerRoutes(app);

  return app;
}
