// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import "./Errors.sol";

contract Oracle {
    address public owner;
    address public oracleAddress;

    event RequestLeaderboardData(bytes32 indexed requestId, string country);
    event RequestDailyWinner(bytes32 indexed requestId, string country);

    mapping(bytes32 => bool) private pendingRequests;

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

    constructor() {
        owner = msg.sender;
    }

    /**
     * @notice Sets the address of the off-chain oracle service.
     * @dev Can only be called by the owner and only if the oracle address has not been set before.
     * @param _oracleAddress The address of the off-chain oracle service.
     */
    function setOracleAddress(address _oracleAddress) public onlyOwner {
        if (oracleAddress != address(0)) {
            revert OracleAlreadySet();
        }
        oracleAddress = _oracleAddress;
    }

    /**
     * @notice Creates a request for leaderboard data for a specific country.
     * @param country The country code for which the leaderboard data is requested.
     * @return requestId The unique ID for this data request.
     */
    function requestLeaderboardData(
        string memory country
    ) public returns (bytes32 requestId) {
        requestId = keccak256(
            abi.encodePacked(msg.sender, block.timestamp, country)
        );
        pendingRequests[requestId] = true;
        emit RequestLeaderboardData(requestId, country);
    }

    /**
     * @notice Creates a request for the daily winner for a specific country.
     * @param country The country code for which the daily winner is requested.
     * @return requestId The unique ID for this data request.
     */
    function requestDailyWinner(
        string memory country
    ) public returns (bytes32 requestId) {
        requestId = keccak256(
            abi.encodePacked(msg.sender, block.timestamp, country)
        );
        pendingRequests[requestId] = true;
        emit RequestDailyWinner(requestId, country);
    }

    /**
     * @notice Called by the off-chain oracle to fulfill a leaderboard data request.
     * @dev Can only be called by the authorized oracle address.
     * @param requestId The unique ID of the data request.
     * @param country The country code for which the data was requested.
     * @param topArtists An array of top artists for the specified country.
     */
    function fulfillLeaderboardData(
        bytes32 requestId,
        string memory country,
        string[] memory topArtists
    ) public onlyOracle {
        if (!pendingRequests[requestId]) {
            revert RequestNotPending();
        }
        delete pendingRequests[requestId];

        // Call the ChartsBet contract to fulfill the data
        ChartsBet chartsBet = ChartsBet(owner);
        chartsBet.fulfillTopArtists(country, topArtists);
    }

    /**
     * @notice Called by the off-chain oracle to fulfill a daily winner request.
     * @dev Can only be called by the authorized oracle address.
     * @param requestId The unique ID of the data request.
     * @param country The country code for which the data was requested.
     * @param winningArtist The winning artist's name for the specified country.
     */
    function fulfillDailyWinner(
        bytes32 requestId,
        string memory country,
        string memory winningArtist
    ) public onlyOracle {
        if (!pendingRequests[requestId]) {
            revert RequestNotPending();
        }
        delete pendingRequests[requestId];

        // Call the ChartsBet contract to fulfill the data
        ChartsBet chartsBet = ChartsBet(owner);
        chartsBet.fulfillDailyWinner(country, winningArtist);
    }
}

interface ChartsBet {
    function fulfillTopArtists(
        string memory country,
        string[] memory topArtists
    ) external;
    function fulfillDailyWinner(
        string memory country,
        string memory winningArtist
    ) external;
}
