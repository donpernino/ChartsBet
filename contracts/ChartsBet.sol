// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

import "@chainlink/contracts/src/v0.8/ChainlinkClient.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";
import "@chainlink/contracts/src/v0.8/shared/access/ConfirmedOwner.sol";
import "./Errors.sol";

contract ChartsBet is ChainlinkClient, ConfirmedOwner {
    using Chainlink for Chainlink.Request;

    struct Bet {
        address user;
        uint amount;
        string artist;
    }

    struct Genre {
        string name;
        string winningArtist;
        bool isClosed;
        uint totalBetAmount;
        uint startTime;
        uint duration;
        mapping(string => uint) totalBetsOnArtist;
        Bet[] bets;
    }

    mapping(string => Genre) public genres;
    string[] public genreList;

    address private oracle;
    bytes32 private jobId;
    uint256 private fee;

    event RequestWinningArtist(bytes32 indexed requestId, string winningArtist);

    constructor() ConfirmedOwner(msg.sender) {
        setPublicChainlinkToken();
        oracle = 0x7AFe1118Ea78C1eae84ca8feE5C68b64E7aC08dF; // Replace with your oracle address
        jobId = "d5270d1c311941d0b08bead21fea7747"; // Replace with your job ID
        fee = (1 * LINK_DIVISIBILITY) / 10; // 0.1 LINK
    }

    function createGenre(string memory genre, uint duration) public onlyOwner {
        if (bytes(genre).length == 0) {
            revert GenreNameEmpty();
        }
        if (bytes(genres[genre].name).length != 0) {
            revert GenreAlreadyExists();
        }

        Genre storage newGenre = genres[genre];
        newGenre.name = genre;
        newGenre.isClosed = false;
        newGenre.startTime = block.timestamp;
        newGenre.duration = duration;
        genreList.push(genre);
    }

    function placeBet(
        string memory genre,
        string memory artist
    ) public payable {
        if (msg.value == 0) {
            revert BetAmountZero();
        }
        if (genres[genre].isClosed) {
            revert BettingClosed(genre);
        }
        if (
            block.timestamp >= genres[genre].startTime + genres[genre].duration
        ) {
            revert BettingPeriodEnded(genre);
        }

        Genre storage g = genres[genre];
        g.bets.push(Bet(msg.sender, msg.value, artist));
        g.totalBetAmount += msg.value;
        g.totalBetsOnArtist[artist] += msg.value;
    }

    function requestWinningArtist(string memory genre) public onlyOwner {
        if (genres[genre].isClosed) {
            revert BettingClosed(genre);
        }
        if (
            block.timestamp < genres[genre].startTime + genres[genre].duration
        ) {
            revert BettingPeriodNotEndedYet(genre);
        }

        Chainlink.Request memory req = buildChainlinkRequest(
            jobId,
            address(this),
            this.fulfill.selector
        );
        req.add("genre", genre);
        req.add("metric", "most_streamed"); // Metric you want to query, adjust based on your needs
        sendChainlinkRequestTo(oracle, req, fee);

        genres[genre].isClosed = true;
    }

    function fulfill(
        bytes32 _requestId,
        string memory _winningArtist
    ) public recordChainlinkFulfillment(_requestId) {
        emit RequestWinningArtist(_requestId, _winningArtist);

        for (uint i = 0; i < genreList.length; i++) {
            Genre storage g = genres[genreList[i]];
            if (
                !g.isClosed &&
                keccak256(abi.encodePacked(g.name)) ==
                keccak256(abi.encodePacked(_winningArtist))
            ) {
                g.winningArtist = _winningArtist;
                g.isClosed = true;

                for (uint j = 0; j < g.bets.length; j++) {
                    Bet storage bet = g.bets[j];
                    if (
                        keccak256(abi.encodePacked(bet.artist)) ==
                        keccak256(abi.encodePacked(_winningArtist))
                    ) {
                        uint winnings = (bet.amount * g.totalBetAmount) /
                            g.totalBetsOnArtist[_winningArtist];
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
        string memory genre,
        string memory artist
    ) public view returns (uint) {
        return genres[genre].totalBetsOnArtist[artist];
    }

    function getTotalBetAmount(string memory genre) public view returns (uint) {
        return genres[genre].totalBetAmount;
    }

    function getBetsInGenre(
        string memory genre
    ) public view returns (Bet[] memory) {
        Genre storage g = genres[genre];
        Bet[] memory bets = new Bet[](g.bets.length);
        for (uint i = 0; i < g.bets.length; i++) {
            bets[i] = g.bets[i];
        }
        return bets;
    }
}
