// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

import "./ChartsOracle.sol";
import "./Errors.sol";

contract ChartsBet is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable,
    ReentrancyGuardUpgradeable
{
    struct Bet {
        address user;
        uint256 amount;
        string artist;
        uint256 odds;
    }

    struct Leaderboard {
        bytes32 country;
        string winningArtist;
        bool isClosed;
        uint256 totalBetAmount;
        uint256 startTime;
        mapping(bytes32 => uint256) totalBetsOnArtist;
        mapping(bytes32 => uint256) artistRank;
        mapping(bytes32 => uint256) artistOdds;
        Bet[] bets;
    }

    mapping(bytes32 => Leaderboard) public leaderboards;
    bytes32[] public countryList;

    ChartsOracle public oracle;
    uint256 public constant LEADERBOARD_DURATION = 7 days;
    mapping(bytes32 => bool) public validCountries;

    uint256 public constant WITHDRAWAL_DELAY = 2 days;
    uint256 public withdrawalRequestTime;

    event LeaderboardCreated(bytes32 indexed country);
    event LeaderboardClosed(bytes32 indexed country);
    event BetPlaced(
        address indexed user,
        bytes32 indexed country,
        string artist,
        uint256 amount
    );
    event TopArtistsFulfilled(bytes32 indexed country);
    event DailyWinnerFulfilled(bytes32 indexed country, string winningArtist);
    event OracleUpdated(address newOracle);
    event WithdrawalRequested(uint256 requestTime);
    event WithdrawalExecuted(uint256 amount);
    event ArtistOddsSet(bytes32 indexed country, bytes32 artist, uint256 odds);

    function initialize(address _owner, address _oracle) public initializer {
        __Ownable_init(_owner);
        __Pausable_init();
        __ReentrancyGuard_init();

        oracle = ChartsOracle(_oracle);
        bytes32[9] memory countries = [
            bytes32("WW"),
            bytes32("BR"),
            bytes32("DE"),
            bytes32("ES"),
            bytes32("FR"),
            bytes32("IT"),
            bytes32("PT"),
            bytes32("US"),
            bytes32("TEST")
        ];
        for (uint i = 0; i < countries.length; i++) {
            validCountries[countries[i]] = true;
        }
    }

    function createLeaderboard(bytes32 country) public onlyOwner whenNotPaused {
        if (!validCountries[country]) {
            revert InvalidCountryCode();
        }

        Leaderboard storage existingLeaderboard = leaderboards[country];
        if (existingLeaderboard.country != bytes32(0)) {
            if (
                !existingLeaderboard.isClosed &&
                block.timestamp <
                existingLeaderboard.startTime + LEADERBOARD_DURATION
            ) {
                revert LeaderboardStillActive();
            }
            delete leaderboards[country];
        }

        Leaderboard storage newLeaderboard = leaderboards[country];
        newLeaderboard.country = country;
        newLeaderboard.isClosed = false;
        newLeaderboard.startTime = block.timestamp;
        newLeaderboard.totalBetAmount = 0;
        countryList.push(country);

        emit LeaderboardCreated(country);
    }

    function closeLeaderboard(bytes32 country) public onlyOwner {
        Leaderboard storage leaderboard = leaderboards[country];
        if (leaderboard.country == bytes32(0)) {
            revert LeaderboardNotFound();
        }
        if (leaderboard.isClosed) {
            revert LeaderboardAlreadyClosed();
        }
        leaderboard.isClosed = true;
        emit LeaderboardClosed(country);
    }

    function isLeaderboardExpired(bytes32 country) public view returns (bool) {
        Leaderboard storage leaderboard = leaderboards[country];
        return block.timestamp >= leaderboard.startTime + LEADERBOARD_DURATION;
    }

    function placeBet(
        bytes32 country,
        string memory artist
    ) public payable whenNotPaused nonReentrant {
        Leaderboard storage leaderboard = leaderboards[country];
        if (leaderboard.country == bytes32(0)) {
            revert LeaderboardNotFound();
        }
        if (leaderboard.isClosed || isLeaderboardExpired(country)) {
            revert BettingClosed();
        }

        bytes32 artistHash = keccak256(abi.encodePacked(artist));
        uint256 odds = leaderboard.artistOdds[artistHash];
        if (odds == 0) {
            revert ArtistNotInLeaderboard();
        }

        leaderboard.totalBetAmount += msg.value;
        leaderboard.totalBetsOnArtist[artistHash] += msg.value;
        leaderboard.bets.push(
            Bet({
                user: msg.sender,
                amount: msg.value,
                artist: artist,
                odds: odds
            })
        );

        emit BetPlaced(msg.sender, country, artist, msg.value);
    }

    function fulfillTopArtists(
        bytes32 country,
        bytes32[] memory topArtists
    ) public whenNotPaused {
        if (msg.sender != address(oracle)) revert OnlyOracleAllowed();

        if (!validCountries[country]) {
            revert InvalidCountryCode();
        }

        Leaderboard storage leaderboard = leaderboards[country];
        if (leaderboard.country == bytes32(0)) {
            revert LeaderboardNotFound();
        }

        if (leaderboard.isClosed) {
            revert LeaderboardAlreadyClosed();
        }

        assignRanksAndOdds(country, topArtists);
        emit TopArtistsFulfilled(country);
    }

    function fulfillDailyWinner(
        bytes32 country,
        string memory winningArtist
    ) public whenNotPaused nonReentrant {
        if (msg.sender != address(oracle)) revert OnlyOracleAllowed();

        Leaderboard storage lb = leaderboards[country];
        if (lb.country == bytes32(0)) {
            revert LeaderboardNotFound();
        }
        if (lb.isClosed) {
            revert BettingClosed();
        }

        lb.winningArtist = winningArtist;
        lb.isClosed = true;

        bytes32 winningArtistHash = keccak256(abi.encodePacked(winningArtist));
        for (uint i = 0; i < lb.bets.length; i++) {
            Bet storage bet = lb.bets[i];
            if (keccak256(abi.encodePacked(bet.artist)) == winningArtistHash) {
                uint256 winnings = (bet.amount * bet.odds) / 100;
                payable(bet.user).transfer(winnings);
            }
        }

        emit DailyWinnerFulfilled(country, winningArtist);
        emit LeaderboardClosed(country);
    }

    function updateOracle(address newOracle) public onlyOwner {
        if (newOracle == address(0)) revert InvalidOracleAddress();
        oracle = ChartsOracle(newOracle);
        emit OracleUpdated(newOracle);
    }

    function getArtistOdds(
        bytes32 country,
        string memory artist
    ) public view returns (uint256) {
        bytes32 artistHash = keccak256(abi.encodePacked(artist));
        return leaderboards[country].artistOdds[artistHash];
    }

    function getTotalBetsOnArtist(
        bytes32 country,
        string memory artist
    ) public view returns (uint256) {
        bytes32 artistHash = keccak256(abi.encodePacked(artist));
        return leaderboards[country].totalBetsOnArtist[artistHash];
    }

    function getTotalBetAmount(bytes32 country) public view returns (uint256) {
        return leaderboards[country].totalBetAmount;
    }

    function getBetsInCountry(
        bytes32 country
    ) public view returns (Bet[] memory) {
        Leaderboard storage lb = leaderboards[country];
        return lb.bets;
    }

    function toggleContractActive() public onlyOwner {
        if (paused()) {
            _unpause();
        } else {
            _pause();
        }
    }

    function requestWithdrawal() public onlyOwner {
        withdrawalRequestTime = block.timestamp;
        emit WithdrawalRequested(withdrawalRequestTime);
    }

    function executeWithdrawal() public onlyOwner {
        if (block.timestamp < withdrawalRequestTime + WITHDRAWAL_DELAY)
            revert WithdrawalDelayNotMet();
        if (address(this).balance == 0) revert NoFundsToWithdraw();

        uint256 amount = address(this).balance;
        payable(owner()).transfer(amount);
        withdrawalRequestTime = 0;
        emit WithdrawalExecuted(amount);
    }

    function assignRanksAndOdds(
        bytes32 country,
        bytes32[] memory topArtists
    ) internal {
        Leaderboard storage lb = leaderboards[country];
        mapping(bytes32 => uint256) storage artistAppearances = lb.artistRank;

        // Reset previous ranks and odds
        for (uint i = 0; i < topArtists.length; i++) {
            bytes32 artistHash = keccak256(abi.encodePacked(topArtists[i]));
            lb.artistRank[artistHash] = 0;
            lb.artistOdds[artistHash] = 0;
            artistAppearances[artistHash] = 0;
        }

        // Count appearances
        for (uint i = 0; i < topArtists.length; i++) {
            bytes32 artistHash = keccak256(abi.encodePacked(topArtists[i]));
            artistAppearances[artistHash]++;
        }

        // Assign ranks and calculate odds
        for (uint i = 0; i < topArtists.length; i++) {
            bytes32 artistHash = keccak256(abi.encodePacked(topArtists[i]));
            uint256 rank = i + 1; // Rank starts at 1
            lb.artistRank[artistHash] = rank;
            uint256 odds = calculateOdds(rank, artistAppearances[artistHash]);
            lb.artistOdds[artistHash] = odds;
            emit ArtistOddsSet(country, topArtists[i], odds);
        }
    }

    function calculateOdds(
        uint256 rank,
        uint256 appearances
    ) internal pure returns (uint256 odds) {
        uint256 effectiveRank = (rank + (rank + appearances - 1)) / 2;
        odds = 120 + (effectiveRank - 1) * 20;
        return odds;
    }

    function testOracleConnection() public onlyOwner {
        emit LeaderboardCreated(bytes32("TEST"));
    }

    // Add a gap for future variable additions without affecting storage layout
    uint256[50] private __gap;
}
