// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract ChartsBetToken is
    ERC20,
    ERC20Burnable,
    Pausable,
    Ownable,
    ReentrancyGuard
{
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10 ** 18; // 1 billion tokens with 18 decimals
    uint256 public constant TOKENS_PER_ETH = 100; // 1 ETH = 100 CBT
    uint256 public constant MAX_MINT_PERCENT = 1; // Maximum 1% of MAX_SUPPLY can be minted at once

    event TokensPurchased(
        address indexed buyer,
        uint256 ethAmount,
        uint256 tokenAmount
    );
    event TokensSold(
        address indexed seller,
        uint256 tokenAmount,
        uint256 ethAmount
    );
    event RewardDistributed(address indexed to, uint256 amount);

    constructor(
        address initialOwner
    ) ERC20("ChartsBetToken", "CBT") Ownable(initialOwner) {
        _mint(initialOwner, MAX_SUPPLY / 2); // Mint 50% of MAX_SUPPLY initially
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
        require(
            amount <= (MAX_SUPPLY * MAX_MINT_PERCENT) / 100,
            "Cannot mint more than 1% of MAX_SUPPLY at once"
        );
        _mint(to, amount);
    }

    function distributeReward(address to, uint256 amount) public onlyOwner {
        require(
            totalSupply() + amount <= MAX_SUPPLY,
            "Reward would exceed max supply"
        );
        _mint(to, amount);
        emit RewardDistributed(to, amount);
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

    function buyTokens() public payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Must send ETH to buy tokens");
        uint256 tokenAmount = msg.value * TOKENS_PER_ETH;
        require(
            balanceOf(owner()) >= tokenAmount,
            "Not enough tokens in reserve"
        );
        _transfer(owner(), msg.sender, tokenAmount);
        emit TokensPurchased(msg.sender, msg.value, tokenAmount);
    }

    function sellTokens(uint256 tokenAmount) public nonReentrant whenNotPaused {
        require(tokenAmount > 0, "Must specify an amount of tokens to sell");
        require(
            balanceOf(msg.sender) >= tokenAmount,
            "Not enough tokens to sell"
        );
        uint256 ethAmount = tokenAmount / TOKENS_PER_ETH;
        require(
            address(this).balance >= ethAmount,
            "Not enough ETH in reserve"
        );
        _transfer(msg.sender, owner(), tokenAmount);
        (bool sent, ) = payable(msg.sender).call{value: ethAmount}("");
        require(sent, "Failed to send ETH");
        emit TokensSold(msg.sender, tokenAmount, ethAmount);
    }

    function withdrawETH(uint256 amount) public onlyOwner nonReentrant {
        require(address(this).balance >= amount, "Not enough ETH in contract");
        (bool sent, ) = payable(owner()).call{value: amount}("");
        require(sent, "Failed to send ETH");
    }

    receive() external payable {
        buyTokens();
    }
}
