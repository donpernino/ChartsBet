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
        mapping(string => uint) totalBetsOnArtist;
        mapping(string => uint) artistRank; // Rank for each artist in the leaderboard
        mapping(string => uint) artistOdds; // Odds for each artist in the leaderboard
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
        setPublicChainlinkToken();
        oracle = 0x7AFe1118Ea78C1eae84ca8feE5C68b64E7aC08dF; // Replace with your oracle address
        jobId = "d5270d1c311941d0b08bead21fea7747"; // Replace with your job ID
        fee = (1 * LINK_DIVISIBILITY) / 10; // 0.1 LINK
    }

    function calculateOdds(
        string memory artist,
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
        mapping(string => uint) storage artistAppearances = lb.artistRank;

        // Count appearances
        for (uint i = 0; i < topArtists.length; i++) {
            artistAppearances[topArtists[i]]++;
        }

        for (uint i = 0; i < topArtists.length; i++) {
            if (lb.artistRank[topArtists[i]] == 0) {
                // If rank not assigned yet
                lb.artistRank[topArtists[i]] = i + 1;
                lb.artistOdds[topArtists[i]] = calculateOdds(
                    topArtists[i],
                    i + 1,
                    artistAppearances[topArtists[i]]
                );
            }
        }
    }

    function createLeaderboard(string memory country) public onlyOwner {
        require(isValidCountry(country), "Invalid country code");

        if (bytes(leaderboards[country].country).length != 0) {
            revert CountryAlreadyExists();
        }

        Chainlink.Request memory req = buildChainlinkRequest(
            jobId,
            address(this),
            this.fulfillLeaderboard.selector
        );

        // Adding the country parameter to the Chainlink request
        req.add("country", country);

        // Send the Chainlink request to the oracle
        sendChainlinkRequestTo(oracle, req, fee);

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
        uint odds = lb.artistOdds[artist];

        if (odds == 0) {
            odds = 200; // Default odds for artists not in top 10 (2.0x)
        }

        lb.bets.push(Bet(msg.sender, msg.value, artist, odds));
        lb.totalBetAmount += msg.value;
        lb.totalBetsOnArtist[artist] += msg.value;
    }

    function requestWinningArtist(string memory country) public onlyOwner {
        require(isValidCountry(country), "Invalid country code");

        if (leaderboards[country].isClosed) {
            revert BettingClosed(country);
        }
        if (block.timestamp < leaderboards[country].startTime + WEEK_DURATION) {
            revert BettingPeriodNotEndedYet(country);
        }

        Chainlink.Request memory req = buildChainlinkRequest(
            jobId,
            address(this),
            this.fulfill.selector
        );

        // Adding the country parameter to the Chainlink request
        req.add("country", country);

        // Send the Chainlink request to the oracle
        sendChainlinkRequestTo(oracle, req, fee);

        // Mark the leaderboard as closed to prevent further bets
        leaderboards[country].isClosed = true;
    }

    function fulfill(
        bytes32 _requestId,
        string memory _winningArtist
    ) public recordChainlinkFulfillment(_requestId) {
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
                    if (
                        keccak256(abi.encodePacked(bet.artist)) ==
                        keccak256(abi.encodePacked(_winningArtist))
                    ) {
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
        return leaderboards[country].totalBetsOnArtist[artist];
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
