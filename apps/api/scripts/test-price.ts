// scripts/test-price.ts
/**
 * 测试 Hyperliquid 价格获取
 * 运行: cd apps/api && npx tsx scripts/test-price.ts
 */

async function main() {
  console.log("测试 Hyperliquid 价格获取...\n");

  // 直接测试 API 调用
  const apiUrl = process.env.HYPERLIQUID_API_URL || "https://api.hyperliquid.xyz";
  console.log("API URL:", apiUrl);

  try {
    const response = await fetch(`${apiUrl}/info`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "metaAndAssetCtxs"
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    console.log("\n✅ API 响应成功");

    // 解析 BTC 价格
    // metaAndAssetCtxs 返回格式: [meta, assetCtxs]
    // meta = { universe: [{ name: "BTC", ... }, ...] }
    // assetCtxs = [{ markPx: "...", ... }, ...]
    let btcPrice: string | null = null;

    if (Array.isArray(result) && result.length >= 2) {
      const meta = result[0] as { universe: Array<{ name: string }> };
      const assetCtxs = result[1] as Array<{ markPx?: string }>;

      if (meta?.universe && Array.isArray(assetCtxs)) {
        // 查找 BTC 的索引
        const btcIndex = meta.universe.findIndex((item) => item.name === "BTC");
        if (btcIndex >= 0 && assetCtxs[btcIndex]) {
          btcPrice = assetCtxs[btcIndex].markPx ?? null;
        }
      }
    }

    if (btcPrice) {
      console.log("\n💰 BTC 标记价格:", btcPrice, "USD");

      const mockPrice = 50000;
      const realPrice = parseFloat(btcPrice);

      if (Math.abs(realPrice - mockPrice) < 100) {
        console.log("\n⚠️  警告: 获取的价格接近 Mock 价格 (50000)，可能仍在使用 Mock");
      } else {
        console.log("\n✅ 确认: 价格来自 Hyperliquid 真实数据");
      }
    } else {
      console.log("\n⚠️  无法从响应中解析 BTC 价格");
      console.log("响应结构:", JSON.stringify(result, null, 2).slice(0, 500));
    }

  } catch (error) {
    console.error("\n❌ API 调用失败:", error);
    console.log("\n可能的原因:");
    console.log("  1. 网络连接问题");
    console.log("  2. HYPERLIQUID_API_URL 配置错误");
    console.log("  3. Hyperliquid API 服务不可用");
  }
}

main().catch(console.error);
