# Migration Plan: Fabric Demo to Ethereum IoT Supply Chain

## Goal

Transform the existing Fabric-based supply-chain demo into an Ethereum-based IoT supply-chain management system without discarding reusable domain, UI, and documentation assets.

## What Will Be Reused

- Product lifecycle rules for create, transfer, read, and history flows
- Existing browser UI patterns and form layout as an initial UX baseline
- Existing Express route names where they still make sense for the new API
- Existing domain documentation as reference material during the migration

## What Will Be Replaced

- Fabric chaincode and wallet logic
- Fabric test-network scripts, channel helpers, and CA artifacts
- Fabric-specific connection profiles and network configuration
- Fabric SDK dependencies in the backend

## Incremental Delivery Order

1. Introduce the Ethereum contract scaffold and local development toolchain.
2. Replace the backend gateway with an Express + Ethers.js service.
3. Rewire the UI to call the Ethereum-backed API.
4. Add IoT ingestion, hashing, alerts, and audit logging.
5. Add reports, analytics, blockchain explorer, and QR verification.
6. Remove remaining Fabric-only files and dependencies.

## Validation Strategy

- Compile and test the Solidity contract as soon as it exists.
- Validate the backend API slice after each blockchain integration change.
- Keep the UI working against the current API contract while backend internals change.
- Remove Fabric artifacts only after the Ethereum replacement for that slice is in place.

## Architectural Principle

Prefer small, testable substitutions over a full rewrite. Preserve working surface area unless the Fabric dependency prevents the Ethereum implementation.