// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Deploy with Remix on Base Sepolia (Amoy for Polymarket).
///         Records swarm decisions on-chain for immutable audit trail.
contract SnapshotRegistry {
    event DecisionRecorded(
        uint256 indexed timestamp,
        string  marketQuestion,
        uint32  probability,       // scaled 1e4: 6700 = 67.00%
        uint32  kellyBps,          // basis points: 300 = 3.00%
        string  farcasterCastHash, // empty until D4
        string  txHash             // Polymarket order tx, empty until D3
    );

    address public immutable owner;

    constructor() {
        owner = msg.sender;
    }

    function recordDecision(
        string calldata marketQuestion,
        uint32 probability,
        uint32 kellyBps,
        string calldata farcasterCastHash,
        string calldata txHash
    ) external {
        require(msg.sender == owner, "not owner");
        emit DecisionRecorded(
            block.timestamp,
            marketQuestion,
            probability,
            kellyBps,
            farcasterCastHash,
            txHash
        );
    }
}
