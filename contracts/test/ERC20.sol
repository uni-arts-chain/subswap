// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity =0.6.12;

import '../SubswapERC20.sol';

contract ERC20 is SubswapERC20 {
    constructor(uint _totalSupply) public {
        _mint(msg.sender, _totalSupply);
    }
}