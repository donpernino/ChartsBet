// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/proxy/utils/Initializable.sol";

contract ChartsBet is Ownable, Pausable, ReentrancyGuard, Initializable {
    struct Bet {
        address bettor;
        bytes32 artist;
        uint256 amount;
        uint256 odds;
    }

    struct DailyBettingPool {
        uint256 openingTime;
        uint256 scheduledClosingTime;
        uint256 actualClosingTime;
        mapping(address => Bet) bets;
        uint256 totalBets;
        uint256 totalAmount;
        bytes32 winningArtist;
        bool closed;
    }

    uint256 public constant MAX_BET = 1 ether; // 1 ETH
    uint256 public constant OUTSIDER_ODDS = 350; // 3.50 in basis points
    uint256 public constant RESERVE_PERCENTAGE = 50; // 50% of bets go to reserve

    mapping(bytes32 => bool) public validCountries;
    mapping(bytes32 => mapping(uint256 => DailyBettingPool)) public dailyPools; // country => day => pool
    mapping(bytes32 => bytes32[]) public top10Artists;
    mapping(bytes32 => mapping(bytes32 => uint256)) public artistRanks;
    mapping(address => uint256) public pendingPayouts;

    uint256 public defaultDuration = 1 days; // Default duration, can be changed by owner
    uint256 public currentDay;

    // Custom errors
    error InvalidCountry(bytes32 country);
    error PoolNotOpen(
        uint256 currentTime,
        uint256 openingTime,
        uint256 scheduledClosingTime,
        uint256 actualClosingTime
    );
    error PoolNotScheduledToClose(
        uint256 currentTime,
        uint256 scheduledClosingTime
    );
    error PoolAlreadyClosed();
    error BetAlreadyPlaced(address bettor);
    error BetTooHigh(uint256 amount, uint256 maxBet);
    error NoBetPlaced();
    error PoolNotClosed();
    error InsufficientContractBalance(uint256 required, uint256 available);
    error NoPayoutToClaim();
    error InvalidArtistCount(uint256 count);

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
        bytes32 winningArtist,
        uint256 actualClosingTime
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
        uint256 scheduledClosingTime
    );
    event PayoutClaimed(address indexed bettor, uint256 amount);

    constructor(address initialOwner) Ownable(initialOwner) {}

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

    function setDefaultDuration(uint256 _duration) external onlyOwner {
        defaultDuration = _duration;
    }

    function openAllDailyPools(uint256 _duration) external onlyOwner {
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
                pool.scheduledClosingTime =
                    block.timestamp +
                    (_duration > 0 ? _duration : defaultDuration);
                pool.actualClosingTime = pool.scheduledClosingTime;
                emit PoolOpened(
                    country,
                    currentDay,
                    pool.openingTime,
                    pool.scheduledClosingTime
                );
            }
        }
    }

    function placeBet(
        bytes32 country,
        bytes32 artist
    ) external payable whenNotPaused nonReentrant {
        if (!validCountries[country]) revert InvalidCountry(country);
        DailyBettingPool storage pool = dailyPools[country][currentDay];

        if (
            block.timestamp < pool.openingTime ||
            block.timestamp >= pool.actualClosingTime ||
            pool.closed
        )
            revert PoolNotOpen(
                block.timestamp,
                pool.openingTime,
                pool.scheduledClosingTime,
                pool.actualClosingTime
            );
        if (pool.bets[msg.sender].amount != 0)
            revert BetAlreadyPlaced(msg.sender);
        if (msg.value > MAX_BET) revert BetTooHigh(msg.value, MAX_BET);

        uint256 odds = getOdds(country, artist);
        pool.bets[msg.sender] = Bet(msg.sender, artist, msg.value, odds);
        pool.totalBets++;
        pool.totalAmount += msg.value;

        emit BetPlaced(
            msg.sender,
            country,
            currentDay,
            artist,
            msg.value,
            odds
        );
    }

    function closePoolAndAnnounceWinner(
        bytes32 country,
        bytes32 winningArtist
    ) external onlyOwner {
        DailyBettingPool storage pool = dailyPools[country][currentDay];
        if (pool.closed) revert PoolAlreadyClosed();

        pool.winningArtist = winningArtist;
        pool.closed = true;
        pool.actualClosingTime = block.timestamp;

        emit PoolClosed(
            country,
            currentDay,
            winningArtist,
            pool.actualClosingTime
        );
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

        (bool sent, ) = payable(msg.sender).call{value: payout}("");
        require(sent, "Failed to send ETH");

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

    function withdrawETH(uint256 amount) external onlyOwner {
        require(address(this).balance >= amount, "Not enough ETH in contract");
        (bool sent, ) = payable(owner()).call{value: amount}("");
        require(sent, "Failed to send ETH");
    }

    function getPoolInfo(
        bytes32 country
    )
        external
        view
        returns (
            uint256 openingTime,
            uint256 scheduledClosingTime,
            uint256 actualClosingTime,
            bool closed,
            uint256 totalBets,
            uint256 totalAmount
        )
    {
        DailyBettingPool storage pool = dailyPools[country][currentDay];
        return (
            pool.openingTime,
            pool.scheduledClosingTime,
            pool.actualClosingTime,
            pool.closed,
            pool.totalBets,
            pool.totalAmount
        );
    }

    function hasBetPlaced(
        bytes32 country,
        address bettor
    ) public view returns (bool) {
        DailyBettingPool storage pool = dailyPools[country][currentDay];
        return pool.bets[bettor].amount != 0;
    }

    receive() external payable {}
}
