// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/Vault.sol";

contract DeployVault is Script {
    function run() external returns (Vault) {
        address usdcToken = vm.envAddress("USDC_ADDRESS");

        vm.startBroadcast();
        Vault vault = new Vault(usdcToken);
        vm.stopBroadcast();

        return vault;
    }
}
