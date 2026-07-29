# Testing Guide

## Table of Contents
1. [Testing Overview](#testing-overview)
2. [Prerequisites](#prerequisites)
3. [Running Tests](#running-tests)
4. [Smart Contract Tests](#smart-contract-tests)
5. [Backend Service Tests](#backend-service-tests)
6. [API Integration Tests](#api-integration-tests)
7. [End-to-End Tests](#end-to-end-tests)
8. [Test Results Interpretation](#test-results-interpretation)

---

## Testing Overview

This system employs a comprehensive testing strategy covering:
- **Unit Tests**: Individual function/module testing
- **Integration Tests**: API and service integration
- **End-to-End Tests**: Full workflow validation
- **Smart Contract Tests**: Blockchain functionality

---

## Prerequisites

Before running tests, ensure:

1. **Hardhat Node Running**
   ```bash
   cd blockchain
   npx hardhat node
   ```

2. **MongoDB Running**
   ```bash
   # Local MongoDB
   mongod --dbpath ./data/db
   
   # Or use Atlas with valid credentials
   ```

3. **Gateway Running**
   ```bash
   cd gateway
   npm start
   ```

4. **Dependencies Installed**
   ```bash
   npm install
   ```

---

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Specific Test Types
```bash
# Backend service tests
npm run test:backend

# API integration tests
npm run test:api

# End-to-end tests
npm run test:e2e

# Smart contract tests
npm run blockchain:test
```

### Run Tests in Docker
```bash
docker-compose up -d
docker-compose exec gateway npm test
```

---

## Smart Contract Tests

### Location
`blockchain/test/SupplyChainRegistry.test.js`

### Test Coverage
- Product registration
- Ownership transfer
- Shipment recording
- Sensor reading recording
- Delivery marking
- Access control validation
- Event emission

### Running Smart Contract Tests
```bash
cd blockchain
npx hardhat test
```

### Expected Output
```
SupplyChainRegistry
  ✓ registers products and tracks ownership history (123ms)
  ✓ rejects unauthorized product registration (45ms)
  
2 passing
```

### Test Data
Tests use mock accounts:
- **Admin**: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
- **Manufacturer**: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8
- **Transporter**: 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
- **Retailer**: 0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65

---

## Backend Service Tests

### Location
`tests/backend.test.js`

### Test Coverage
- Report service (create, list, export)
- Alert service (create, list)
- Audit service (record, list)

### Running Backend Tests
```bash
npm run test:backend
```

### Expected Output
```
=== Backend Service Tests ===

1. Testing Report Service...
   Create Report: PASS
   List Reports: PASS
   CSV Export: PASS
   PDF Export: PASS

2. Testing Alert Service...
   Create Alert: PASS
   List Alerts: PASS

3. Testing Audit Service...
   Create Audit Log: PASS
   List Audit Logs: PASS

=== Backend Tests Completed ===
```

---

## API Integration Tests

### Location
`tests/api.test.js`

### Test Coverage
- Health endpoint
- Products endpoint
- Dashboard endpoint
- Alerts endpoint
- Devices endpoint
- Reports endpoint

### Running API Tests
```bash
npm run test:api
```

### Test Endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| /health | GET | Check system health |
| /assets | GET | List products |
| /api/dashboard | GET | Get dashboard data |
| /alerts | GET | List alerts |
| /devices | GET | List devices |
| /reports | GET | List reports |

---

## End-to-End Tests

### Location
`tests/e2e.test.js`

### Test Coverage
- Full authentication flow
- Dashboard access and data
- Product operations
- Sensor data submission
- Export functionality

### Running E2E Tests
```bash
npm run test:e2e
```

### Test Scenarios

#### Authentication Flow
1. Health check → Verify system is running
2. Login → Verify JWT token received
3. Dashboard access → Verify data loads

#### Product Workflow
1. Product registration → Verify on-chain
2. Ownership transfer → Verify update
3. Shipment recording → Verify history
4. Verification → Compare on-chain vs off-chain

#### IoT Integration
1. Send sensor data → Verify stored
2. Check alert generation → Verify threshold

---

## Test Results Interpretation

### Pass Criteria
- All unit tests pass
- All integration tests return expected data
- All E2E tests complete successfully
- Smart contract tests pass

### Common Failures

| Error | Cause | Solution |
|-------|-------|----------|
| Connection refused | Service not running | Start MongoDB and Gateway |
| Authorization failed | No token | Login first |
| Database unavailable | MongoDB down | Start MongoDB |
| Transaction reverted | Contract issue | Redeploy contract |
| Timeout | Slow network | Increase timeout |

### Test Logs
Test output is logged to console:
- PASS: Operation completed successfully
- FAIL: Operation failed with error details
- SKIP: Test skipped (requires manual setup)

---

## Continuous Integration

### GitHub Actions Workflow
Add to `.github/workflows/test.yml`:
```yaml
name: Run Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      mongodb:
        image: mongo:7
        ports: ['27017:27017']
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm install
      - run: npm test
```

---

## Performance Benchmarks

### Expected Response Times
| Endpoint | Expected Time |
|----------|---------------|
| /health | < 100ms |
| /assets | < 200ms |
| /api/dashboard | < 300ms |
| /verification/:id | < 500ms |

### Blockchain Gas Costs
| Function | Gas Estimate |
|----------|--------------|
| registerProduct | 150,000 |
| transferOwnership | 65,000 |
| recordShipment | 85,000 |
| recordSensorReading | 75,000 |
| markDelivered | 55,000 |

---

## Security Testing

### Test Checklist
- [ ] JWT token validation
- [ ] Role-based access control
- [ ] Input sanitization
- [ ] Rate limiting
- [ ] CORS configuration
- [ ] SQL injection prevention
- [ ] XSS prevention

---

## Manual Testing Checklist

### Before Deployment
- [ ] All automated tests pass
- [ ] Manual verification of critical paths
- [ ] Cross-browser compatibility check
- [ ] Mobile responsiveness check
- [ ] Security scan completed
- [ ] Performance benchmark run

### Post-Deployment
- [ ] Smoke test all endpoints
- [ ] Verify blockchain connectivity
- [ ] Check MongoDB connections
- [ ] Validate MQTT message flow
- [ ] Test export functionality
- [ ] Verify alert generation