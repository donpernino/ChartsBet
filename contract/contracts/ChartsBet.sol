// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "./Errors.sol";

contract ChartsBet {
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

    address public owner;
    address public oracleAddress; // Address of the Oracle contract
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

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert Unauthorized();
        }
        _;
    }

    modifier onlyOracle() {
        if (msg.sender != oracleAddress) {
            revert Unauthorized();
        }
        _;
    }

    /**
     * @notice Contract constructor, sets the deployer as the owner.
     */
    constructor(address _oracleAddress) {
        owner = msg.sender;
        oracleAddress = _oracleAddress;
    }

    /**
     * @notice Normalizes the artist name by hashing it using keccak256.
     * @dev This is used to standardize artist names for comparison.
     * @param artist The artist's name as a string.
     * @return The hashed artist name as bytes32.
     */
    function normalizeArtistName(
        string memory artist
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(artist));
    }

    /**
     * @notice Calculates the betting odds based on the artist's rank and the number of appearances.
     * @dev The formula used accounts for the rank and appearance to adjust the odds dynamically.
     * @param rank The current rank of the artist.
     * @param appearances The number of times the artist has appeared in the leaderboard.
     * @return odds The calculated odds for the artist.
     */
    function calculateOdds(
        uint rank,
        uint appearances
    ) internal pure returns (uint odds) {
        uint effectiveRank = (rank + (rank + appearances - 1)) / 2;
        odds = 120 + (effectiveRank - 1) * 20;
    }

    /**
     * @notice Assigns ranks and calculates odds for artists in a leaderboard.
     * @dev This function updates the ranks and odds of artists in the leaderboard.
     * @param country The country for which the leaderboard is being updated.
     * @param topArtists An array of artist names representing the top artists.
     */
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

    /**
     * @notice Creates a new leaderboard for a given country.
     * @dev Only the owner can create a leaderboard, and it must not already exist.
     * @param country The country code for which the leaderboard is created.
     */
    function createLeaderboard(string memory country) public onlyOwner {
        if (!isValidCountry(country)) {
            revert InvalidCountryCode();
        }

        if (bytes(leaderboards[country].country).length != 0) {
            revert CountryAlreadyExists();
        }

        // Emit an event that the Oracle contract listens to
        emit LeaderboardCreated(country);
    }

    /**
     * @notice Fulfills the leaderboard data after the artists' rankings are known.
     * @dev This function is called by the Oracle contract to finalize the leaderboard.
     * @param country The country code for which the leaderboard is fulfilled.
     * @param topArtists An array of the top artist names.
     */
    function fulfillTopArtists(
        string memory country,
        string[] memory topArtists
    ) public onlyOracle {
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

    /**
     * @notice Fulfills the winning artist and distributes winnings to the bettors.
     * @dev The Oracle contract fulfills the request and transfers the winnings to the respective bettors.
     * @param country The country code for which the winning artist is fulfilled.
     * @param winningArtist The winning artist's name.
     */
    function fulfillDailyWinner(
        string memory country,
        string memory winningArtist
    ) public onlyOracle {
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

    /**
     * @notice Allows the owner to withdraw the contract's balance in case of an emergency.
     * @dev This function should be used cautiously and only in genuine emergency scenarios.
     */
    function emergencyWithdraw() public onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    /**
     * @notice Retrieves the total bets placed on a specific artist in a given country.
     * @param country The country code.
     * @param artist The artist's name.
     * @return The total amount of bets placed on the artist.
     */
    function getTotalBetsOnArtist(
        string memory country,
        string memory artist
    ) public view returns (uint) {
        return
            leaderboards[country].totalBetsOnArtist[
                normalizeArtistName(artist)
            ];
    }

    /**
     * @notice Retrieves the total amount of bets placed in a specific country.
     * @param country The country code.
     * @return The total bet amount.
     */
    function getTotalBetAmount(
        string memory country
    ) public view returns (uint) {
        return leaderboards[country].totalBetAmount;
    }

    /**
     * @notice Retrieves all the bets placed in a specific country.
     * @param country The country code.
     * @return An array of Bet structs representing all the bets placed.
     */
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

    /**
     * @notice Validates whether a given country code is in the list of valid countries.
     * @param country The country code to validate.
     * @return True if the country code is valid, false otherwise.
     */
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
}
