// SPDX-License-Identifier: GPL-3.0
/* solhint-disable var-name-mixedcase */
pragma solidity ^0.7.6;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "hardhat/console.sol";
import "./badger/ISett.sol";
import "./interface/IYieldSource.sol";

contract BadgerYieldSource is IYieldSource {
    using SafeMath for uint256;

    /// @dev ref to Alpha Homora V1 Bank contract
    ISett public immutable sett;

    /// @dev ref to WrappedETH9 contract.
    IERC20 public immutable badger;

    ///@dev bBadger token balances
    mapping(address => uint256) private balances;

    constructor(ISett _sett, IERC20 _badger) {
        sett = _sett;
        IERC20 = _badger;
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
        uint256 total = sett.totalSupply();
        if (total == 0) {
            return 0;
        }
        uint256 ethBalance = shares.mul(bank.totalETH()).div(total); // badger balance of this contract
        // ethBalance * addr's Shares / totalShares
        return balances[addr].mul(ethBalance).div(total);

        // console.log("addr's ibETH balance", balances[addr]);
        // price = underlyingToken / totalShares
        uint256 badgerBalance = shares.mul(sett.getPricePerFullShare()); // badger balance of this contract
        // badgerBalance * addr's Shares / totalShares
        return balances[addr].mul(badgerBalance).div(sett.totalSupply());
    }

    /// @notice Supplies asset tokens to the yield source.
    /// @param amount The amount of asset tokens to be supplied (ie. WETH amount)
    function supplyTokenTo(uint256 amount, address to) external override {
        badger.transferFrom(msg.sender, address(this), amount);
        badger.approve(sett, amount);

        // bBadger balance before
        uint256 balanceBefore = sett.balanceOf(address(this));

        // Deposit badger and receive bBadger
        sett.deposit(amount);

        // bBadger balance after
        uint256 balanceAfter = sett.balanceOf(address(this));
        uint256 balanceDiff = balanceAfter.sub(balanceBefore);
        balances[to] = balances[to].add(balanceDiff);
    }

    /// @notice Redeems asset tokens from the yield source.
    /// @param redeemAmount The amount of yield-bearing tokens to be redeemed (ie. ether amount)
    /// @return The actual amount of tokens that were redeemed.
    function redeemToken(uint256 redeemAmount) external override returns (uint256) {
        uint256 totalShares = sett.totalSupply();
        uint256 settBadgerBalance = sett.balance();
        // ibETH shares = redeemedETHAmount * totalibETHSupply / settBadgerBalance
        uint256 requiredShares = redeemAmount.mul(totalShares).div(settBadgerBalance);

        // balance before
        uint256 settBlanceBefore = sett.balanceOf(address(this));
        uint256 badgerBlanceBefore = badger.balanceOf(address(this));

        // redeem ibETH and receive ETH
        sett.withdraw(requiredShares);

        // balance after
        uint256 settBalanceAfter = sett.balanceOf(address(this));
        uint256 badgerBalanceAfter = badger.balanceOf(address(this));

        uint256 settBalanceDiff = settBlanceBefore.sub(settBalanceAfter); // diff should be greater than 0
        uint256 badgerBalanceDiff = badgerBalanceAfter.sub(badgerBlanceBefore); // diff should be greater than 0
        balances[msg.sender] = balances[msg.sender].sub(settBalanceDiff);

        badger.transfer(msg.sender, badgerBalanceDiff);
        return badgerBalanceDiff;
    }
}
