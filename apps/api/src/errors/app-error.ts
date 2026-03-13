export type AppErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "VALIDATION_ERROR"
  | "POSITION_NOT_FOUND"
  | "INSUFFICIENT_BALANCE"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "ORDER_EXECUTION_FAILED"
  | "RISK_LIMIT_EXCEEDED"
  | "SERVICE_UNAVAILABLE"
  | "ACCOUNT_NOT_FOUND"
  | "HEDGE_TASK_ENQUEUE_FAILED";

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly statusCode: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: AppErrorCode,
    message: string,
    options?: {
      statusCode?: number;
      details?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.statusCode = options?.statusCode ?? 400;
    this.details = options?.details;
  }
}
