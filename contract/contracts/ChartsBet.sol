// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

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
        string winningArtist
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

    /// @notice Initializes the contract and sets the owner.
    constructor() {
        owner = msg.sender;
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
                    artistHash,
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

        bytes32 requestId = keccak256(
            abi.encodePacked(country, block.timestamp)
        );
        emit DataRequested(requestId, country);
        emit LeaderboardCreated(requestId, country);
    }

    /**
     * @notice Fulfills the leaderboard data after the artists' rankings are known.
     * @dev This function is called by the owner to finalize the leaderboard.
     * @param _requestId The request ID associated with this leaderboard.
     * @param topArtists An array of the top artist names.
     * @param country The country for which the leaderboard is being fulfilled.
     */
    function fulfillLeaderboard(
        bytes32 _requestId,
        string[] memory topArtists,
        string memory country
    ) public onlyOwner {
        if (bytes(leaderboards[country].country).length != 0) {
            revert CountryAlreadyExists();
        }

        Leaderboard storage newLeaderboard = leaderboards[country];
        newLeaderboard.country = country;
        newLeaderboard.isClosed = false;
        newLeaderboard.startTime = block.timestamp;
        countryList.push(country);

        assignRanksAndOdds(country, topArtists);
        emit DataFulfilled(_requestId, country, topArtists[0]); // Assuming the first artist is the most popular
    }

    /**
     * @notice Allows users to place bets on artists in a specific country.
     * @dev The betting period must be open, and a valid country code must be provided.
     * @param country The country code where the bet is placed.
     * @param artist The artist's name that the user is betting on.
     */
    function placeBet(
        string memory country,
        string memory artist
    ) public payable {
        if (!isValidCountry(country)) revert InvalidCountryCode(country);
        if (msg.value == 0) revert BetAmountZero();

        Leaderboard storage lb = leaderboards[country];
        if (lb.isClosed) revert BettingClosed();
        if (block.timestamp >= lb.startTime + WEEK_DURATION)
            revert BettingPeriodEnded();

        bytes32 artistHash = normalizeArtistName(artist);
        uint odds = lb.artistOdds[artistHash];

        if (odds == 0) {
            odds = 200; // Default odds for artists not in top 10 (2.0x)
        }

        lb.bets.push(Bet(msg.sender, msg.value, artist, odds));
        lb.totalBetAmount += msg.value;
        lb.totalBetsOnArtist[artistHash] += msg.value;

        emit BetPlaced(msg.sender, country, artist, msg.value);
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

        bytes32 requestId = keccak256(
            abi.encodePacked(country, block.timestamp)
        );
        emit DataRequested(requestId, country);
        lb.isClosed = true;
    }

    /**
     * @notice Fulfills the winning artist and distributes winnings to the betters.
     * @dev The owner fulfills the request and transfers the winnings to the respective betters.
     * @param _requestId The request ID associated with this fulfillment.
     * @param _winningArtist The winning artist's name.
     * @param country The country code for which the fulfillment is being processed.
     */
    function fulfill(
        bytes32 _requestId,
        string memory _winningArtist,
        string memory country
    ) public onlyOwner {
        Leaderboard storage lb = leaderboards[country];
        lb.winningArtist = _winningArtist;
        lb.isClosed = true;

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
