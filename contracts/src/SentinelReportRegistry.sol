// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract SentinelReportRegistry {
    struct Report {
        address user;
        bytes32 reportHash;
        uint256 riskScore;
        string recommendation;
        string reportURI;
        uint256 timestamp;
    }

    mapping(address user => Report[] reports) private userReports;
    mapping(address user => mapping(bytes32 reportHash => bool created)) private reportExists;

    event ReportCreated(
        address indexed user,
        bytes32 indexed reportHash,
        uint256 riskScore,
        string recommendation,
        string reportURI,
        uint256 timestamp
    );

    error InvalidReportHash();
    error RiskScoreOutOfRange();
    error EmptyRecommendation();
    error EmptyReportURI();
    error DuplicateReport();

    function createReport(
        bytes32 reportHash,
        uint256 riskScore,
        string calldata recommendation,
        string calldata reportURI
    ) external {
        if (reportHash == bytes32(0)) revert InvalidReportHash();
        if (riskScore > 100) revert RiskScoreOutOfRange();
        if (bytes(recommendation).length == 0) revert EmptyRecommendation();
        if (bytes(reportURI).length == 0) revert EmptyReportURI();
        if (reportExists[msg.sender][reportHash]) revert DuplicateReport();

        reportExists[msg.sender][reportHash] = true;
        Report memory report = Report({
            user: msg.sender,
            reportHash: reportHash,
            riskScore: riskScore,
            recommendation: recommendation,
            reportURI: reportURI,
            timestamp: block.timestamp
        });

        userReports[msg.sender].push(report);
        emit ReportCreated(msg.sender, reportHash, riskScore, recommendation, reportURI, block.timestamp);
    }

    function getUserReports(address user) external view returns (Report[] memory) {
        return userReports[user];
    }
}
