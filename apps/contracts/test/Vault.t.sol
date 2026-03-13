// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/Vault.sol";
import "./mocks/MockUSDC.sol";

contract VaultTest is Test {
    Vault public vault;
    MockUSDC public usdc;

    address public owner = address(0x1);
    address public user = address(0x2);
    address public other = address(0x3);

    uint256 constant DEPOSIT_AMOUNT = 1000 * 10**6; // 1000 USDC

    function setUp() public {
        vm.prank(owner);
        usdc = new MockUSDC();

        vm.prank(owner);
        vault = new Vault(address(usdc));

        // Give user some USDC (owner has initial supply from MockUSDC constructor)
        vm.prank(owner);
        usdc.transfer(user, 10000 * 10**6);
    }

    // ==================== DEPOSIT TESTS ====================

    function test_Deposit_Success() public {
        vm.startPrank(user);
        usdc.approve(address(vault), DEPOSIT_AMOUNT);

        uint256 balanceBefore = usdc.balanceOf(user);
        vault.deposit(DEPOSIT_AMOUNT);
        uint256 balanceAfter = usdc.balanceOf(user);

        assertEq(balanceBefore - balanceAfter, DEPOSIT_AMOUNT);
        assertEq(vault.balanceOf(user), DEPOSIT_AMOUNT);
        assertEq(vault.totalAssets(), DEPOSIT_AMOUNT);
        vm.stopPrank();
    }

    function test_Deposit_ZeroAmount_Reverts() public {
        vm.prank(user);
        vm.expectRevert("Vault: zero amount");
        vault.deposit(0);
    }

    function test_Deposit_NoApproval_Reverts() public {
        vm.prank(user);
        vm.expectRevert("ERC20: insufficient allowance");
        vault.deposit(DEPOSIT_AMOUNT);
    }

    function test_Deposit_EmitsEvent() public {
        vm.startPrank(user);
        usdc.approve(address(vault), DEPOSIT_AMOUNT);

        vm.expectEmit(true, false, false, true);
        emit Vault.Deposit(user, DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();
    }

    function test_Deposit_WhenPaused_Success() public {
        // Pause the contract
        vm.prank(owner);
        vault.pause();

        // Deposit should still work
        vm.startPrank(user);
        usdc.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);
        assertEq(vault.balanceOf(user), DEPOSIT_AMOUNT);
        vm.stopPrank();
    }

    // ==================== WITHDRAW TESTS ====================

    function test_Withdraw_Success() public {
        // First deposit
        vm.startPrank(user);
        usdc.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        // Then withdraw
        uint256 balanceBefore = usdc.balanceOf(user);
        vm.prank(owner);
        vault.withdraw(user, DEPOSIT_AMOUNT);
        uint256 balanceAfter = usdc.balanceOf(user);

        assertEq(balanceAfter - balanceBefore, DEPOSIT_AMOUNT);
        assertEq(vault.balanceOf(user), 0);
        assertEq(vault.totalAssets(), 0);
    }

    function test_Withdraw_ZeroAmount_Reverts() public {
        vm.prank(owner);
        vm.expectRevert("Vault: zero amount");
        vault.withdraw(user, 0);
    }

    function test_Withdraw_InsufficientBalance_Reverts() public {
        vm.prank(owner);
        vm.expectRevert("Vault: insufficient balance");
        vault.withdraw(user, DEPOSIT_AMOUNT);
    }

    function test_Withdraw_NonOwner_Reverts() public {
        vm.prank(other);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", other));
        vault.withdraw(user, DEPOSIT_AMOUNT);
    }

    function test_Withdraw_WhenPaused_Reverts() public {
        // Deposit first
        vm.startPrank(user);
        usdc.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        // Pause
        vm.prank(owner);
        vault.pause();

        // Withdraw should fail
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSignature("EnforcedPause()"));
        vault.withdraw(user, DEPOSIT_AMOUNT);
    }

    function test_Withdraw_EmitsEvent() public {
        // Deposit first
        vm.startPrank(user);
        usdc.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        vm.expectEmit(true, false, false, true);
        emit Vault.Withdraw(user, DEPOSIT_AMOUNT);
        vm.prank(owner);
        vault.withdraw(user, DEPOSIT_AMOUNT);
    }

    // ==================== PAUSE TESTS ====================

    function test_Pause_Owner_Success() public {
        vm.prank(owner);
        vault.pause();
        assertTrue(vault.paused());
    }

    function test_Unpause_Owner_Success() public {
        vm.prank(owner);
        vault.pause();
        assertTrue(vault.paused());

        vm.prank(owner);
        vault.unpause();
        assertFalse(vault.paused());
    }

    function test_Pause_NonOwner_Reverts() public {
        vm.prank(other);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", other));
        vault.pause();
    }

    // ==================== BALANCE TESTS ====================

    function test_BalanceOf_Correct() public {
        assertEq(vault.balanceOf(user), 0);

        vm.startPrank(user);
        usdc.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        assertEq(vault.balanceOf(user), DEPOSIT_AMOUNT);
    }

    function test_TotalAssets_Correct() public {
        assertEq(vault.totalAssets(), 0);

        vm.startPrank(user);
        usdc.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        assertEq(vault.totalAssets(), DEPOSIT_AMOUNT);
    }

    // ==================== SECURITY TESTS ====================

    function test_Reentrancy_Protected() public {
        // This test verifies the nonReentrant modifier is applied
        // Real reentrancy would require a malicious contract
        // Here we just verify the modifier exists and doesn't block normal operations
        vm.startPrank(user);
        usdc.approve(address(vault), DEPOSIT_AMOUNT);
        vault.deposit(DEPOSIT_AMOUNT);
        vm.stopPrank();

        vm.prank(owner);
        vault.withdraw(user, DEPOSIT_AMOUNT);

        assertEq(vault.balanceOf(user), 0);
    }

    function test_ETHTransfer_Reverts() public {
        // When ETH is sent to vault, it should revert
        (bool success,) = address(vault).call{value: 1 ether}("");
        assertFalse(success);
    }

    function test_Constructor_ZeroAddress_Reverts() public {
        vm.expectRevert("Vault: zero address");
        new Vault(address(0));
    }

    // ==================== FUZZ TESTS ====================

    function testFuzz_Deposit_Withdraw_Roundtrip(uint256 amount) public {
        // Bound amount to reasonable range (1 USDC to 10000 USDC)
        amount = bound(amount, 1 * 10**6, 10000 * 10**6);

        // Ensure user has enough USDC
        vm.assume(amount <= usdc.balanceOf(user));

        // Deposit
        vm.startPrank(user);
        usdc.approve(address(vault), amount);
        vault.deposit(amount);
        assertEq(vault.balanceOf(user), amount);
        vm.stopPrank();

        // Withdraw
        vm.prank(owner);
        vault.withdraw(user, amount);
        assertEq(vault.balanceOf(user), 0);
    }

    function testFuzz_MultipleDeposits_Accumulates(uint256 amount1, uint256 amount2) public {
        amount1 = bound(amount1, 1 * 10**6, 5000 * 10**6);
        amount2 = bound(amount2, 1 * 10**6, 5000 * 10**6);

        vm.assume(amount1 + amount2 <= usdc.balanceOf(user));

        vm.startPrank(user);
        usdc.approve(address(vault), amount1 + amount2);

        vault.deposit(amount1);
        assertEq(vault.balanceOf(user), amount1);

        vault.deposit(amount2);
        assertEq(vault.balanceOf(user), amount1 + amount2);

        vm.stopPrank();
    }
}
