import type { FastifyInstance, FastifyRequest } from "fastify";
import { hedgeTaskListQuerySchema } from "@perpdex/shared";
import { prisma } from "../db/client";
import { requireAuth, type JwtUser } from "../middleware/auth";

function getJwtUser(request: FastifyRequest): JwtUser {
  const user = request.user as JwtUser | undefined;
  if (!user) {
    throw new Error("User not authenticated");
  }
  return user;
}

export async function hedgeRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/hedge/tasks",
    { preHandler: [requireAuth] },
    async (request) => {
      const user = getJwtUser(request);
      const query = hedgeTaskListQuerySchema.parse(request.query ?? {});

      const items = await prisma.hedgeOrder.findMany({
        where: {
          userId: user.id,
          ...(query.status ? { status: query.status } : {}),
          ...(query.priority
            ? {
                priority:
                  query.priority === "HIGH"
                    ? 1
                    : query.priority === "LOW"
                      ? 10
                      : 5
              }
            : {})
        },
        orderBy: { createdAt: "desc" },
        take: query.limit
      });

      return {
        data: {
          items: items.map((item) => ({
            taskId: item.taskId,
            symbol: item.symbol,
            side: item.side,
            size: item.size.toString(),
            priority:
              item.priority <= 1
                ? "HIGH"
                : item.priority >= 10
                  ? "LOW"
                  : "NORMAL",
            retryCount: item.retryCount,
            maxRetries: item.maxRetryCount,
            status: item.status,
            externalOrderId: item.externalOrderId ?? undefined,
            updatedAt: item.updatedAt.toISOString(),
            lastErrorMessage: item.errorMessage ?? undefined
          }))
        },
        error: null,
        meta: { requestId: request.id }
      };
    }
  );
}
