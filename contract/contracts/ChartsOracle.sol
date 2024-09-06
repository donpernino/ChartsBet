// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "./Errors.sol";

contract ChartsOracle is Ownable, Pausable {
    event RequestLeaderboardData(
        bytes32 indexed requestId,
        bytes32 indexed country
    );
    event RequestDailyWinner(
        bytes32 indexed requestId,
        bytes32 indexed country
    );

    mapping(bytes32 => bool) private pendingRequests;
    IChartsBet public chartsBet;

    constructor(address _owner, address _chartsBet) Ownable(_owner) {
        chartsBet = IChartsBet(_chartsBet);
    }

    function requestLeaderboardData(
        bytes32 country
    ) public whenNotPaused returns (bytes32 requestId) {
        requestId = keccak256(
            abi.encodePacked(
                msg.sender,
                block.timestamp,
                country,
                "leaderboard"
            )
        );
        pendingRequests[requestId] = true;
        emit RequestLeaderboardData(requestId, country);
        return requestId;
    }

    function requestDailyWinner(
        bytes32 country
    ) public whenNotPaused returns (bytes32 requestId) {
        requestId = keccak256(
            abi.encodePacked(
                msg.sender,
                block.timestamp,
                country,
                "dailyWinner"
            )
        );
        pendingRequests[requestId] = true;
        emit RequestDailyWinner(requestId, country);
        return requestId;
    }

    function setChartsBet(address _chartsBet) public onlyOwner {
        require(_chartsBet != address(0), "Invalid ChartsBet address");
        chartsBet = IChartsBet(_chartsBet);
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}

interface IChartsBet {
    function fulfillTopArtists(
        bytes32 country,
        bytes32[] memory topArtists
    ) external;

    function fulfillDailyWinner(
        bytes32 country,
        bytes32 winningArtist
    ) external;
}
