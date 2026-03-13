// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";

/// @title MockUSDC
/// @notice 用于本地测试的 USDC 模拟合约
/// @dev 支持任意铸造，仅用于测试环境
contract MockUSDC is ERC20, Ownable {
    uint8 private constant DECIMALS = 6;

    constructor() ERC20("Mock USDC", "USDC") Ownable(msg.sender) {
        // 构造函数不需要额外操作
    }

    /// @notice 返回 USDC 的精度
    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /// @notice 为指定地址铸造 USDC
    /// @param to 接收地址
    /// @param amount 铸造数量（6位精度）
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice 批量为多个地址铸造 USDC
    /// @param recipients 接收地址数组
    /// @param amounts 数量数组
    function mintBatch(address[] calldata recipients, uint256[] calldata amounts) external {
        require(recipients.length == amounts.length, "Length mismatch");
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amounts[i]);
        }
    }
}
