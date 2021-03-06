// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "./interface/ISettUpgradeable.sol";
import "./interface/IYieldSource.sol";
import "hardhat/console.sol";

contract BadgerYieldSource is IYieldSource {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    uint256 private constant EXP_SCALE = 1e18;

    /// @dev ref to badger sett (aka Vault)
    ISettUpgradeable public immutable sett;

    /// @dev ref to badger contract.
    IERC20 public immutable badger;

    ///@dev bBadger token balances
    mapping(address => uint256) private balances;

    constructor(ISettUpgradeable _sett, IERC20 _badger) {
        sett = _sett;
        badger = _badger;
    }

    function balanceOf(address addr) public view returns (uint256) {
        return balances[addr];
    }

    function depositToken() external view override returns (address) {
        return address(badger);
    }

    /// @notice Returns the total balance (in asset tokens).  This includes the deposits and interest.
    /// @return The underlying balance of asset tokens
    function balanceOfToken(address addr) external view override returns (uint256) {
        uint256 shares = sett.balanceOf(address(this));

        // price = underlyingTokenOwendByProtocol / totalShares
        // badger balance of this contract
        uint256 badgerBalance = shares.mul(sett.getPricePerFullShare()).div(EXP_SCALE);
        console.log("Badger balance", badgerBalance);

        // badgerBalance * addr's Shares / sourceShares
        return balances[addr].mul(badgerBalance).div(shares);
    }

    /// @notice Supplies asset tokens to the yield source.
    /// @param amount The amount of asset tokens to be supplied (ie. badger amount)
    function supplyTokenTo(uint256 amount, address to) external override {
        badger.safeTransferFrom(msg.sender, address(this), amount);
        badger.safeApprove(address(sett), amount);

        // bBadger balance before
        uint256 balanceBefore = sett.balanceOf(address(this));

        // Deposit badger and receive bBadger. Sett MUST approve this contract access by governance in advance
        sett.deposit(amount);

        // bBadger balance after
        uint256 balanceAfter = sett.balanceOf(address(this));
        uint256 balanceDiff = balanceAfter.sub(balanceBefore);
        balances[to] = balances[to].add(balanceDiff);
    }

    /// @notice Redeems asset tokens from the yield source.
    /// @param redeemAmount The amount of yield-bearing tokens to be redeemed (ie. badger amount)
    /// @return The actual amount of tokens that were redeemed.
    function redeemToken(uint256 redeemAmount) external override returns (uint256) {
        uint256 totalShares = sett.totalSupply();
        uint256 settBadgerBalance = sett.balance(); // sett + controller + ...
        // bBadger shares = redeemedbadgerAmount * totalShares / settBadgerBalance
        uint256 requiredShares = redeemAmount.mul(totalShares).div(settBadgerBalance);

        // balance before
        uint256 settBlanceBefore = sett.balanceOf(address(this));
        uint256 badgerBlanceBefore = badger.balanceOf(address(this));

        // redeem bBadger and receive badger
        sett.withdraw(requiredShares);

        // balance after
        uint256 settBalanceAfter = sett.balanceOf(address(this));
        uint256 badgerBalanceAfter = badger.balanceOf(address(this));

        uint256 settBalanceDiff = settBlanceBefore.sub(settBalanceAfter); // diff should be greater than 0
        uint256 badgerBalanceDiff = badgerBalanceAfter.sub(badgerBlanceBefore); // diff should be greater than 0
        balances[msg.sender] = balances[msg.sender].sub(settBalanceDiff);

        badger.safeTransfer(msg.sender, badgerBalanceDiff);
        return badgerBalanceDiff;
    }
}
