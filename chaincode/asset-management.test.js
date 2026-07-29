'use strict';

const assert = require('assert');
const { Context } = require('fabric-contract-api');

const AssetManagementContract = require('./lib/asset-management.js');

describe('AssetManagement Contract', () => {
    let contract;
    let ctx;

    beforeEach(() => {
        contract = new AssetManagementContract();
        ctx = new Context();
    });

    describe('CreateAsset', () => {
        it('should create a new asset', async () => {
            const result = await contract.CreateAsset(
                ctx, 'ASSET-001', 'IT', 'Computer', 'Test Laptop', 
                '2024-01-15', 100000, 'IT Room 1', 'John Doe', '2026-01-15', ''
            );
            const asset = JSON.parse(result);
            assert.strictEqual(asset.assetId, 'ASSET-001');
            assert.strictEqual(asset.department, 'IT');
            assert.strictEqual(asset.status, 'Active');
        });

        it('should throw error if asset already exists', async () => {
            await contract.CreateAsset(ctx, 'ASSET-001', 'IT', 'Computer', 'Test', 
                '2024-01-15', 100000, 'IT Room 1', 'John Doe', '2026-01-15', '');
            await assert.rejects(
                () => contract.CreateAsset(ctx, 'ASSET-001', 'IT', 'Computer', 'Test2',
                    '2024-01-15', 100000, 'IT Room 1', 'John Doe', '2026-01-15', ''),
                /already exists/
            );
        });
    });

    describe('ReadAsset', () => {
        it('should return asset if exists', async () => {
            await contract.CreateAsset(ctx, 'ASSET-001', 'IT', 'Computer', 'Test Laptop',
                '2024-01-15', 100000, 'IT Room 1', 'John Doe', '2026-01-15', '');
            const result = await contract.ReadAsset(ctx, 'ASSET-001');
            const asset = JSON.parse(result);
            assert.strictEqual(asset.assetId, 'ASSET-001');
        });

        it('should throw error if asset does not exist', async () => {
            await assert.rejects(
                () => contract.ReadAsset(ctx, 'NONEXISTENT'),
                /does not exist/
            );
        });
    });

    describe('UpdateAsset', () => {
        it('should update asset field', async () => {
            await contract.CreateAsset(ctx, 'ASSET-001', 'IT', 'Computer', 'Test Laptop',
                '2024-01-15', 100000, 'IT Room 1', 'John Doe', '2026-01-15', '');
            const result = await contract.UpdateAsset(ctx, 'ASSET-001', 'location', 'IT Room 2');
            const asset = JSON.parse(result);
            assert.strictEqual(asset.location, 'IT Room 2');
        });
    });

    describe('AssetExists', () => {
        it('should return true if asset exists', async () => {
            await contract.CreateAsset(ctx, 'ASSET-001', 'IT', 'Computer', 'Test Laptop',
                '2024-01-15', 100000, 'IT Room 1', 'John Doe', '2026-01-15', '');
            const exists = await contract.AssetExists(ctx, 'ASSET-001');
            assert.strictEqual(exists, true);
        });

        it('should return false if asset does not exist', async () => {
            const exists = await contract.AssetExists(ctx, 'NONEXISTENT');
            assert.strictEqual(exists, false);
        });
    });

    describe('AddMaintenanceRecord', () => {
        it('should add maintenance record to asset', async () => {
            await contract.CreateAsset(ctx, 'ASSET-001', 'IT', 'Computer', 'Test Laptop',
                '2024-01-15', 100000, 'IT Room 1', 'John Doe', '2026-01-15', '');
            const result = await contract.AddMaintenanceRecord(
                ctx, 'ASSET-001', 'Tech-001', '2024-06-01', 'Screen replacement', 5000, 'Completed'
            );
            const record = JSON.parse(result);
            assert.strictEqual(record.technician, 'Tech-001');
            assert.strictEqual(record.status, 'Completed');
        });
    });

    describe('RequestCondemnation', () => {
        it('should request condemnation for asset', async () => {
            await contract.CreateAsset(ctx, 'ASSET-001', 'IT', 'Computer', 'Test Laptop',
                '2024-01-15', 100000, 'IT Room 1', 'John Doe', '2026-01-15', '');
            const result = await contract.RequestCondemnation(ctx, 'ASSET-001', 'End of life', 'John Doe');
            const record = JSON.parse(result);
            assert.strictEqual(record.reason, 'End of life');
            assert.strictEqual(record.status, 'Pending');
        });
    });

    describe('ApproveCondemnation', () => {
        it('should approve condemnation request', async () => {
            await contract.CreateAsset(ctx, 'ASSET-001', 'IT', 'Computer', 'Test Laptop',
                '2024-01-15', 100000, 'IT Room 1', 'John Doe', '2026-01-15', '');
            await contract.RequestCondemnation(ctx, 'ASSET-001', 'End of life', 'John Doe');
            const result = await contract.ApproveCondemnation(ctx, 'ASSET-001', 'Admin');
            const record = JSON.parse(result);
            assert.strictEqual(record.status, 'Approved');
        });
    });

    describe('GenerateYearlyReport', () => {
        it('should generate yearly report', async () => {
            await contract.CreateAsset(ctx, 'ASSET-001', 'IT', 'Computer', 'Test Laptop',
                '2024-01-15', 100000, 'IT Room 1', 'John Doe', '2026-01-15', '');
            const result = await contract.GenerateYearlyReport(ctx, '2024');
            const report = JSON.parse(result);
            assert.strictEqual(report.year, '2024');
            assert.strictEqual(report.totalAssets, 1);
        });
    });
});