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
        uint amount;
        string artist;
        uint odds; // Odds associated with the bet
    }

    struct Leaderboard {
        string country;
        string winningArtist;
        bool isClosed;
        uint totalBetAmount;
        uint startTime;
        mapping(bytes32 => uint) totalBetsOnArtist;
        mapping(bytes32 => uint) artistRank; // Rank for each artist in the leaderboard
        mapping(bytes32 => uint) artistOdds; // Odds for each artist in the leaderboard
        Bet[] bets;
    }

    mapping(string => Leaderboard) public leaderboards;
    string[] public countryList;

    ChartsOracle public oracle; // Direct reference to the Oracle contract
    uint private constant WEEK_DURATION = 7 days;
    string[8] private validCountries = [
        "WW",
        "BR",
        "DE",
        "ES",
        "FR",
        "IT",
        "PT",
        "US"
    ];

    event LeaderboardCreated(string country);
    event BetPlaced(
        address indexed user,
        string country,
        string artist,
        uint amount
    );

    function initialize() public initializer {
        __Ownable_init(msg.sender);
        __Pausable_init();
        __ReentrancyGuard_init();

        oracle = new ChartsOracle();
    }

    function normalizeArtistName(
        string memory artist
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(artist));
    }

    function calculateOdds(
        uint rank,
        uint appearances
    ) internal pure returns (uint odds) {
        uint effectiveRank = (rank + (rank + appearances - 1)) / 2;
        odds = 120 + (effectiveRank - 1) * 20;
    }

    function assignRanksAndOdds(
        string memory country,
        string[] memory topArtists
    ) internal {
        Leaderboard storage lb = leaderboards[country];
        mapping(bytes32 => uint) storage artistAppearances = lb.artistRank;

        for (uint i = 0; i < topArtists.length; i++) {
            bytes32 artistHash = normalizeArtistName(topArtists[i]);
            artistAppearances[artistHash]++;
        }

        for (uint i = 0; i < topArtists.length; i++) {
            bytes32 artistHash = normalizeArtistName(topArtists[i]);
            if (lb.artistRank[artistHash] == 0) {
                lb.artistRank[artistHash] = i + 1;
                lb.artistOdds[artistHash] = calculateOdds(
                    i + 1,
                    artistAppearances[artistHash]
                );
            }
        }
    }

    function createLeaderboard(
        string memory country
    ) public onlyOwner whenNotPaused {
        if (!isValidCountry(country)) {
            revert InvalidCountryCode();
        }

        if (bytes(leaderboards[country].country).length != 0) {
            revert CountryAlreadyExists();
        }

        emit LeaderboardCreated(country);
    }

    function fulfillTopArtists(
        string memory country,
        string[] memory topArtists
    ) public onlyOwner whenNotPaused {
        if (!isValidCountry(country)) {
            revert InvalidCountryCode();
        }

        Leaderboard storage newLeaderboard = leaderboards[country];
        newLeaderboard.country = country;
        newLeaderboard.isClosed = false;
        newLeaderboard.startTime = block.timestamp;
        countryList.push(country);

        assignRanksAndOdds(country, topArtists);
    }

    function fulfillDailyWinner(
        string memory country,
        string memory winningArtist
    ) public onlyOwner whenNotPaused {
        Leaderboard storage lb = leaderboards[country];
        if (lb.isClosed) {
            revert BettingClosed();
        }

        lb.winningArtist = winningArtist;
        lb.isClosed = true;

        for (uint i = 0; i < lb.bets.length; i++) {
            Bet storage bet = lb.bets[i];
            if (
                normalizeArtistName(bet.artist) ==
                normalizeArtistName(winningArtist)
            ) {
                uint winnings = (bet.amount * bet.odds) / 100;
                payable(bet.user).transfer(winnings);
            }
        }
    }

    function emergencyWithdraw() public onlyOwner nonReentrant {
        payable(owner()).transfer(address(this).balance);
    }

    function getTotalBetsOnArtist(
        string memory country,
        string memory artist
    ) public view returns (uint) {
        return
            leaderboards[country].totalBetsOnArtist[
                normalizeArtistName(artist)
            ];
    }

    function getTotalBetAmount(
        string memory country
    ) public view returns (uint) {
        return leaderboards[country].totalBetAmount;
    }

    function getBetsInCountry(
        string memory country
    ) public view returns (Bet[] memory) {
        Leaderboard storage lb = leaderboards[country];
        Bet[] memory bets = new Bet[](lb.bets.length);
        for (uint i = 0; i < lb.bets.length; i++) {
            bets[i] = lb.bets[i];
        }
        return bets;
    }

    function isValidCountry(
        string memory country
    ) internal view returns (bool) {
        for (uint i = 0; i < validCountries.length; i++) {
            if (
                keccak256(abi.encodePacked(validCountries[i])) ==
                keccak256(abi.encodePacked(country))
            ) {
                return true;
            }
        }
        return false;
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }

    // Add a gap for future variable additions without affecting storage layout
    uint256[50] private __gap;
}
