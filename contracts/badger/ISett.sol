// SPDX-License-Identifier: GPL-3.0
/// @title Alpha Homora v1 Bank interface
/// @dev Alpha Homora v1 Bank.sol 5
pragma solidity ^0.7.6;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface ISett is IERC20Upgradeable {
    function token() external view returns (IERC20Upgradeable);

    function version() external view returns (string memory);

    function getPricePerFullShare() external view returns (uint256);

    /// @notice Return the total balance of the underlying token within the system
    /// @notice Sums the balance in the Sett, the Controller, and the Strategy
    function balance() external view returns (uint256);

    /// @notice Defines how much of the Setts' underlying can be borrowed by the Strategy for use
    /// @notice Custom logic in here for how much the vault allows to be borrowed
    /// @notice Sets minimum required on-hand to keep small withdrawals cheap
    function available() external view virtual returns (uint256);

    /// ===== public Actions =====

    /// @notice Deposit assets into the Sett, and return corresponding shares to the user
    /// @notice Only callable by EOA accounts that pass the _defend() check
    function deposit(uint256 _amount) external;

    /// @notice Convenience function: Deposit entire balance of asset into the Sett, and return corresponding shares to the user
    /// @notice Only callable by EOA accounts that pass the _defend() check
    function depositAll() external;

    /// @notice No rebalance implementation for lower fees and faster swaps
    function withdraw(uint256 _shares) external;

    /// @notice Convenience function: Withdraw all shares of the sender
    function withdrawAll() external;
}
