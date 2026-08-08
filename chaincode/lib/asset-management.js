
async function getAllResults(iterator) {
    const allResults = [];
    try {
        let res = await iterator.next();
        while (!res.done) {
            if (res.value) {
                allResults.push(res.value);
            }
            res = await iterator.next();
        }
    } finally {
        if (iterator && typeof iterator.close === 'function') {
            await iterator.close();
        }
    }
    return allResults;
}
let Contract;
try {
    Contract = require('fabric-contract-api').Contract;
} catch (e) {
    Contract = class Contract {
        constructor(name) {
            this.name = name;
        }
    };
}

class AssetManagementContract extends Contract {

    constructor() {
        super('AssetManagement');
    }

    async InitLedger(ctx) {
        console.info('=== InitLedger: Initializing ledger with default assets and demo entities ===');
        
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
                maintenanceRecords: [],
                maintenanceCount: 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
        ];

        for (const asset of assets) {
            await ctx.stub.putState(asset.assetId, Buffer.from(JSON.stringify(asset)));
            console.info(`Asset ${asset.assetId} added to ledger`);
        }

        // Initialize default IT department
        const defaultDept = {
            code: 'IT',
            name: 'Information Technology',
            description: 'IT Services & Asset Support',
            manager: 'Admin',
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        await ctx.stub.putState('DEPT_IT', Buffer.from(JSON.stringify(defaultDept)));

        return;
    }

    // ==========================================
    // USER MANAGEMENT FUNCTIONS
    // ==========================================

    async CreateUser(ctx, userId, name, email, passwordHash, role, department, departmentName, status, isApproved) {
        console.info(`=== CreateUser: Creating user ${email} ===`);
        const emailKey = `USER_${email.toLowerCase().trim()}`;
        const idKey = `USER_ID_${userId}`;

        const userObj = {
            id: userId,
            userId,
            name,
            email: email.toLowerCase().trim(),
            password: passwordHash,
            role: role || 'DepartmentUser',
            department: (department || 'IT').toUpperCase(),
            departmentName: departmentName || department || 'IT',
            status: status || 'Active',
            isApproved: isApproved === 'true' || isApproved === true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const jsonStr = JSON.stringify(userObj);
        await ctx.stub.putState(emailKey, Buffer.from(jsonStr));
        await ctx.stub.putState(idKey, Buffer.from(jsonStr));
        return jsonStr;
    }

    async ReadUser(ctx, emailOrId) {
        console.info(`=== ReadUser: Reading user ${emailOrId} ===`);
        let key = emailOrId.startsWith('USER_') ? emailOrId : `USER_${emailOrId.toLowerCase().trim()}`;
        let userJSON = await ctx.stub.getState(key);

        if (!userJSON || userJSON.length === 0) {
            key = `USER_ID_${emailOrId}`;
            userJSON = await ctx.stub.getState(key);
        }

        if (!userJSON || userJSON.length === 0) {
            throw new Error(`User ${emailOrId} does not exist on ledger`);
        }

        return userJSON.toString();
    }

    async UpdateUser(ctx, emailOrId, updatesJson) {
        console.info(`=== UpdateUser: Updating user ${emailOrId} ===`);
        const existingStr = await this.ReadUser(ctx, emailOrId);
        const existing = JSON.parse(existingStr);
        const updates = JSON.parse(updatesJson);

        const updatedUser = {
            ...existing,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        const jsonStr = JSON.stringify(updatedUser);
        const emailKey = `USER_${updatedUser.email.toLowerCase().trim()}`;
        const idKey = `USER_ID_${updatedUser._id || updatedUser.userId}`;

        await ctx.stub.putState(emailKey, Buffer.from(jsonStr));
        await ctx.stub.putState(idKey, Buffer.from(jsonStr));
        return jsonStr;
    }

    async GetAllUsers(ctx) {
        console.info('=== GetAllUsers: Querying all ledger users ===');
        const iterator = await ctx.stub.getStateByRange('USER_', 'USER_\uffff');
        const users = [];
        const seenEmails = new Set();

        const res_items = await getAllResults(iterator);
        for (const res of res_items) {
            if (res.key.startsWith('USER_ID_')) continue;
            if (res.value.toString().length > 0) {
                const user = JSON.parse(res.value.toString());
                if (user.email && !seenEmails.has(user.email)) {
                    seenEmails.add(user.email);
                    users.push(user);
                }
            }
        }
        return JSON.stringify(users);
    }

    // ==========================================
    // DEPARTMENT MANAGEMENT FUNCTIONS
    // ==========================================

    async CreateDepartment(ctx, code, name, description, manager) {
        console.info(`=== CreateDepartment: Creating department ${code} ===`);
        const deptKey = `DEPT_${code.toUpperCase().trim()}`;
        const deptObj = {
            id: `dept-${Date.now()}`,
            code: code.toUpperCase().trim(),
            name,
            description,
            manager,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        const jsonStr = JSON.stringify(deptObj);
        await ctx.stub.putState(deptKey, Buffer.from(jsonStr));
        return jsonStr;
    }

    async ReadDepartment(ctx, code) {
        const deptKey = `DEPT_${code.toUpperCase().trim()}`;
        const json = await ctx.stub.getState(deptKey);
        if (!json || json.length === 0) {
            throw new Error(`Department ${code} does not exist`);
        }
        return json.toString();
    }

    async UpdateDepartment(ctx, code, updatesJson) {
        const existingStr = await this.ReadDepartment(ctx, code);
        const existing = JSON.parse(existingStr);
        const updates = JSON.parse(updatesJson);

        const updated = {
            ...existing,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        const jsonStr = JSON.stringify(updated);
        const deptKey = `DEPT_${updated.code.toUpperCase().trim()}`;
        await ctx.stub.putState(deptKey, Buffer.from(jsonStr));
        return jsonStr;
    }

    async GetAllDepartments(ctx) {
        const iterator = await ctx.stub.getStateByRange('DEPT_', 'DEPT_\uffff');
        const depts = [];

        const res_items = await getAllResults(iterator);
        for (const res of res_items) {
            if (res.value.toString().length > 0) {
                const dept = JSON.parse(res.value.toString());
                if (dept.code) {
                    depts.push(dept);
                }
            }
        }
        return JSON.stringify(depts);
    }

    // ==========================================
    // BILL MANAGEMENT FUNCTIONS
    // ==========================================

    async CreateBill(ctx, billId, assetId, department, vendor, invoiceNumber, amount, documentHash, paymentStatus, documentKey) {
        console.info(`=== CreateBill: Recording bill ${billId} ===`);
        const billKey = `BILL_${billId}`;
        const billObj = {
            id: `bill-${Date.now()}`,
            billId,
            assetId,
            department: department || '',
            vendor: vendor || '',
            invoiceNumber: invoiceNumber || '',
            amount: parseFloat(amount || 0),
            documentHash: documentHash || '',
            billHash: documentHash || '',
            documentKey: documentKey || '',
            verified: true,
            paymentStatus: paymentStatus || 'Paid',
            createdAt: new Date().toISOString()
        };

        const jsonStr = JSON.stringify(billObj);
        await ctx.stub.putState(billKey, Buffer.from(jsonStr));

        // Update asset's billHash if asset exists
        const assetExists = await this.AssetExists(ctx, assetId);
        if (assetExists) {
            const assetStr = await this.ReadAsset(ctx, assetId);
            const asset = JSON.parse(assetStr);
            asset.billHash = documentHash;
            asset.updatedAt = new Date().toISOString();
            await ctx.stub.putState(assetId, Buffer.from(JSON.stringify(asset)));
        }

        return jsonStr;
    }

    async ReadBill(ctx, billId) {
        const billKey = `BILL_${billId}`;
        let json = await ctx.stub.getState(billKey);
        if (!json || json.length === 0) {
            // fallback lookup by ID
            const allBills = JSON.parse(await this.GetAllBills(ctx));
            const found = allBills.find(b => b.billId === billId || b._id === billId);
            if (found) return JSON.stringify(found);
            throw new Error(`Bill ${billId} does not exist`);
        }
        return json.toString();
    }

    async GetAllBills(ctx) {
        const iterator = await ctx.stub.getStateByRange('BILL_', 'BILL_\uffff');
        const bills = [];

        const res_items = await getAllResults(iterator);
        for (const res of res_items) {
            if (res.value.toString().length > 0) {
                const bill = JSON.parse(res.value.toString());
                if (bill.billId) {
                    bills.push(bill);
                }
            }
        }
        return JSON.stringify(bills);
    }

    async VerifyBill(ctx, billId, expectedHash) {
        console.info(`=== VerifyBill: Verifying bill ${billId} ===`);

        if (!expectedHash) {
            return JSON.stringify({ verified: false, error: 'Expected bill hash is required' });
        }

        // Search asset or bill record
        let storedHash = null;
        const assetExists = await this.AssetExists(ctx, billId);
        if (assetExists) {
            const asset = JSON.parse(await this.ReadAsset(ctx, billId));
            storedHash = asset.billHash;
        } else {
            try {
                const bill = JSON.parse(await this.ReadBill(ctx, billId));
                storedHash = bill.documentHash || bill.billHash;
            } catch (e) {}
        }

        const verified = Boolean(storedHash && expectedHash === storedHash);
        return JSON.stringify({ verified, billId, expectedHash, storedHash: storedHash || null });
    }

    // ==========================================
    // MAINTENANCE FUNCTIONS
    // ==========================================

    async AddMaintenanceRecord(ctx, assetId, technician, maintenanceDate, description, cost, status, department) {
        console.info(`=== AddMaintenanceRecord: Adding maintenance for asset ${assetId} ===`);

        const assetJSON = await ctx.stub.getState(assetId);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Asset ${assetId} does not exist`);
        }

        const asset = JSON.parse(assetJSON.toString());
        const recordId = `MNT-${Date.now()}`;
        
        const maintenanceRecord = {
            id: recordId,
            recordId,
            assetId,
            department: department || asset.department || '',
            technician,
            maintenanceDate,
            description,
            cost: parseFloat(cost),
            status: status || 'Completed',
            createdAt: new Date().toISOString()
        };

        if (!Array.isArray(asset.maintenanceRecords)) {
            asset.maintenanceRecords = [];
        }

        asset.maintenanceRecords.push(maintenanceRecord);
        asset.maintenanceCount = (asset.maintenanceCount || 0) + 1;
        asset.updatedAt = new Date().toISOString();

        await ctx.stub.putState(assetId, Buffer.from(JSON.stringify(asset)));
        await ctx.stub.putState(`MNT_${recordId}`, Buffer.from(JSON.stringify(maintenanceRecord)));

        return JSON.stringify(maintenanceRecord);
    }

    async GetAllMaintenanceRecords(ctx) {
        const iterator = await ctx.stub.getStateByRange('MNT_', 'MNT_\uffff');
        const records = [];

        const res_items = await getAllResults(iterator);
        for (const res of res_items) {
            if (res.value.toString().length > 0) {
                const rec = JSON.parse(res.value.toString());
                if (rec.recordId) records.push(rec);
            }
        }
        return JSON.stringify(records);
    }

    // ==========================================
    // VERIFICATION FUNCTIONS
    // ==========================================

    async CreateEquipmentVerification(ctx, payloadJson) {
        const payload = JSON.parse(payloadJson);
        const recordId = payload.recordId || `EQV-${Date.now()}`;
        const record = {
            ...payload,
            id: recordId,
            recordId,
            createdAt: new Date().toISOString()
        };

        await ctx.stub.putState(`EQV_${recordId}`, Buffer.from(JSON.stringify(record)));
        return JSON.stringify(record);
    }

    async GetAllEquipmentVerifications(ctx) {
        const iterator = await ctx.stub.getStateByRange('EQV_', 'EQV_\uffff');
        const records = [];

        const res_items = await getAllResults(iterator);
        for (const res of res_items) {
            if (res.value.toString().length > 0) {
                const rec = JSON.parse(res.value.toString());
                if (rec.recordId) records.push(rec);
            }
        }
        return JSON.stringify(records);
    }

    async CreateEquipmentCondemnation(ctx, payloadJson) {
        const payload = JSON.parse(payloadJson);
        const recordId = payload.recordId || `EQC-${Date.now()}`;
        const record = {
            ...payload,
            id: recordId,
            recordId,
            createdAt: new Date().toISOString()
        };

        await ctx.stub.putState(`EQC_${recordId}`, Buffer.from(JSON.stringify(record)));
        return JSON.stringify(record);
    }

    async GetAllEquipmentCondemnations(ctx) {
        const iterator = await ctx.stub.getStateByRange('EQC_', 'EQC_\uffff');
        const records = [];

        const res_items = await getAllResults(iterator);
        for (const res of res_items) {
            if (res.value.toString().length > 0) {
                const rec = JSON.parse(res.value.toString());
                if (rec.recordId) records.push(rec);
            }
        }
        return JSON.stringify(records);
    }

    async CreateConsumableVerification(ctx, payloadJson) {
        const payload = JSON.parse(payloadJson);
        const recordId = payload.recordId || `CNV-${Date.now()}`;
        const record = {
            ...payload,
            id: recordId,
            recordId,
            createdAt: new Date().toISOString()
        };

        await ctx.stub.putState(`CNV_${recordId}`, Buffer.from(JSON.stringify(record)));
        return JSON.stringify(record);
    }

    async GetAllConsumableVerifications(ctx) {
        const iterator = await ctx.stub.getStateByRange('CNV_', 'CNV_\uffff');
        const records = [];

        const res_items = await getAllResults(iterator);
        for (const res of res_items) {
            if (res.value.toString().length > 0) {
                const rec = JSON.parse(res.value.toString());
                if (rec.recordId) records.push(rec);
            }
        }
        return JSON.stringify(records);
    }

    async CreateConsumableCondemnation(ctx, payloadJson) {
        const payload = JSON.parse(payloadJson);
        const recordId = payload.recordId || `CNC-${Date.now()}`;
        const record = {
            ...payload,
            id: recordId,
            recordId,
            createdAt: new Date().toISOString()
        };

        await ctx.stub.putState(`CNC_${recordId}`, Buffer.from(JSON.stringify(record)));
        return JSON.stringify(record);
    }

    async GetAllConsumableCondemnations(ctx) {
        const iterator = await ctx.stub.getStateByRange('CNC_', 'CNC_\uffff');
        const records = [];

        const res_items = await getAllResults(iterator);
        for (const res of res_items) {
            if (res.value.toString().length > 0) {
                const rec = JSON.parse(res.value.toString());
                if (rec.recordId) records.push(rec);
            }
        }
        return JSON.stringify(records);
    }

    // ==========================================
    // CONDEMNATION FUNCTIONS
    // ==========================================

    async RequestCondemnation(ctx, assetId, reason, requestedBy, department) {
        console.info(`=== RequestCondemnation: Requesting condemnation for asset ${assetId} ===`);

        const assetJSON = await ctx.stub.getState(assetId);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Asset ${assetId} does not exist`);
        }

        const asset = JSON.parse(assetJSON.toString());
        
        if (asset.status === 'Condemned') {
            throw new Error(`Asset ${assetId} is already condemned`);
        }

        const recordId = `COND-${Date.now()}`;
        const condemnationRecord = {
            id: recordId,
            recordId,
            assetId,
            department: department || asset.department || '',
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
        await ctx.stub.putState(`COND_${recordId}`, Buffer.from(JSON.stringify(condemnationRecord)));

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
        await ctx.stub.putState(`COND_${asset.condemnationRecord.recordId}`, Buffer.from(JSON.stringify(asset.condemnationRecord)));

        return JSON.stringify(asset.condemnationRecord);
    }

    async RejectCondemnation(ctx, assetId, rejectedBy) {
        console.info(`=== RejectCondemnation: Rejecting condemnation for asset ${assetId} ===`);

        const assetJSON = await ctx.stub.getState(assetId);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Asset ${assetId} does not exist`);
        }

        const asset = JSON.parse(assetJSON.toString());
        if (!asset.condemnationRecord || asset.condemnationRecord.status !== 'Pending') {
            throw new Error(`Asset ${assetId} does not have a pending condemnation request`);
        }

        asset.condemnationRecord.status = 'Rejected';
        asset.condemnationRecord.rejectedAt = new Date().toISOString();
        asset.condemnationRecord.rejectedBy = rejectedBy;
        asset.status = 'Active';
        asset.updatedAt = new Date().toISOString();

        await ctx.stub.putState(assetId, Buffer.from(JSON.stringify(asset)));
        await ctx.stub.putState(`COND_${asset.condemnationRecord.recordId}`, Buffer.from(JSON.stringify(asset.condemnationRecord)));

        return JSON.stringify(asset.condemnationRecord);
    }

    async GetAllCondemnationRecords(ctx) {
        const iterator = await ctx.stub.getStateByRange('COND_', 'COND_\uffff');
        const records = [];

        const res_items = await getAllResults(iterator);
        for (const res of res_items) {
            if (res.value.toString().length > 0) {
                const rec = JSON.parse(res.value.toString());
                if (rec.recordId) records.push(rec);
            }
        }
        return JSON.stringify(records);
    }

    // ==========================================
    // ASSET MANAGEMENT FUNCTIONS
    // ==========================================

    async CreateAsset(ctx, assetId, department, category, name, purchaseDate, purchaseValue, location, owner, warrantyExpiry, billHash, status) {
        console.info(`=== CreateAsset: Creating asset ${assetId} ===`);

        const exists = await this.AssetExists(ctx, assetId);
        if (exists) {
            throw new Error(`Asset ${assetId} already exists`);
        }

        const asset = {
            id: `asset-${Date.now()}`,
            assetId,
            department: (department || 'IT').toUpperCase(),
            category: category || 'General',
            name,
            purchaseDate: purchaseDate || new Date().toISOString().split('T')[0],
            purchaseValue: parseFloat(purchaseValue || 0),
            status: status || 'Active',
            location: location || 'Default Location',
            owner: owner || 'Unassigned',
            warrantyExpiry: warrantyExpiry || '',
            billHash: billHash || '',
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

        const allowedFields = ["status", "location", "owner", "billHash", "department", "warrantyExpiry", "category", "name", "description", "purchaseValue"];
        if (!allowedFields.includes(field)) {
            throw new Error(`Field ${field} cannot be updated on the ledger`);
        }

        const assetJSON = await ctx.stub.getState(assetId);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Asset ${assetId} does not exist`);
        }

        const asset = JSON.parse(assetJSON.toString());

        if (field === 'status') {
            const allowedStatuses = ['Active', 'Maintenance', 'Condemned', 'Disposed', 'Retired', 'Condemnation Requested'];
            if (!allowedStatuses.includes(newValue)) {
                throw new Error(`Status ${newValue} is not allowed`);
            }
            if (asset.status === 'Condemned' && newValue === 'Active') {
                throw new Error('Condemned asset cannot return to Active state');
            }
            if (asset.status === 'Disposed') {
                throw new Error('Disposed assets cannot be modified or re-activated');
            }
        }

        asset[field] = field === 'purchaseValue' ? parseFloat(newValue) : newValue;
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

    async GetAssetHistory(ctx, assetId) {
        console.info(`=== GetAssetHistory: Getting history for asset ${assetId} ===`);

        const iterator = await ctx.stub.getHistoryForKey(assetId);
        const allChanges = [];

        const change_items = await getAllResults(iterator);
        for (const change of change_items) {
            let ts = change.timestamp;
            if (ts && typeof ts.toISOString === 'function') {
                ts = ts.toISOString();
            } else if (ts && typeof ts.toString === 'function') {
                ts = ts.toString();
            } else {
                ts = String(ts);
            }
            allChanges.push({
                timestamp: ts,
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
        const assets = allAssets.filter(a => (a.department || '').toUpperCase() === (department || '').toUpperCase());
        return JSON.stringify(assets);
    }

    async QueryAssetsByCategory(ctx, category) {
        console.info(`=== QueryAssetsByCategory: Querying assets for category ${category} ===`);
        const allAssetsStr = await this.GetAllAssets(ctx);
        const allAssets = JSON.parse(allAssetsStr || '[]');
        const assets = allAssets.filter(a => (a.category || '').toLowerCase() === (category || '').toLowerCase());
        return JSON.stringify(assets);
    }

    async QueryAssetsByStatus(ctx, status) {
        console.info(`=== QueryAssetsByStatus: Querying assets with status ${status} ===`);
        const allAssetsStr = await this.GetAllAssets(ctx);
        const allAssets = JSON.parse(allAssetsStr || '[]');
        const assets = allAssets.filter(a => (a.status || '').toLowerCase() === (status || '').toLowerCase());
        return JSON.stringify(assets);
    }

    async GetAllAssets(ctx) {
        console.info('=== GetAllAssets: Getting all assets ===');

        const iterator = await ctx.stub.getStateByRange('', '');
        const assets = [];

        const res_items = await getAllResults(iterator);
        for (const res of res_items) {
            if (res.value.toString().length > 0) {
                // Exclude prefixed metadata keys
                if (res.key.startsWith('USER_') || res.key.startsWith('DEPT_') ||
                    res.key.startsWith('BILL_') || res.key.startsWith('MNT_') ||
                    res.key.startsWith('COND_') || res.key.startsWith('EQV_') ||
                    res.key.startsWith('EQC_') || res.key.startsWith('CNV_') ||
                    res.key.startsWith('CNC_')) {
                    continue;
                }

                try {
                    const asset = JSON.parse(res.value.toString());
                    if (asset.assetId) {
                        assets.push(asset);
                    }
                } catch (e) {}
            }
        }

        return JSON.stringify(assets);
    }

    async GenerateYearlyReport(ctx, year) {
        console.info(`=== GenerateYearlyReport: Generating report for ${year} ===`);

        const allAssets = await this.GetAllAssets(ctx);
        const assets = JSON.parse(allAssets);

        const report = {
            reportId: `REP-${year}-${Date.now()}`,
            year: Number(year),
            totalAssets: assets.length,
            totalPurchaseValue: assets.reduce((sum, a) => sum + (a.purchaseValue || 0), 0),
            categorySummary: {},
            activeAssets: assets.filter(a => a.status === 'Active').length,
            maintenanceAssets: assets.filter(a => (a.maintenanceCount || 0) > 0 || a.status === 'Maintenance').length,
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

    // ==========================================
    // DEPARTMENT VALUATION REPORT
    // ==========================================

    async GetDepartmentValuation(ctx) {
        console.info('=== GetDepartmentValuation: Generating department valuation report ===');

        const allAssetsStr = await this.GetAllAssets(ctx);
        const assets = JSON.parse(allAssetsStr || '[]');
        const allDeptsStr = await this.GetAllDepartments(ctx);
        const departments = JSON.parse(allDeptsStr || '[]');

        const deptSummary = {};

        departments.forEach(dept => {
            const code = dept.code || dept.name;
            const deptAssets = assets.filter(a => (a.department || '').toUpperCase() === (code || '').toUpperCase());
            deptSummary[code] = {
                code: dept.code,
                name: dept.name,
                isActive: dept.isActive !== false,
                manager: dept.manager || '',
                totalAssets: deptAssets.length,
                totalPurchaseValue: deptAssets.reduce((sum, a) => sum + (Number(a.purchaseValue) || 0), 0),
                netBookValue: deptAssets.reduce((sum, a) => sum + (Number(a.purchaseValue) || 0), 0) * 0.7,
                activeAssets: deptAssets.filter(a => a.status === 'Active').length,
                maintenanceAssets: deptAssets.filter(a => a.status === 'Maintenance').length,
                condemnedAssets: deptAssets.filter(a => a.status === 'Condemned').length,
                disposedAssets: deptAssets.filter(a => a.status === 'Disposed' || a.status === 'Retired').length
            };
        });

        return JSON.stringify(deptSummary);
    }

    // ==========================================
    // ASSET LIFECYCLE TRACKING
    // ==========================================

    async AssetLifecycle(ctx, assetId) {
        console.info(`=== AssetLifecycle: Getting lifecycle for asset ${assetId} ===`);

        const assetJSON = await ctx.stub.getState(assetId);
        if (!assetJSON || assetJSON.length === 0) {
            throw new Error(`Asset ${assetId} does not exist`);
        }

        const asset = JSON.parse(assetJSON.toString());

        const lifecycle = [];

        // Creation event
        if (asset.createdAt) {
            lifecycle.push({
                event: 'CREATED',
                timestamp: asset.createdAt,
                status: asset.status || 'Active',
                department: asset.department || '',
                user: asset.owner || '',
                details: `Asset created with purchase value ${asset.purchaseValue || 0}`
            });
        }

        // Maintenance events from embedded records
        (asset.maintenanceRecords || []).forEach((m, idx) => {
            lifecycle.push({
                event: 'MAINTENANCE',
                timestamp: m.createdAt || m.maintenanceDate || asset.createdAt,
                status: m.status || 'Completed',
                department: asset.department || '',
                user: m.technician || '',
                details: m.description || 'Maintenance performed'
            });
        });

        // Condemnation record
        if (asset.condemnationRecord) {
            lifecycle.push({
                event: 'CONDEMNATION_REQUESTED',
                timestamp: asset.condemnationRecord.requestedAt || asset.createdAt,
                status: asset.condemnationRecord.status || 'Pending',
                department: asset.department || '',
                user: asset.condemnationRecord.requestedBy || '',
                details: asset.condemnationRecord.reason || ''
            });
            if (asset.condemnationRecord.approvedAt) {
                lifecycle.push({
                    event: 'CONDEMNATION_APPROVED',
                    timestamp: asset.condemnationRecord.approvedAt,
                    status: 'Approved',
                    department: asset.department || '',
                    user: asset.condemnationRecord.approvedBy || '',
                    details: `Condemnation approved by ${asset.condemnationRecord.approvedBy || 'Admin'}`
                });
            }
            if (asset.condemnationRecord.rejectedAt) {
                lifecycle.push({
                    event: 'CONDEMNATION_REJECTED',
                    timestamp: asset.condemnationRecord.rejectedAt,
                    status: 'Rejected',
                    department: asset.department || '',
                    user: asset.condemnationRecord.rejectedBy || '',
                    details: `Condemnation rejected`
                });
            }
        }

        // History-based events (from ledger history - transfers, status changes)
        const historyIterator = await ctx.stub.getHistoryForKey(assetId);
        const historyItems = [];
        let res = await historyIterator.next();
        while (!res.done) {
            if (res.value && res.value.value.toString()) {
                historyItems.push(res.value);
            }
            res = await historyIterator.next();
        }
        await historyIterator.close();

        let lastDept = null;
        let lastStatus = null;

        for (let i = 0; i < historyItems.length; i++) {
            const item = historyItems[i];
            let ts;
            if (item.timestamp && typeof item.timestamp.toISOString === 'function') {
                ts = item.timestamp.toISOString();
            } else {
                try {
                    const val = JSON.parse(item.value.toString());
                    ts = val.updatedAt || val.createdAt || new Date().toISOString();
                } catch (e) {
                    ts = new Date().toISOString();
                }
            }

            try {
                const val = JSON.parse(item.value.toString());

                // Detect department change (transfer)
                if (val.department && val.department !== lastDept && lastDept !== null) {
                    lifecycle.push({
                        event: 'TRANSFER',
                        timestamp: ts,
                        status: val.status || 'Active',
                        department: val.department,
                        user: val.owner || '',
                        details: `Asset transferred from ${lastDept} to ${val.department}`
                    });
                }

                // Detect status change
                if (val.status && val.status !== lastStatus && lastStatus !== null) {
                    const significantStatuses = ['Active', 'Maintenance', 'Condemned', 'Disposed', 'Condemnation Requested'];
                    if (significantStatuses.includes(val.status)) {
                        lifecycle.push({
                            event: 'STATUS_CHANGE',
                            timestamp: ts,
                            status: val.status,
                            department: val.department || '',
                            user: val.owner || '',
                            details: `Status changed from ${lastStatus} to ${val.status}`
                        });
                    }
                }

                if (val.department) lastDept = val.department;
                if (val.status) lastStatus = val.status;
            } catch (e) {}
        }

        // Sort by timestamp
        lifecycle.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        return JSON.stringify({
            assetId,
            asset: {
                assetId: asset.assetId,
                name: asset.name,
                department: asset.department,
                category: asset.category,
                purchaseValue: asset.purchaseValue,
                purchaseDate: asset.purchaseDate,
                warrantyExpiry: asset.warrantyExpiry,
                location: asset.location,
                owner: asset.owner,
                status: asset.status
            },
            lifecycle
        });
    }

    // ==========================================
    // BULK ASSET OPERATIONS
    // ==========================================

    async BulkImportAssets(ctx, assetsJson) {
        console.info('=== BulkImportAssets: Importing multiple assets ===');

        const assets = JSON.parse(assetsJson);
        if (!Array.isArray(assets)) {
            throw new Error('Assets must be an array');
        }

        const results = [];
        let successCount = 0;
        let errorCount = 0;

        for (const asset of assets) {
            try {
                const assetId = asset.assetId;
                if (!assetId) {
                    results.push({ success: false, error: 'Asset missing assetId', asset });
                    errorCount++;
                    continue;
                }

                const exists = await this.AssetExists(ctx, assetId);
                if (exists) {
                    results.push({ success: false, assetId, error: 'Asset already exists' });
                    errorCount++;
                    continue;
                }

                const assetObj = {
                    id: `asset-${Date.now()}-${successCount}`,
                    assetId,
                    department: (asset.department || 'IT').toUpperCase(),
                    category: asset.category || 'General',
                    name: asset.name || '',
                    purchaseDate: asset.purchaseDate || new Date().toISOString().split('T')[0],
                    purchaseValue: parseFloat(asset.purchaseValue || 0),
                    status: asset.status || 'Active',
                    location: asset.location || 'Default Location',
                    owner: asset.owner || 'Unassigned',
                    warrantyExpiry: asset.warrantyExpiry || '',
                    billHash: asset.billHash || '',
                    maintenanceRecords: [],
                    maintenanceCount: 0,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                await ctx.stub.putState(assetId, Buffer.from(JSON.stringify(assetObj)));
                results.push({ success: true, assetId, asset: assetObj });
                successCount++;
            } catch (e) {
                results.push({ success: false, error: e.message, assetId: asset.assetId });
                errorCount++;
            }
        }

        return JSON.stringify({
            imported: successCount,
            failed: errorCount,
            total: assets.length,
            results
        });
    }

    async BulkTransferAssets(ctx, assetIdsJson, toDepartment) {
        console.info(`=== BulkTransferAssets: Transferring assets to ${toDepartment} ===`);

        const assetIds = JSON.parse(assetIdsJson);
        const dept = (toDepartment || 'IT').toUpperCase();
        const results = [];

        for (const assetId of assetIds) {
            try {
                const assetJSON = await ctx.stub.getState(assetId);
                if (!assetJSON || assetJSON.length === 0) {
                    results.push({ assetId, success: false, error: 'Asset not found' });
                    continue;
                }

                const asset = JSON.parse(assetJSON.toString());
                if (['Condemned', 'Disposed', 'Retired'].includes(asset.status)) {
                    results.push({ assetId, success: false, error: `Cannot transfer asset in ${asset.status} state` });
                    continue;
                }

                asset.department = dept;
                asset.updatedAt = new Date().toISOString();
                await ctx.stub.putState(assetId, Buffer.from(JSON.stringify(asset)));
                results.push({ assetId, success: true, fromDepartment: asset.department, toDepartment: dept });
            } catch (e) {
                results.push({ assetId, success: false, error: e.message });
            }
        }

        return JSON.stringify({
            updated: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            total: assetIds.length,
            results
        });
    }

    // ==========================================
    // AUDIT TRAIL
    // ==========================================

    async GetAuditTrail(ctx, assetId) {
        console.info(`=== GetAuditTrail: Getting audit trail for ${assetId} ===`);

        const iterator = await ctx.stub.getHistoryForKey(assetId);
        const allEvents = [];

        let res = await iterator.next();
        while (!res.done) {
            if (res.value && res.value.value.toString()) {
                let ts;
                if (res.value.timestamp && typeof res.value.timestamp.toISOString === 'function') {
                    ts = res.value.timestamp.toISOString();
                } else {
                    try {
                        const val = JSON.parse(res.value.value.toString());
                        ts = val.updatedAt || val.createdAt || new Date().toISOString();
                    } catch (e) {
                        ts = new Date().toISOString();
                    }
                }

                let parsedValue = null;
                let eventName = 'UPDATE';
                try {
                    parsedValue = JSON.parse(res.value.value.toString());
                } catch (e) {
                    parsedValue = res.value.value.toString();
                }

                if (res.value.isDelete) {
                    eventName = 'DELETE';
                } else {
                    eventName = allEvents.length === 0 ? 'CREATE' : 'UPDATE';
                }

                allEvents.push({
                    eventId: res.value.txId || `event-${allEvents.length}`,
                    eventType: eventName,
                    timestamp: ts,
                    txId: res.value.txId,
                    isDelete: res.value.isDelete,
                    value: parsedValue
                });
            }
            res = await iterator.next();
        }
        await iterator.close();

        return JSON.stringify({
            assetId,
            events: allEvents
        });
    }

    // ==========================================
    // USER MANAGEMENT (extended)
    // ==========================================

    async UpdateUserRole(ctx, emailOrId, newRole, department) {
        console.info(`=== UpdateUserRole: Setting role ${newRole} for user ${emailOrId} ===`);

        const existingStr = await this.ReadUser(ctx, emailOrId);
        const user = JSON.parse(existingStr);
        user.role = newRole;
        if (department) {
            user.department = String(department).toUpperCase().trim();
        }
        user.updatedAt = new Date().toISOString();

        const jsonStr = JSON.stringify(user);
        const emailKey = `USER_${user.email.toLowerCase().trim()}`;
        const idKey = `USER_ID_${user._id || user.userId}`;
        await ctx.stub.putState(emailKey, Buffer.from(jsonStr));
        await ctx.stub.putState(idKey, Buffer.from(jsonStr));

        return jsonStr;
    }

    async UpdateUserDepartment(ctx, emailOrId, newDepartment) {
        console.info(`=== UpdateUserDepartment: Setting department ${newDepartment} for user ${emailOrId} ===`);

        const existingStr = await this.ReadUser(ctx, emailOrId);
        const user = JSON.parse(existingStr);
        user.department = String(newDepartment || user.department || 'IT').toUpperCase().trim();
        user.updatedAt = new Date().toISOString();

        const jsonStr = JSON.stringify(user);
        const emailKey = `USER_${user.email.toLowerCase().trim()}`;
        const idKey = `USER_ID_${user._id || user.userId}`;
        await ctx.stub.putState(emailKey, Buffer.from(jsonStr));
        await ctx.stub.putState(idKey, Buffer.from(jsonStr));

        return jsonStr;
    }
}

module.exports = AssetManagementContract;

if (require.main === module) {
    const { Shim } = require('fabric-shim');
    Shim.start(new AssetManagementContract());
}