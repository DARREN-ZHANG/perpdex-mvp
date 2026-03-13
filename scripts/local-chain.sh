#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONTRACTS_DIR="$PROJECT_ROOT/apps/contracts"
ENV_FILE="$PROJECT_ROOT/.env.local"
DEPLOYMENT_FILE="$PROJECT_ROOT/.local-deployment.json"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

DEFAULT_ADDRESS="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

check_anvil() {
    if curl -s -X POST -H "Content-Type: application/json" \
       --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
       http://localhost:8545 > /dev/null 2>&1; then
        return 0
    fi
    return 1
}

start_anvil() {
    if check_anvil; then
        echo -e "${YELLOW}⚠️  Anvil 已经在运行${NC}"
        return 0
    fi

    echo -e "${BLUE}📦 启动 Anvil 本地链...${NC}"
    nohup anvil --chain-id 31337 > /tmp/anvil.log 2>&1 &
    echo $! > /tmp/anvil.pid
    sleep 2
    retries=0
    while ! check_anvil && [ $retries -lt 10 ]; do
        sleep 0.5
        retries=$((retries + 1))
    done
    if check_anvil; then
        echo -e "${GREEN}✅ Anvil 已启动 (PID: $(cat /tmp/anvil.pid))${NC}"
    else
        echo -e "${RED}❌ Anvil 启动失败${NC}"
        return 1
    fi
}

deploy_contracts() {
    echo -e "${BLUE}📝 部署智能合约...${NC}"
    cd "$CONTRACTS_DIR"
    echo "   编译合约..."
    forge build --quiet 2>/dev/null
    echo "   部署 MockUSDC 和 Vault..."
    forge script script/DeployLocal.s.sol:DeployLocal \
        --rpc-url http://localhost:8545 \
        --broadcast \
        --quiet 2>&1
    broadcast_file="$CONTRACTS_DIR/broadcast/DeployLocal.s.sol/31337/run-latest.json"
    if [ -f "$broadcast_file" ]; then
        usdc_address=$(grep -A '"contractName": "MockUSDC"' "$broadcast_file" -A 1 | grep -o '"contractAddress": "[^"]*"' | head -1 | cut -d'"' -f4)
        vault_address=$(grep -A '"contractName": "Vault"' "$broadcast_file" -A 1 | grep -o '"contractAddress": "[^"]*"' | head -1 | cut -d'"' -f4)
        cat > "$DEPLOYMENT_FILE" << EOF
{
  "chainId": 31337,
  "rpcUrl": "http://localhost:8545",
  "usdcAddress": "$usdc_address",
  "vaultAddress": "$vault_address",
  "deployedAt": "$(date -u +"%Y-%m-%%dT %H:%M:%S")"
}
EOF
        echo -e "${GREEN}✅ 合约部署成功${NC}"
        echo "   USDC:  $usdc_address"
        echo "   Vault: $vault_address"
    else
        echo -e "${RED}❌ 无法找到部署日志${NC}"
        return 1
    fi
}

create_env_file() {
    if [ ! -f "$DEPLOYMENT_FILE" ]; then
        echo -e "${RED}❌ 未找到部署信息${NC}"
        return 1
    fi
    usdc_address=$(grep '"usdcAddress"' "$DEPLOYMENT_FILE" | cut -d'"' -f4)
    vault_address=$(grep '"vaultAddress"' "$DEPLOYMENT_FILE" | cut -d'"' -f4)
    echo -e "${BLUE}📄 创建环境变量文件...${NC}"
    cat > "$ENV_FILE" << EOF
# 本地开发环境配置
NEXT_PUBLIC_CHAIN_ID=31337
NEXT_PUBLIC_RPC_URL=http://localhost:8545
NEXT_PUBLIC_USDC_ADDRESS=$usdc_address
NEXT_PUBLIC_VAULT_ADDRESS=$vault_address
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=ws://localhost:3001
EOF
    echo -e "${GREEN}✅ 环境变量文件已创建${NC}"
}

show_info() {
    echo ""
    echo -e "${GREEN}🎉 本地开发环境已就绪！${NC}"
    echo ""
    echo "📋 测试账户:"
    echo "   地址: $DEFAULT_ADDRESS"
    echo "   私钥: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
    echo ""
    echo "🌐 网络:"
    echo "   RPC: http://localhost:8545"
    echo "   Chain ID: 31337"
    echo ""
    echo "🚀 下一步:"
    echo "   1. 在钱包中导入上面的私钥"
    echo "   2. 将钱包网络切换到 Chain ID: 31337"
    echo "   3. 运行 'pnpm dev' 启动服务"
    echo ""
    echo "🛑 停止: $0 stop"
    echo ""
}

case "${1:-start}" in
    start) start_anvil && deploy_contracts && create_env_file && show_info ;;
    stop)
        if [ -f /tmp/anvil.pid ]; then
            kill $(cat /tmp/anvil.pid) 2>/dev/null || true
            rm /tmp/anvil.pid 2>/dev/null || true
            echo -e "${GREEN}✅ Anvil 已停止${NC}"
        else
            pid=$(lsof -ti:8545 2>/dev/null || true)
            if [ -n "$pid" ]; then
                kill $pid 2>/dev/null || true
                echo -e "${GREEN}✅ Anvil 已停止${NC}"
            else
                echo -e "${YELLOW}⚠️  未找到 Anvil 进程${NC}"
            fi
        fi
        rm -f "$DEPLOYMENT_FILE" 2>/dev/null || true
        ;;
    restart) "$0" stop; sleep 1; "$0" start ;;
    deploy)
        if ! check_anvil; then
            echo -e "${RED}❌ Anvil 未运行${NC}"
            exit 1
        fi
        deploy_contracts && create_env_file && show_info
        ;;
    status)
        if check_anvil; then
            echo -e "${GREEN}✅ Anvil 正在运行${NC}"
            [ -f "$DEPLOYMENT_FILE" ] && cat "$DEPLOYMENT_FILE"
        else
            echo -e "${RED}❌ Anvil 未运行${NC}"
        fi
        ;;
    *) echo "用法: $0 {start|stop|restart|deploy|status}"; exit 1 ;;
esac
