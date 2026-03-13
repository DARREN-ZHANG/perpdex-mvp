// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/Vault.sol";
import "./MockUSDC.sol";

/// @title DeployLocal
/// @notice 一键部署本地开发环境所需的所有合约
/// @dev 用于 Anvil 本地测试链
contract DeployLocal is Script {
    // Anvil 默认账户 #0
    address constant DEFAULT_DEPLOYER = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;

    // 部署的合约
    MockUSDC public usdc;
    Vault public vault;

    // 部署结果
    struct DeploymentResult {
        address usdcAddress;
        address vaultAddress;
        address deployer;
    }

    function run() external returns (DeploymentResult memory) {
        // 使用 Anvil 默认私钥
        uint256 deployerPrivateKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;

        vm.startBroadcast(deployerPrivateKey);

        // 1. 部署 Mock USDC
        usdc = new MockUSDC();
        console.log("MockUSDC deployed at:", address(usdc));

        // 2. 部署 Vault
        vault = new Vault(address(usdc));
        console.log("Vault deployed at:", address(vault));

        // 3. 为默认账户铸造一些测试 USDC
        usdc.mint(DEFAULT_DEPLOYER, 1_000_000 * 10**6); // 100万 USDC
        console.log("Minted 1,000,000 USDC to:", DEFAULT_DEPLOYER);

        vm.stopBroadcast();

        // 输出部署信息
        console.log("\n=== Deployment Summary ===");
        console.log("Chain ID: 31337");
        console.log("USDC:", address(usdc));
        console.log("Vault:", address(vault));
        console.log("Deployer:", DEFAULT_DEPLOYER);

        return DeploymentResult({
            usdcAddress: address(usdc),
            vaultAddress: address(vault),
            deployer: DEFAULT_DEPLOYER
        });
    }
}
