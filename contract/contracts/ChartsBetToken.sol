// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ChartsBetToken is ERC20, ERC20Burnable, Pausable, Ownable {
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18; // 1 billion tokens with 18 decimals

    constructor(
        address initialOwner
    ) ERC20("ChartsBetToken", "CBT") Ownable(initialOwner) {
        _mint(initialOwner, MAX_SUPPLY);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    function mint(address to, uint256 amount) public onlyOwner {
        require(
            totalSupply() + amount <= MAX_SUPPLY,
            "Minting would exceed max supply"
        );
        _mint(to, amount);
    }

    function transfer(
        address to,
        uint256 amount
    ) public virtual override whenNotPaused returns (bool) {
        return super.transfer(to, amount);
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual override whenNotPaused returns (bool) {
        return super.transferFrom(from, to, amount);
    }

    // Function to allow users to exchange ETH for ChartsBetTokens
    function buyTokens() public payable {
        require(msg.value > 0, "Must send ETH to buy tokens");
        uint256 tokenAmount = msg.value * 100; // 1 ETH = 100 CBT, adjust as needed
        require(
            balanceOf(owner()) >= tokenAmount,
            "Not enough tokens in reserve"
        );
        _transfer(owner(), msg.sender, tokenAmount);
    }

    // Function to allow users to exchange ChartsBetTokens back to ETH
    function sellTokens(uint256 tokenAmount) public {
        require(tokenAmount > 0, "Must specify an amount of tokens to sell");
        require(
            balanceOf(msg.sender) >= tokenAmount,
            "Not enough tokens to sell"
        );
        uint256 ethAmount = tokenAmount / 100; // 100 CBT = 1 ETH, adjust as needed
        require(
            address(this).balance >= ethAmount,
            "Not enough ETH in reserve"
        );
        _transfer(msg.sender, owner(), tokenAmount);
        payable(msg.sender).transfer(ethAmount);
    }

    // Function to withdraw ETH from the contract (for the owner)
    function withdrawETH(uint256 amount) public onlyOwner {
        require(address(this).balance >= amount, "Not enough ETH in contract");
        payable(owner()).transfer(amount);
    }

    // Allow the contract to receive ETH
    receive() external payable {}
}
