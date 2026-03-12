// apps/api/src/middleware/error-handler.ts
/**
 * 统一错误处理中间件
 * 将所有错误转换为标准 API 响应格式
 */
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

interface ApiError {
  code: string;
  message: string;
  requestId?: string;
  details?: Record<string, unknown>;
}

function mapErrorToApiCode(error: unknown): string {
  if (error instanceof ZodError) {
    return "VALIDATION_ERROR";
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    if (message.includes("unauthorized") || message.includes("invalid token")) {
      return "UNAUTHORIZED";
    }
    if (message.includes("forbidden") || message.includes("permission")) {
      return "FORBIDDEN";
    }
    if (message.includes("not found")) {
      return "POSITION_NOT_FOUND";
    }
    if (message.includes("insufficient")) {
      return "INSUFFICIENT_BALANCE";
    }
    if (message.includes("conflict") || message.includes("already exists")) {
      return "CONFLICT";
    }
    if (message.includes("rate limit")) {
      return "RATE_LIMITED";
    }
  }

  return "INTERNAL_ERROR";
}

export function formatError(error: unknown, requestId?: string): ApiError {
  const code = mapErrorToApiCode(error);
  let message: string;
  let details: Record<string, unknown> | undefined;

  if (error instanceof ZodError) {
    message = "Validation failed";
    details = {
      issues: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    };
  } else if (error instanceof Error) {
    message = error.message;
  } else {
    message = "An unexpected error occurred";
  }

  return {
    code,
    message,
    requestId,
    details
  };
}

export async function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const requestId = request.id;
  const apiError = formatError(error, requestId);

  // Log the error
  request.log.error({
    error: {
      code: apiError.code,
      message: apiError.message,
      stack: error.stack
    },
    requestId
  });

  // Determine status code
  let statusCode = 500;
  switch (apiError.code) {
    case "UNAUTHORIZED":
      statusCode = 401;
      break;
    case "FORBIDDEN":
      statusCode = 403;
      break;
    case "VALIDATION_ERROR":
      statusCode = 400;
      break;
    case "POSITION_NOT_FOUND":
      statusCode = 404;
      break;
    case "CONFLICT":
      statusCode = 409;
      break;
    case "RATE_LIMITED":
      statusCode = 429;
      break;
    case "INSUFFICIENT_BALANCE":
    case "ORDER_EXECUTION_FAILED":
    case "RISK_LIMIT_EXCEEDED":
      statusCode = 400;
      break;
    case "SERVICE_UNAVAILABLE":
      statusCode = 503;
      break;
  }

  await reply.status(statusCode).send({
    data: null,
    error: apiError,
    meta: { requestId }
  });
}
