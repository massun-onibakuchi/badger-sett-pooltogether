// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.7.6;

import "../external/interfaces/badger/ISett.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface ISettUpgradeable is ISett, IERC20Upgradeable {
    function version() external view returns (string memory);

    /// @notice Return the total balance of the underlying token within the system
    /// @notice Sums the balance in the Sett, the Controller, and the Strategy
    function balance() external view returns (uint256);

    /// @notice Defines how much of the Setts' underlying can be borrowed by the Strategy for use
    /// @notice Custom logic in here for how much the vault allows to be borrowed
    /// @notice Sets minimum required on-hand to keep small withdrawals cheap
    function available() external view returns (uint256);
}
