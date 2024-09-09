// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract ChartsBet is Ownable, Pausable, ReentrancyGuard, Initializable {
    struct Bet {
        address bettor;
        bytes32 artist;
        uint256 amount;
        uint256 odds;
    }

    struct DailyBettingPool {
        uint256 openingTime;
        uint256 closingTime;
        mapping(address => Bet) bets;
        uint256 totalBets;
        uint256 totalAmount;
        bytes32 winningArtist;
        bool closed;
    }

    uint256 public constant BET_DURATION = 1 days;
    uint256 public constant MAX_BET = 1000 * 10 ** 18; // 1000 tokens, assuming 18 decimals
    uint256 public constant OUTSIDER_ODDS = 350; // 3.50 in basis points
    uint256 public constant RESERVE_PERCENTAGE = 50; // 50% of bets go to reserve

    IERC20 public chartsBetToken;

    mapping(bytes32 => bool) public validCountries;
    mapping(bytes32 => mapping(uint256 => DailyBettingPool)) public dailyPools; // country => day => pool
    mapping(bytes32 => bytes32[]) public top10Artists;
    mapping(bytes32 => mapping(bytes32 => uint256)) public artistRanks;
    mapping(address => uint256) public pendingPayouts;

    uint256 public currentDay;

    // Custom errors
    error InvalidCountry(bytes32 country);
    error PoolNotOpen(
        uint256 currentTime,
        uint256 openingTime,
        uint256 closingTime
    );
    error PoolAlreadyClosed();
    error BetAlreadyPlaced(address bettor);
    error BetTooHigh(uint256 amount, uint256 maxBet);
    error NoBetPlaced();
    error PoolNotReadyToClose(uint256 currentTime, uint256 closingTime);
    error InvalidArtistCount(uint256 count);
    error PoolNotClosed();
    error InsufficientContractBalance(uint256 required, uint256 available);
    error TokenTransferFailed();
    error NoPayoutToClaim();

    event BetPlaced(
        address indexed bettor,
        bytes32 indexed country,
        uint256 indexed day,
        bytes32 artist,
        uint256 amount,
        uint256 odds
    );
    event PoolClosed(
        bytes32 indexed country,
        uint256 indexed day,
        bytes32 winningArtist
    );
    event BetSettled(
        address indexed bettor,
        bytes32 indexed country,
        uint256 indexed day,
        uint256 amount,
        bool won
    );
    event PoolOpened(
        bytes32 indexed country,
        uint256 indexed day,
        uint256 openingTime,
        uint256 closingTime
    );
    event PayoutClaimed(address indexed bettor, uint256 amount);

    constructor(
        address initialOwner,
        address _chartsBetToken
    ) Ownable(initialOwner) {
        chartsBetToken = IERC20(_chartsBetToken);
    }

    function initialize() public initializer {
        bytes32[8] memory countries = [
            bytes32("WW"),
            bytes32("BR"),
            bytes32("DE"),
            bytes32("ES"),
            bytes32("FR"),
            bytes32("IT"),
            bytes32("PT"),
            bytes32("US")
        ];

        for (uint i = 0; i < countries.length; i++) {
            validCountries[countries[i]] = true;
        }
    }

    function openAllDailyPools() external onlyOwner {
        currentDay = block.timestamp / 1 days;
        bytes32[8] memory countries = [
            bytes32("WW"),
            bytes32("BR"),
            bytes32("DE"),
            bytes32("ES"),
            bytes32("FR"),
            bytes32("IT"),
            bytes32("PT"),
            bytes32("US")
        ];

        for (uint i = 0; i < countries.length; i++) {
            bytes32 country = countries[i];
            DailyBettingPool storage pool = dailyPools[country][currentDay];
            if (pool.openingTime == 0) {
                pool.openingTime = block.timestamp;
                pool.closingTime = block.timestamp + BET_DURATION;
                emit PoolOpened(
                    country,
                    currentDay,
                    pool.openingTime,
                    pool.closingTime
                );
            }
        }
    }

    function placeBet(
        bytes32 country,
        bytes32 artist,
        uint256 amount
    ) external whenNotPaused nonReentrant {
        if (!validCountries[country]) revert InvalidCountry(country);
        DailyBettingPool storage pool = dailyPools[country][currentDay];

        if (
            block.timestamp < pool.openingTime ||
            block.timestamp >= pool.closingTime
        )
            revert PoolNotOpen(
                block.timestamp,
                pool.openingTime,
                pool.closingTime
            );
        if (pool.bets[msg.sender].amount != 0)
            revert BetAlreadyPlaced(msg.sender);
        if (amount > MAX_BET) revert BetTooHigh(amount, MAX_BET);

        if (!chartsBetToken.transferFrom(msg.sender, address(this), amount)) {
            revert TokenTransferFailed();
        }

        uint256 odds = getOdds(country, artist);
        pool.bets[msg.sender] = Bet(msg.sender, artist, amount, odds);
        pool.totalBets++;
        pool.totalAmount += amount;

        emit BetPlaced(msg.sender, country, currentDay, artist, amount, odds);
    }

    function closePoolAndAnnounceWinner(
        bytes32 country,
        bytes32 winningArtist
    ) external onlyOwner {
        DailyBettingPool storage pool = dailyPools[country][currentDay];
        if (block.timestamp < pool.closingTime)
            revert PoolNotReadyToClose(block.timestamp, pool.closingTime);
        if (pool.closed) revert PoolAlreadyClosed();

        pool.winningArtist = winningArtist;
        pool.closed = true;

        emit PoolClosed(country, currentDay, winningArtist);
    }

    function settleBet(bytes32 country) external nonReentrant {
        DailyBettingPool storage pool = dailyPools[country][currentDay];
        if (!pool.closed) revert PoolNotClosed();

        Bet storage bet = pool.bets[msg.sender];
        if (bet.amount == 0) revert NoBetPlaced();

        bool won = bet.artist == pool.winningArtist;
        uint256 payout = won ? (bet.amount * bet.odds) / 100 : 0;

        // Limit payout to the bet amount plus the reserve
        uint256 maxPayout = bet.amount +
            (bet.amount * RESERVE_PERCENTAGE) /
            100;
        payout = payout > maxPayout ? maxPayout : payout;

        delete pool.bets[msg.sender];

        if (payout > 0) {
            pendingPayouts[msg.sender] += payout;
        }

        emit BetSettled(msg.sender, country, currentDay, payout, won);
    }

    function claimPayout() external nonReentrant {
        uint256 payout = pendingPayouts[msg.sender];
        if (payout == 0) revert NoPayoutToClaim();

        pendingPayouts[msg.sender] = 0;

        if (!chartsBetToken.transfer(msg.sender, payout)) {
            revert TokenTransferFailed();
        }

        emit PayoutClaimed(msg.sender, payout);
    }

    function getOdds(
        bytes32 country,
        bytes32 artist
    ) public view returns (uint256) {
        uint256 rank = artistRanks[country][artist];
        if (rank == 0) return OUTSIDER_ODDS;
        return 120 + (rank - 1) * 20; // 1.20 to 3.00
    }

    function updateTop10(
        bytes32 country,
        bytes32[] calldata artists
    ) external onlyOwner {
        if (artists.length != 10) revert InvalidArtistCount(artists.length);
        delete top10Artists[country];
        for (uint i = 0; i < 10; i++) {
            top10Artists[country].push(artists[i]);
            artistRanks[country][artists[i]] = i + 1;
        }
    }

    // Admin functions
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function withdrawTokens(uint256 amount) external onlyOwner {
        if (!chartsBetToken.transfer(owner(), amount)) {
            revert TokenTransferFailed();
        }
    }

    function getPoolInfo(
        bytes32 country
    )
        external
        view
        returns (
            uint256 openingTime,
            uint256 closingTime,
            bool closed,
            uint256 totalBets,
            uint256 totalAmount
        )
    {
        DailyBettingPool storage pool = dailyPools[country][currentDay];
        return (
            pool.openingTime,
            pool.closingTime,
            pool.closed,
            pool.totalBets,
            pool.totalAmount
        );
    }
}
