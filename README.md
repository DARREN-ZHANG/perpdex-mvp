# PerpDex MVP

Monorepo foundation for the PerpDex MVP.

## Workspace

- `apps/api`: Fastify API, Prisma schema, SIWE/auth, account and trade services
- `apps/web`: Next.js 15 frontend
- `packages/shared`: shared DTOs, Zod schemas, queue/onchain contracts, mocks
- `packages/contracts`: shared contract package for ABI and chain constants

## Commands

- `pnpm dev`
- `pnpm build`
- `pnpm lint`
- `pnpm test`
- `pnpm typecheck`
- `pnpm db:generate`
- `pnpm db:migrate`

## Docs

- [Architecture](./docs/ARCHITECTURE.md)
- [PRD](./docs/PerpDex-PRD.md)
- [Development Board](./docs/DEVELOPMENT-BOARD.md)
- [Engineering Conventions](./docs/ENGINEERING-CONVENTIONS.md)
