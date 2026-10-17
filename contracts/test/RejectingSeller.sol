// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Market} from "../Market.sol";

interface IOperator {
    function setOperator(address operator, bool approved) external;
}

/// Solo para tests: un vendedor que no acepta HBAR, para probar que la compra falla entera.
contract RejectingSeller {
    function listOn(address market, string calldata parcel, uint32 period, uint256 amount, uint256 price) external {
        Market m = Market(market);
        IOperator(address(m.greenton())).setOperator(market, true);
        m.list(parcel, period, amount, price);
    }

    receive() external payable {
        revert("no acepto pagos");
    }
}
