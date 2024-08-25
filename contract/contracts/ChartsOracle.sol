// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./Errors.sol";

contract ChartsOracle is Ownable(msg.sender) {
    event RequestLeaderboardData(bytes32 indexed requestId, string country);
    event RequestDailyWinner(bytes32 indexed requestId, string country);

    mapping(bytes32 => bool) private pendingRequests;

    function requestLeaderboardData(
        string memory country
    ) public returns (bytes32 requestId) {
        requestId = keccak256(
            abi.encodePacked(msg.sender, block.timestamp, country)
        );
        pendingRequests[requestId] = true;
        emit RequestLeaderboardData(requestId, country);
    }

    function requestDailyWinner(
        string memory country
    ) public returns (bytes32 requestId) {
        requestId = keccak256(
            abi.encodePacked(msg.sender, block.timestamp, country)
        );
        pendingRequests[requestId] = true;
        emit RequestDailyWinner(requestId, country);
    }

    function fulfillLeaderboardData(
        bytes32 requestId,
        string memory country,
        string[] memory topArtists
    ) public onlyOwner {
        if (!pendingRequests[requestId]) {
            revert RequestNotPending();
        }
        delete pendingRequests[requestId];

        IChartsBet chartsBet = IChartsBet(owner());
        chartsBet.fulfillTopArtists(country, topArtists);
    }

    function fulfillDailyWinner(
        bytes32 requestId,
        string memory country,
        string memory winningArtist
    ) public onlyOwner {
        if (!pendingRequests[requestId]) {
            revert RequestNotPending();
        }
        delete pendingRequests[requestId];

        IChartsBet chartsBet = IChartsBet(owner());
        chartsBet.fulfillDailyWinner(country, winningArtist);
    }
}

interface IChartsBet {
    function fulfillTopArtists(
        string memory country,
        string[] memory topArtists
    ) external;

    function fulfillDailyWinner(
        string memory country,
        string memory winningArtist
    ) external;
}
