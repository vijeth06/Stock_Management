'use strict';

const { Contract } = require('fabric-contract-api');

class AssetManagementContract extends Contract {

    constructor() {
        super('AssetManagement');
    }

    async InitLedger(ctx) {
        console.info('=== InitLedger: Initializing ledger with default assets ===');
        
        const assets = [
            {
                assetId: 'ASSET-001',
                department: 'IT',
                category: 'Computer',
                name: 'Development Laptop',
                purchaseDate: '2024-01-15',
                purchaseValue: 85000,
                status: 'Active',
                location: 'IT Department',
                owner: 'John Smith',
                warrantyExpiry: '2026-01-15',
                billHash: '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];

        for (const asset of assets) {
            await ctx.stub.putState(asset.assetId, Buffer.from(JSON.stringify(asset)));
            console.info(`Asset ${asset.assetId} added to ledger`);
        }

        return;
    }

    async CreateAsset(ctx, assetId, department, category, name, purchaseDate, purchaseValue, location, owner, warrantyExpiry, billHash) {
        console.info(`=== CreateAsset: Creating asset ${assetId} ===`);

        const exists = await this.AssetExists(ctx, assetId);
        if (exists) {
            throw new Error(`Asset ${assetId} already exists`);
        }

        const asset = {
            assetId,
            department,
            category,
            name,
            purchaseDate,
            purchaseValue: parseFloat(purchaseValue),
            status: 'Active',
            location,
            owner,
            warrantyExpiry,
            billHash,
            maintenanceRecords: [],
            maintenanceCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        await ctx.stub.putState(assetId, Buffer.from(JSON.stringify(asset)));
        console.info(`Asset ${assetId} created successfully`);
        return JSON.stringify(asset);
    }

    async ReadAsset(ctx, assetId) {
        console.info(`=== ReadAsset: Reading asset ${assetId} ===`);
        
        const assetJSON = await ctx.stub.getState(assetId);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Asset ${assetId} does not exist`);
        }

        return assetJSON.toString();
    }

    async UpdateAsset(ctx, assetId, field, newValue) {
        console.info(`=== UpdateAsset: Updating ${field} for asset ${assetId} ===`);

        const assetJSON = await ctx.stub.getState(assetId);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Asset ${assetId} does not exist`);
        }

        const asset = JSON.parse(assetJSON.toString());
        asset[field] = newValue;
        asset.updatedAt = new Date().toISOString();

        await ctx.stub.putState(assetId, Buffer.from(JSON.stringify(asset)));
        return JSON.stringify(asset);
    }

    async DeleteAsset(ctx, assetId) {
        console.info(`=== DeleteAsset: Deleting asset ${assetId} ===`);

        const exists = await this.AssetExists(ctx, assetId);
        if (!exists) {
            throw new Error(`Asset ${assetId} does not exist`);
        }

        await ctx.stub.delState(assetId);
        return;
    }

    async AssetExists(ctx, assetId) {
        const assetJSON = await ctx.stub.getState(assetId);
        return assetJSON && assetJSON.length > 0;
    }

    async AddMaintenanceRecord(ctx, assetId, technician, maintenanceDate, description, cost, status) {
        console.info(`=== AddMaintenanceRecord: Adding maintenance for asset ${assetId} ===`);

        const assetJSON = await ctx.stub.getState(assetId);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Asset ${assetId} does not exist`);
        }

        const asset = JSON.parse(assetJSON.toString());
        
        const maintenanceRecord = {
            recordId: `MNT-${Date.now()}`,
            technician,
            maintenanceDate,
            description,
            cost: parseFloat(cost),
            status,
            createdAt: new Date().toISOString()
        };

        asset.maintenanceRecords.push(maintenanceRecord);
        asset.maintenanceCount = (asset.maintenanceCount || 0) + 1;
        asset.updatedAt = new Date().toISOString();

        await ctx.stub.putState(assetId, Buffer.from(JSON.stringify(asset)));
        return JSON.stringify(maintenanceRecord);
    }

    async RequestCondemnation(ctx, assetId, reason, requestedBy) {
        console.info(`=== RequestCondemnation: Requesting condemnation for asset ${assetId} ===`);

        const assetJSON = await ctx.stub.getState(assetId);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Asset ${assetId} does not exist`);
        }

        const asset = JSON.parse(assetJSON.toString());
        
        if (asset.status === 'Condemned') {
            throw new Error(`Asset ${assetId} is already condemned`);
        }

        const condemnationRecord = {
            recordId: `COND-${Date.now()}`,
            reason,
            requestedBy,
            status: 'Pending',
            requestedAt: new Date().toISOString(),
            approvedAt: null,
            approvedBy: null
        };

        asset.condemnationRecord = condemnationRecord;
        asset.status = 'Condemnation Requested';
        asset.updatedAt = new Date().toISOString();

        await ctx.stub.putState(assetId, Buffer.from(JSON.stringify(asset)));
        return JSON.stringify(condemnationRecord);
    }

    async ApproveCondemnation(ctx, assetId, approvedBy) {
        console.info(`=== ApproveCondemnation: Approving condemnation for asset ${assetId} ===`);

        const assetJSON = await ctx.stub.getState(assetId);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Asset ${assetId} does not exist`);
        }

        const asset = JSON.parse(assetJSON.toString());
        
        if (!asset.condemnationRecord || asset.condemnationRecord.status !== 'Pending') {
            throw new Error(`Asset ${assetId} does not have a pending condemnation request`);
        }

        asset.condemnationRecord.status = 'Approved';
        asset.condemnationRecord.approvedAt = new Date().toISOString();
        asset.condemnationRecord.approvedBy = approvedBy;
        asset.status = 'Condemned';
        asset.updatedAt = new Date().toISOString();

        await ctx.stub.putState(assetId, Buffer.from(JSON.stringify(asset)));
        return JSON.stringify(asset.condemnationRecord);
    }

    async GetAssetHistory(ctx, assetId) {
        console.info(`=== GetAssetHistory: Getting history for asset ${assetId} ===`);

        const iterator = await ctx.stub.getHistoryForKey(assetId);
        const allChanges = [];

        for await (const change of iterator) {
            allChanges.push({
                timestamp: change.timestamp.toString(),
                isDelete: change.isDelete,
                value: change.value.toString('utf8')
            });
        }

        return JSON.stringify(allChanges);
    }

    async QueryAssetsByDepartment(ctx, department) {
        console.info(`=== QueryAssetsByDepartment: Querying assets for department ${department} ===`);
        const allAssetsStr = await this.GetAllAssets(ctx);
        const allAssets = JSON.parse(allAssetsStr || '[]');
        const assets = allAssets.filter(a => a.department === department);
        return JSON.stringify(assets);
    }

    async QueryAssetsByCategory(ctx, category) {
        console.info(`=== QueryAssetsByCategory: Querying assets for category ${category} ===`);
        const allAssetsStr = await this.GetAllAssets(ctx);
        const allAssets = JSON.parse(allAssetsStr || '[]');
        const assets = allAssets.filter(a => a.category === category);
        return JSON.stringify(assets);
    }

    async QueryAssetsByStatus(ctx, status) {
        console.info(`=== QueryAssetsByStatus: Querying assets with status ${status} ===`);
        const allAssetsStr = await this.GetAllAssets(ctx);
        const allAssets = JSON.parse(allAssetsStr || '[]');
        const assets = allAssets.filter(a => a.status === status);
        return JSON.stringify(assets);
    }

    async GetAllAssets(ctx) {
        console.info('=== GetAllAssets: Getting all assets ===');

        const iterator = await ctx.stub.getStateByRange('', '');
        const assets = [];

        for await (const res of iterator) {
            if (res.value.toString().length > 0) {
                const asset = JSON.parse(res.value.toString());
                if (asset.assetId && asset.department) {
                    assets.push(asset);
                }
            }
        }

        return JSON.stringify(assets);
    }

    async GenerateYearlyReport(ctx, year) {
        console.info(`=== GenerateYearlyReport: Generating report for ${year} ===`);

        const allAssets = await this.GetAllAssets(ctx);
        const assets = JSON.parse(allAssets);

        const report = {
            year,
            totalAssets: assets.length,
            totalPurchaseValue: assets.reduce((sum, a) => sum + (a.purchaseValue || 0), 0),
            categorySummary: {},
            activeAssets: assets.filter(a => a.status === 'Active').length,
            maintenanceAssets: assets.filter(a => (a.maintenanceCount || 0) > 0).length,
            condemnedAssets: assets.filter(a => a.status === 'Condemned').length,
            disposedAssets: assets.filter(a => a.status === 'Disposed').length,
            departmentSummary: {},
            generatedAt: new Date().toISOString()
        };

        assets.forEach(asset => {
            if (asset.category) {
                report.categorySummary[asset.category] = (report.categorySummary[asset.category] || 0) + 1;
            }
            if (asset.department) {
                report.departmentSummary[asset.department] = (report.departmentSummary[asset.department] || 0) + 1;
            }
        });

        return JSON.stringify(report);
    }

    async VerifyBill(ctx, billId, expectedHash) {
        console.info(`=== VerifyBill: Verifying bill ${billId} ===`);

        const assetJSON = await ctx.stub.getState(billId);
        if (!assetJSON || assetJSON.length === 0) {
            return JSON.stringify({ verified: false, error: `Asset or bill ${billId} does not exist` });
        }

        const verified = asset.billHash && expectedHash === asset.billHash;
        return JSON.stringify({ verified, billId, expectedHash, storedHash: asset.billHash || null });
    }
}

module.exports = AssetManagementContract;

if (require.main === module) {
    const { Shim } = require('fabric-shim');
    Shim.start(new AssetManagementContract());
}