// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./Errors.sol";

contract ChartsOracle is
    Initializable,
    OwnableUpgradeable,
    PausableUpgradeable
{
    event RequestLeaderboardData(
        bytes32 indexed requestId,
        bytes32 indexed country
    );
    event RequestDailyWinner(
        bytes32 indexed requestId,
        bytes32 indexed country
    );
    event LeaderboardDataFulfilled(
        bytes32 indexed requestId,
        bytes32 indexed country
    );
    event DailyWinnerFulfilled(
        bytes32 indexed requestId,
        bytes32 indexed country,
        string winningArtist
    );

    mapping(bytes32 => bool) private pendingRequests;
    IChartsBet public chartsBet;

    function initialize(address _owner, address _chartsBet) public initializer {
        __Ownable_init(_owner);
        __Pausable_init();
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

    function fulfillLeaderboardData(
        bytes32 requestId,
        bytes32 country,
        string[] memory topArtists
    ) public onlyOwner whenNotPaused {
        require(pendingRequests[requestId], "Request not pending");
        delete pendingRequests[requestId];

        chartsBet.fulfillTopArtists(country, topArtists);
        emit LeaderboardDataFulfilled(requestId, country);
    }

    function fulfillDailyWinner(
        bytes32 requestId,
        bytes32 country,
        string memory winningArtist
    ) public onlyOwner whenNotPaused {
        require(pendingRequests[requestId], "Request not pending");
        delete pendingRequests[requestId];

        chartsBet.fulfillDailyWinner(country, winningArtist);
        emit DailyWinnerFulfilled(requestId, country, winningArtist);
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

    // Add a gap for future variable additions without affecting storage layout
    uint256[50] private __gap;
}

interface IChartsBet {
    function fulfillTopArtists(
        bytes32 country,
        string[] memory topArtists
    ) external;

    function fulfillDailyWinner(
        bytes32 country,
        string memory winningArtist
    ) external;
}
