// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {SentinelReportRegistry} from "../src/SentinelReportRegistry.sol";

contract SentinelReportRegistryTest is Test {
    SentinelReportRegistry internal registry;
    address internal user = address(0xA11CE);

    event ReportCreated(
        address indexed user,
        bytes32 indexed reportHash,
        uint256 riskScore,
        string recommendation,
        string reportURI,
        uint256 timestamp
    );

    function setUp() public {
        registry = new SentinelReportRegistry();
    }

    function testCreateReportStoresReport() public {
        bytes32 reportHash = keccak256("sentinel-report");

        vm.prank(user);
        registry.createReport(reportHash, 24, "STANDARD_ROUTE", "ipfs://report-1");

        SentinelReportRegistry.Report[] memory reports = registry.getUserReports(user);
        assertEq(reports.length, 1);
        assertEq(reports[0].user, user);
        assertEq(reports[0].reportHash, reportHash);
        assertEq(reports[0].riskScore, 24);
        assertEq(reports[0].recommendation, "STANDARD_ROUTE");
        assertEq(reports[0].reportURI, "ipfs://report-1");
        assertGt(reports[0].timestamp, 0);
    }

    function testGetUserReportsReturnsOnlyUserReports() public {
        bytes32 aliceHash = keccak256("alice");
        bytes32 bobHash = keccak256("bob");
        address bob = address(0xB0B);

        vm.prank(user);
        registry.createReport(aliceHash, 10, "STANDARD_ROUTE", "sentinelmesh://reports/alice");

        vm.prank(bob);
        registry.createReport(bobHash, 55, "DELAYED_EXECUTION", "sentinelmesh://reports/bob");

        SentinelReportRegistry.Report[] memory aliceReports = registry.getUserReports(user);
        SentinelReportRegistry.Report[] memory bobReports = registry.getUserReports(bob);

        assertEq(aliceReports.length, 1);
        assertEq(aliceReports[0].reportHash, aliceHash);
        assertEq(bobReports.length, 1);
        assertEq(bobReports[0].reportHash, bobHash);
    }

    function testCreateReportEmitsEvent() public {
        bytes32 reportHash = keccak256("event-report");
        vm.expectEmit(true, true, false, true);
        emit ReportCreated(user, reportHash, 88, "BLOCKED_UNSAFE", "sentinelmesh://reports/critical", block.timestamp);

        vm.prank(user);
        registry.createReport(reportHash, 88, "BLOCKED_UNSAFE", "sentinelmesh://reports/critical");
    }

    function testRejectsInvalidRiskScore() public {
        vm.expectRevert(SentinelReportRegistry.RiskScoreOutOfRange.selector);
        registry.createReport(keccak256("bad-score"), 101, "STANDARD_ROUTE", "sentinelmesh://reports/bad");
    }

    function testRejectsDuplicateReportForSameUser() public {
        bytes32 reportHash = keccak256("duplicate");

        vm.prank(user);
        registry.createReport(reportHash, 15, "STANDARD_ROUTE", "sentinelmesh://reports/duplicate");

        vm.expectRevert(SentinelReportRegistry.DuplicateReport.selector);
        vm.prank(user);
        registry.createReport(reportHash, 15, "STANDARD_ROUTE", "sentinelmesh://reports/duplicate");
    }

    function testAllowsSameHashForDifferentUsers() public {
        bytes32 reportHash = keccak256("shared-hash");
        address bob = address(0xB0B);

        vm.prank(user);
        registry.createReport(reportHash, 15, "STANDARD_ROUTE", "sentinelmesh://reports/alice");
        vm.prank(bob);
        registry.createReport(reportHash, 15, "STANDARD_ROUTE", "sentinelmesh://reports/bob");

        assertEq(registry.getUserReports(user).length, 1);
        assertEq(registry.getUserReports(bob).length, 1);
    }

    function testRejectsEmptyFieldsAndZeroHash() public {
        vm.expectRevert(SentinelReportRegistry.InvalidReportHash.selector);
        registry.createReport(bytes32(0), 15, "STANDARD_ROUTE", "sentinelmesh://reports/zero");

        vm.expectRevert(SentinelReportRegistry.EmptyRecommendation.selector);
        registry.createReport(keccak256("empty-recommendation"), 15, "", "sentinelmesh://reports/empty");

        vm.expectRevert(SentinelReportRegistry.EmptyReportURI.selector);
        registry.createReport(keccak256("empty-uri"), 15, "STANDARD_ROUTE", "");
    }
}
