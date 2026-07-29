# Next Steps

## Immediate Work
- Add Hardhat deployment scripts.
- Create MongoDB models for products, sensors, alerts, and audit logs.
- Add JWT authentication and role-based authorization.
- Add MQTT ingestion for ESP32 telemetry.

## UI Work
- Completed: enterprise app shell with role-based sections, dashboard panels, and product explorer.
- Remaining: charts, maps, alert center, export flows, and QR generation/verification polish.

## Validation
- Run Solidity tests.
- Add API tests for registration, transfer, and history endpoints.
- Add end-to-end checks for sensor hashing and alert generation.

## Deployment
- Add Docker Compose for MongoDB, MQTT, the API, and the local chain.
- Document the contract address and local signer setup.

## Priority Backlog If Work Pauses
1. Add chart widgets and analytics summaries for the dashboard.
2. Add QR code generation and verification polish for consumer validation.
3. Add MQTT ingestion from ESP32 with threshold-based alert generation.
4. Add CSV and PDF export for reports and audit logs.
5. Add API tests, frontend tests, and end-to-end smoke tests.
6. Add Docker Compose for MongoDB, MQTT broker, gateway, and Hardhat node.
