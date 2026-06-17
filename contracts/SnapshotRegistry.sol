// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Anchor assumption-audit fingerprints on Base Sepolia.
/// dataHash = keccak256 of the JSON-serialised audit object.
/// label    = market question (first 60 chars) for human readability.
contract SnapshotRegistry {
    event SnapshotAnchored(
        address indexed reporter,
        bytes32 dataHash,
        string  label,
        uint256 timestamp
    );

    function anchor(bytes32 dataHash, string calldata label) external {
        emit SnapshotAnchored(msg.sender, dataHash, label, block.timestamp);
    }
}
