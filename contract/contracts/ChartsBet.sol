// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import "./Errors.sol";

contract ChartsBet is ChainlinkClient, ConfirmedOwner {
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

    address private oracle;
    bytes32 private jobId;
    uint256 private fee;

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

    event RequestWinningArtist(
        bytes32 indexed requestId,
        string country,
        string winningArtist
    );

    event LeaderboardCreated(bytes32 indexed requestId, string country);

    constructor() ConfirmedOwner(msg.sender) {
        _setPublicChainlinkToken();
        oracle = 0x7AFe1118Ea78C1eae84ca8feE5C68b64E7aC08dF; // Replace with your oracle address
        jobId = "d5270d1c311941d0b08bead21fea7747"; // Replace with your job ID
        fee = (1 * LINK_DIVISIBILITY) / 10; // 0.1 LINK
    }

    function normalizeArtistName(
        string memory artist
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(artist));
    }

    function calculateOdds(
        bytes32 artistHash,
        uint rank,
        uint appearances
    ) internal pure returns (uint) {
        // Effective rank takes into account multiple appearances of the same artist
        uint effectiveRank = (rank + (rank + appearances - 1)) / 2;
        uint odds = 120 + (effectiveRank - 1) * 20;
        return odds;
    }

    function assignRanksAndOdds(
        string memory country,
        string[] memory topArtists
    ) internal {
        Leaderboard storage lb = leaderboards[country];
        mapping(bytes32 => uint) storage artistAppearances = lb.artistRank;

        // Count appearances
        for (uint i = 0; i < topArtists.length; i++) {
            bytes32 artistHash = normalizeArtistName(topArtists[i]);
            artistAppearances[artistHash]++;
        }

        for (uint i = 0; i < topArtists.length; i++) {
            bytes32 artistHash = normalizeArtistName(topArtists[i]);
            if (lb.artistRank[artistHash] == 0) {
                // If rank not assigned yet
                lb.artistRank[artistHash] = i + 1;
                lb.artistOdds[artistHash] = calculateOdds(
                    artistHash,
                    i + 1,
                    artistAppearances[artistHash]
                );
            }
        }
    }

    function createLeaderboard(string memory country) public onlyOwner {
        require(isValidCountry(country), "Invalid country code");

        if (bytes(leaderboards[country].country).length != 0) {
            revert CountryAlreadyExists();
        }

        Chainlink.Request memory req = _buildChainlinkRequest(
            jobId,
            address(this),
            this.fulfillLeaderboard.selector
        );

        // Adding the country parameter to the Chainlink request
        req.add("country", country);

        // Send the Chainlink request to the oracle
        _sendChainlinkRequestTo(oracle, req, fee);

        emit LeaderboardCreated(req.id, country);
    }

    function fulfillLeaderboard(
        bytes32 _requestId,
        string[] memory topArtists
    ) public recordChainlinkFulfillment(_requestId) {
        string memory country = ""; // Extract country from the requestId or pass it in the Chainlink request
        Leaderboard storage newLeaderboard = leaderboards[country];
        newLeaderboard.country = country;
        newLeaderboard.isClosed = false;
        newLeaderboard.startTime = block.timestamp;
        countryList.push(country);

        // Set rank and odds for actual top 10 artists
        assignRanksAndOdds(country, topArtists);
    }

    function placeBet(
        string memory country,
        string memory artist
    ) public payable {
        require(isValidCountry(country), "Invalid country code");

        if (msg.value == 0) {
            revert BetAmountZero();
        }
        if (leaderboards[country].isClosed) {
            revert BettingClosed(country);
        }
        if (
            block.timestamp >= leaderboards[country].startTime + WEEK_DURATION
        ) {
            revert BettingPeriodEnded(country);
        }

        Leaderboard storage lb = leaderboards[country];
        bytes32 artistHash = normalizeArtistName(artist);
        uint odds = lb.artistOdds[artistHash];

        if (odds == 0) {
            odds = 200; // Default odds for artists not in top 10 (2.0x)
        }

        lb.bets.push(Bet(msg.sender, msg.value, artist, odds));
        lb.totalBetAmount += msg.value;
        lb.totalBetsOnArtist[artistHash] += msg.value;
    }

    function requestWinningArtist(string memory country) public onlyOwner {
        require(isValidCountry(country), "Invalid country code");

        if (leaderboards[country].isClosed) {
            revert BettingClosed(country);
        }
        if (block.timestamp < leaderboards[country].startTime + WEEK_DURATION) {
            revert BettingPeriodNotEndedYet(country);
        }

        Chainlink.Request memory req = _buildChainlinkRequest(
            jobId,
            address(this),
            this.fulfill.selector
        );

        // Adding the country parameter to the Chainlink request
        req.add("country", country);

        // Send the Chainlink request to the oracle
        _sendChainlinkRequestTo(oracle, req, fee);

        // Mark the leaderboard as closed to prevent further bets
        leaderboards[country].isClosed = true;
    }

    function fulfill(
        bytes32 _requestId,
        string memory _winningArtist
    ) public recordChainlinkFulfillment(_requestId) {
        bytes32 artistHash = normalizeArtistName(_winningArtist);
        emit RequestWinningArtist(
            _requestId,
            leaderboards[countryList[0]].country,
            _winningArtist
        );

        for (uint i = 0; i < countryList.length; i++) {
            Leaderboard storage lb = leaderboards[countryList[i]];
            if (!lb.isClosed) {
                lb.winningArtist = _winningArtist;
                lb.isClosed = true;

                for (uint j = 0; j < lb.bets.length; j++) {
                    Bet storage bet = lb.bets[j];
                    if (normalizeArtistName(bet.artist) == artistHash) {
                        uint winnings = (bet.amount * bet.odds) / 100;
                        payable(bet.user).transfer(winnings);
                    }
                }
            }
        }
    }

    function emergencyWithdraw() public onlyOwner {
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
}
