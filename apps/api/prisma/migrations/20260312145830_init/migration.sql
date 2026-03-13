-- CreateEnum
CREATE TYPE "AccountAsset" AS ENUM ('USDC');

-- CreateEnum
CREATE TYPE "MarketSymbol" AS ENUM ('BTC');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('LONG', 'SHORT');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MARKET');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'FILLED', 'FAILED', 'CANCELED');

-- CreateEnum
CREATE TYPE "PositionStatus" AS ENUM ('OPEN', 'CLOSED', 'LIQUIDATED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('SAFE', 'WARNING', 'DANGER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAW', 'MARGIN_LOCK', 'MARGIN_RELEASE', 'REALIZED_PNL', 'FEE', 'LIQUIDATION');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED', 'REVERTED');

-- CreateEnum
CREATE TYPE "ChainEventName" AS ENUM ('DEPOSIT', 'WITHDRAW');

-- CreateEnum
CREATE TYPE "HedgeTrigger" AS ENUM ('OPEN', 'CLOSE', 'MARGIN_ADJUST', 'LIQUIDATION', 'MANUAL');

-- CreateEnum
CREATE TYPE "HedgeStatus" AS ENUM ('PENDING', 'SUBMITTED', 'FILLED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "wallet_address" VARCHAR(42) NOT NULL,
    "nonce" VARCHAR(191),
    "nonce_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_login_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "asset" "AccountAsset" NOT NULL DEFAULT 'USDC',
    "available_balance" BIGINT NOT NULL DEFAULT 0,
    "locked_balance" BIGINT NOT NULL DEFAULT 0,
    "equity" BIGINT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "position_id" TEXT,
    "client_order_id" VARCHAR(64),
    "symbol" "MarketSymbol" NOT NULL,
    "side" "OrderSide" NOT NULL,
    "type" "OrderType" NOT NULL DEFAULT 'MARKET',
    "size" DECIMAL(36,18) NOT NULL,
    "requested_price" DECIMAL(36,18),
    "executed_price" DECIMAL(36,18),
    "margin" BIGINT NOT NULL,
    "leverage" INTEGER NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "failure_code" VARCHAR(64),
    "failure_message" VARCHAR(255),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "filled_at" TIMESTAMP(3),

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "symbol" "MarketSymbol" NOT NULL,
    "side" "OrderSide" NOT NULL,
    "position_size" DECIMAL(36,18) NOT NULL,
    "entry_price" DECIMAL(36,18) NOT NULL,
    "mark_price" DECIMAL(36,18) NOT NULL,
    "unrealized_pnl" DECIMAL(36,18) NOT NULL,
    "liquidation_price" DECIMAL(36,18) NOT NULL,
    "margin" BIGINT NOT NULL,
    "status" "PositionStatus" NOT NULL DEFAULT 'OPEN',
    "risk_level" "RiskLevel" NOT NULL DEFAULT 'SAFE',
    "metadata" JSONB,
    "opened_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT,
    "type" "TransactionType" NOT NULL,
    "event_name" "ChainEventName",
    "tx_hash" VARCHAR(66),
    "log_index" INTEGER,
    "block_number" BIGINT,
    "amount" BIGINT NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "idempotency_key" VARCHAR(191),
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "confirmed_at" TIMESTAMP(3),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hedge_orders" (
    "id" TEXT NOT NULL,
    "task_id" VARCHAR(64) NOT NULL,
    "user_id" TEXT NOT NULL,
    "order_id" TEXT,
    "position_id" TEXT,
    "external_order_id" VARCHAR(128),
    "symbol" "MarketSymbol" NOT NULL,
    "side" "OrderSide" NOT NULL,
    "size" DECIMAL(36,18) NOT NULL,
    "reference_price" DECIMAL(36,18),
    "trigger" "HedgeTrigger" NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "status" "HedgeStatus" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "max_retry_count" INTEGER NOT NULL DEFAULT 3,
    "error_message" VARCHAR(255),
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "submitted_at" TIMESTAMP(3),
    "filled_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),

    CONSTRAINT "hedge_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "block_cursors" (
    "id" TEXT NOT NULL,
    "chain_id" INTEGER NOT NULL,
    "cursor" BIGINT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "block_cursors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_wallet_address_key" ON "users"("wallet_address");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_user_id_asset_key" ON "accounts"("user_id", "asset");

-- CreateIndex
CREATE UNIQUE INDEX "orders_client_order_id_key" ON "orders"("client_order_id");

-- CreateIndex
CREATE INDEX "orders_user_id_created_at_idx" ON "orders"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_position_id_idx" ON "orders"("position_id");

-- CreateIndex
CREATE INDEX "positions_user_id_status_idx" ON "positions"("user_id", "status");

-- CreateIndex
CREATE INDEX "positions_user_id_symbol_updated_at_idx" ON "positions"("user_id", "symbol", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_idempotency_key_key" ON "transactions"("idempotency_key");

-- CreateIndex
CREATE INDEX "transactions_user_id_created_at_idx" ON "transactions"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "transactions_status_created_at_idx" ON "transactions"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_tx_hash_log_index_event_name_key" ON "transactions"("tx_hash", "log_index", "event_name");

-- CreateIndex
CREATE UNIQUE INDEX "hedge_orders_task_id_key" ON "hedge_orders"("task_id");

-- CreateIndex
CREATE INDEX "hedge_orders_status_priority_created_at_idx" ON "hedge_orders"("status", "priority", "created_at");

-- CreateIndex
CREATE INDEX "hedge_orders_user_id_updated_at_idx" ON "hedge_orders"("user_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "block_cursors_chain_id_key" ON "block_cursors"("chain_id");

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hedge_orders" ADD CONSTRAINT "hedge_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hedge_orders" ADD CONSTRAINT "hedge_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hedge_orders" ADD CONSTRAINT "hedge_orders_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
