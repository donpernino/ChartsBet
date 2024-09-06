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
        uint256 closingTime;
        mapping(address => Bet) bets;
        uint256 totalBets;
        uint256 totalAmount;
        bytes32 winningArtist;
        bool closed;
    }

    uint256 public constant BET_DURATION = 1 days;
    uint256 public constant MAX_BET = 1 ether;
    uint256 public constant OUTSIDER_ODDS = 350; // 3.50 in basis points

    mapping(bytes32 => bool) public validCountries;
    mapping(bytes32 => mapping(uint256 => DailyBettingPool)) public dailyPools; // country => day => pool
    mapping(bytes32 => bytes32[]) public top10Artists;
    mapping(bytes32 => mapping(bytes32 => uint256)) public artistRanks;

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

    error InvalidCountry();
    error PoolNotOpen();
    error PoolAlreadyClosed();
    error BetAlreadyPlaced();
    error BetTooHigh();
    error NoBetPlaced();
    error PoolNotReadyToClose();
    error InvalidArtistCount();

    constructor(address initialOwner) Ownable(initialOwner) {
        _transferOwnership(msg.sender);
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
        uint256 currentDay = block.timestamp / 1 days;
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
        bytes32 artist
    ) external payable whenNotPaused nonReentrant {
        if (!validCountries[country]) revert InvalidCountry();
        uint256 currentDay = block.timestamp / 1 days;
        DailyBettingPool storage pool = dailyPools[country][currentDay];

        if (
            block.timestamp < pool.openingTime ||
            block.timestamp >= pool.closingTime
        ) revert PoolNotOpen();
        if (pool.bets[msg.sender].amount != 0) revert BetAlreadyPlaced();
        if (msg.value > MAX_BET) revert BetTooHigh();

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
        uint256 day,
        bytes32 winningArtist
    ) external onlyOwner {
        DailyBettingPool storage pool = dailyPools[country][day];
        if (block.timestamp < pool.closingTime) revert PoolNotReadyToClose();
        if (pool.closed) revert PoolAlreadyClosed();

        pool.winningArtist = winningArtist;
        pool.closed = true;

        emit PoolClosed(country, day, winningArtist);
    }

    function settleBet(bytes32 country, uint256 day) external nonReentrant {
        DailyBettingPool storage pool = dailyPools[country][day];
        if (!pool.closed) revert PoolNotOpen();

        Bet storage bet = pool.bets[msg.sender];
        if (bet.amount == 0) revert NoBetPlaced();

        bool won = bet.artist == pool.winningArtist;
        uint256 payout = won ? (bet.amount * bet.odds) / 100 : 0;

        if (payout > 0) {
            payable(msg.sender).transfer(payout);
        }

        emit BetSettled(msg.sender, country, day, payout, won);
        delete pool.bets[msg.sender];
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
        if (artists.length != 10) revert InvalidArtistCount();
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

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
}
