// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";

contract ChartsBet is ChainlinkClient {
    using Chainlink for Chainlink.Request;

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

    bytes32 private jobId;
    uint256 private fee;

    // Mapping from requestId to country code
    mapping(bytes32 => string) private requestIdToCountry;

    /// @dev Error for invalid country code.
    error InvalidCountryCode(string country);

    /// @dev Error when attempting to bet after betting period has ended.
    error BettingPeriodEnded();

    /// @dev Error when betting with zero value.
    error BetAmountZero();

    /// @dev Error when betting on a closed leaderboard.
    error BettingClosed();

    /// @dev Error when attempting to perform an action before the betting period ends.
    error BettingPeriodNotEndedYet();

    /// @dev Error when attempting to create a leaderboard that already exists.
    error CountryAlreadyExists();

    event DataRequested(bytes32 indexed requestId, string country);
    event DataFulfilled(
        bytes32 indexed requestId,
        string country,
        string[] topArtists
    );
    event LeaderboardCreated(bytes32 indexed requestId, string country);
    event RequestWinningArtist(
        bytes32 indexed requestId,
        string country,
        string winningArtist
    );
    event BetPlaced(
        address indexed user,
        string country,
        string artist,
        uint amount
    );

    modifier onlyOwner() {
        require(msg.sender == owner, "Only the owner can perform this action");
        _;
    }

    constructor(address _oracle, bytes32 _jobId, uint256 _fee) {
        owner = msg.sender;
        setPublicChainlinkToken();
        jobId = _jobId;
        fee = _fee;
        setChainlinkOracle(_oracle);
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
        if (!isValidCountry(country)) revert InvalidCountryCode(country);

        if (bytes(leaderboards[country].country).length != 0) {
            revert CountryAlreadyExists();
        }

        bytes32 requestId = requestTopArtists(country);
        requestIdToCountry[requestId] = country; // Store the mapping from requestId to country
        emit LeaderboardCreated(requestId, country);
    }

    /**
     * @notice Requests the top artists from the oracle for a specific country.
     * @param country The country code for which to request the leaderboard.
     * @return requestId The request ID generated for the oracle request.
     */
    function requestTopArtists(
        string memory country
    ) internal returns (bytes32 requestId) {
        Chainlink.Request memory request = buildChainlinkRequest(
            jobId,
            address(this),
            this.fulfillTopArtists.selector
        );
        string memory url = string(
            abi.encodePacked(
                "https://your-node-server.com/leaderboard/",
                country,
                "?compact=true"
            )
        );
        request.add("get", url);
        request.add("path", ""); // Assumes the response is a simple array of strings.
        requestId = sendChainlinkRequest(request, fee);
        emit DataRequested(requestId, country);
    }

    /**
     * @notice Fulfills the leaderboard data after the artists' rankings are known.
     * @dev This function is called by the oracle to finalize the leaderboard.
     * @param _requestId The request ID associated with this fulfillment.
     * @param topArtists An array of the top artist names.
     */
    function fulfillTopArtists(
        bytes32 _requestId,
        string[] memory topArtists
    ) public recordChainlinkFulfillment(_requestId) {
        string memory country = extractCountryFromRequestId(_requestId);

        if (bytes(leaderboards[country].country).length != 0) {
            revert CountryAlreadyExists();
        }

        Leaderboard storage newLeaderboard = leaderboards[country];
        newLeaderboard.country = country;
        newLeaderboard.isClosed = false;
        newLeaderboard.startTime = block.timestamp;
        countryList.push(country);

        assignRanksAndOdds(country, topArtists);
        emit DataFulfilled(_requestId, country, topArtists);
    }

    /**
     * @notice Requests the winning artist for a specific country after the betting period ends.
     * @dev Only the owner can request the winning artist, and the betting period must have ended.
     * @param country The country code for which the winning artist is requested.
     */
    function requestWinningArtist(string memory country) public onlyOwner {
        if (!isValidCountry(country)) revert InvalidCountryCode(country);

        Leaderboard storage lb = leaderboards[country];
        if (lb.isClosed) revert BettingClosed();
        if (block.timestamp < lb.startTime + WEEK_DURATION)
            revert BettingPeriodNotEndedYet();

        bytes32 requestId = requestDailyWinner(country);
        requestIdToCountry[requestId] = country; // Store the mapping from requestId to country
        emit DataRequested(requestId, country);
        lb.isClosed = true;
    }

    /**
     * @notice Requests the daily winner from the oracle for a specific country.
     * @param country The country code for which to request the daily winner.
     * @return requestId The request ID generated for the oracle request.
     */
    function requestDailyWinner(
        string memory country
    ) internal returns (bytes32 requestId) {
        Chainlink.Request memory request = buildChainlinkRequest(
            jobId,
            address(this),
            this.fulfillDailyWinner.selector
        );
        string memory url = string(
            abi.encodePacked(
                "https://your-node-server.com/daily-winner/",
                country
            )
        );
        request.add("get", url);
        request.add("path", "artist"); // Assumes the response contains the artist field with the winner's name.
        requestId = sendChainlinkRequest(request, fee);
        return requestId;
    }

    /**
     * @notice Fulfills the winning artist and distributes winnings to the betters.
     * @dev The owner fulfills the request and transfers the winnings to the respective betters.
     * @param _requestId The request ID associated with this fulfillment.
     * @param _winningArtist The winning artist's name.
     */
    function fulfillDailyWinner(
        bytes32 _requestId,
        string memory _winningArtist
    ) public recordChainlinkFulfillment(_requestId) {
        string memory country = extractCountryFromRequestId(_requestId);
        Leaderboard storage lb = leaderboards[country];
        lb.winningArtist = _winningArtist;

        emit RequestWinningArtist(_requestId, country, _winningArtist);

        for (uint i = 0; i < lb.bets.length; i++) {
            Bet storage bet = lb.bets[i];
            if (
                normalizeArtistName(bet.artist) ==
                normalizeArtistName(_winningArtist)
            ) {
                uint winnings = (bet.amount * bet.odds) / 100;
                payable(bet.user).transfer(winnings);
            }
        }
    }

    /**
     * @notice Extracts the country code from the request ID.
     * @dev This function retrieves the country associated with a given request ID.
     * @param requestId The request ID generated for the oracle request.
     * @return country The country code extracted from the request ID.
     */
    function extractCountryFromRequestId(
        bytes32 requestId
    ) internal view returns (string memory) {
        return requestIdToCountry[requestId];
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
