// scripts/test-hyperliquid.ts
/**
 * 测试 HyperLiquid 客户端
 * 验证客户端初始化和基本功能
 */

// 设置环境变量
process.env.HYPERLIQUID_PRIVATE_KEY = "0x25c86c1b938d513e89579f42cb1c527f3c179f6b1b9834a03ab880858bc5f10a";

import { HyperliquidClient } from "../src/clients/hyperliquid";

async function main() {
  console.log("=== Testing HyperLiquid Client ===\n");

  const client = new HyperliquidClient();

  // 检查客户端是否初始化成功
  console.log("1. 检查客户端初始化状态...");
  console.log(`   客户端就绪: ${client.isReady()}`);
  console.log(`   钱包地址: ${client.getWalletAddress()}\n`);

  if (!client.isReady()) {
    console.error("❌ 客户端初始化失败!");
    process.exit(1);
  }

  // 测试获取市场价格
  console.log("2. 测试获取市场价格...");
  try {
    const btcPrice = await client.getMarkPrice("BTC");
    console.log(`   BTC 市场价格: $${btcPrice}`);

    const ethPrice = await client.getMarkPrice("ETH");
    console.log(`   ETH 市场价格: $${ethPrice}\n`);
  } catch (error) {
    console.error("   ❌ 获取市场价格失败:", error);
  }

  // 测试获取持仓
  console.log("3. 测试获取当前持仓...");
  try {
    const positions = await client.getPositions();
    console.log(`   当前持仓数量: ${positions.length}`);
    if (positions.length > 0) {
      positions.forEach(pos => {
        console.log(`   - ${pos.coin}: ${pos.szi} @ $${pos.entryPx}`);
      });
    } else {
      console.log("   暂无持仓");
    }
    console.log();
  } catch (error) {
    console.error("   ❌ 获取持仓失败:", error);
  }

  // 测试提交小额订单
  console.log("4. 测试提交市价订单 (测试网)...");
  try {
    // 小额测试: 买入 0.005 ETH (约 $10)
    const result = await client.submitMarketOrder("ETH", "buy", "0.005");
    console.log("   ✅ 订单提交成功:");
    console.log(`      订单ID: ${result.orderId}`);
    console.log(`      成交价格: $${result.averagePrice}\n`);
  } catch (error) {
    console.error("   ❌ 订单提交失败:", error);
  }

  // 再次查看持仓确认
  console.log("5. 确认订单后的持仓...");
  try {
    const positions = await client.getPositions();
    console.log(`   当前持仓数量: ${positions.length}`);
    positions.forEach(pos => {
      console.log(`   - ${pos.coin}: ${pos.szi} @ $${pos.entryPx}`);
    });
    console.log();
  } catch (error) {
    console.error("   ❌ 获取持仓失败:", error);
  }

  console.log("\n=== 测试完成 ===");
}

main().catch(console.error);
