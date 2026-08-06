const { Gateway, Wallets } = require("fabric-network");
const path = require("path");
const fs = require("fs");
const AssetManagementContract = require("../../chaincode/lib/asset-management");

// Instantiate chaincode contract engine for local/fallback execution
const contractEngine = new AssetManagementContract();

// In-Memory Fabric Ledger Stub (World State & Transaction History)
class FabricLedgerStub {
    constructor() {
        this.worldState = new Map();
        this.history = new Map();
    }

    async putState(key, value) {
        const valBuffer = Buffer.isBuffer(value) ? value : Buffer.from(value);
        this.worldState.set(key, valBuffer);

        if (!this.history.has(key)) {
            this.history.set(key, []);
        }
        this.history.get(key).push({
            timestamp: new Date().toISOString(),
            isDelete: false,
            value: valBuffer
        });
    }

    async getState(key) {
        return this.worldState.get(key) || null;
    }

    async delState(key) {
        this.worldState.delete(key);
        if (!this.history.has(key)) {
            this.history.set(key, []);
        }
        this.history.get(key).push({
            timestamp: new Date().toISOString(),
            isDelete: true,
            value: Buffer.from('')
        });
    }

    async *getStateByRange(startKey, endKey) {
        const keys = Array.from(this.worldState.keys()).sort();
        for (const k of keys) {
            if (startKey && k < startKey) continue;
            if (endKey && endKey !== '\uffff' && k > endKey) continue;
            yield {
                key: k,
                value: this.worldState.get(k)
            };
        }
    }

    async *getHistoryForKey(key) {
        const items = this.history.get(key) || [];
        for (const item of items) {
            yield item;
        }
    }
}

const localLedgerStub = new FabricLedgerStub();
const localCtx = { stub: localLedgerStub };

// Initialize default ledger data in fallback state
let isLedgerInitialized = false;
async function ensureLocalLedgerInitialized() {
    if (!isLedgerInitialized) {
        try {
            await contractEngine.InitLedger(localCtx);
            isLedgerInitialized = true;
        } catch (e) {
            console.warn('Failed to init local ledger:', e.message);
        }
    }
}
ensureLocalLedgerInitialized();

// Helper to execute chaincode function locally via ledger stub
async function executeChaincodeLocal(fnName, ...args) {
    await ensureLocalLedgerInitialized();
    if (typeof contractEngine[fnName] !== 'function') {
        throw new Error(`Chaincode method ${fnName} not found`);
    }
    const res = await contractEngine[fnName](localCtx, ...args);
    return res !== undefined ? res : null;
}

const ccpPath = path.resolve(__dirname, "../../network/connections/connection-org1.json");

function getCCP() {
    if (!fs.existsSync(ccpPath)) return null;
    try {
        const ccpRaw = fs.readFileSync(ccpPath, "utf8");
        let ccp = JSON.parse(ccpRaw);
        const fabricHost = process.env.FABRIC_HOST || "localhost";
        const peerPort = process.env.FABRIC_PEER_PORT || "7051";
        const ordererPort = process.env.FABRIC_ORDERER_PORT || "7050";

        if (fabricHost !== "localhost" || process.env.FABRIC_NETWORK_MODE === "REMOTE") {
            const rawString = JSON.stringify(ccp);
            const updatedString = rawString
                .replace(/localhost:7051/g, `${fabricHost}:${peerPort}`)
                .replace(/localhost:7050/g, `${fabricHost}:${ordererPort}`);
            ccp = JSON.parse(updatedString);
        }
        return ccp;
    } catch (e) {
        return null;
    }
}

async function getGateway() {
    const ccp = getCCP();
    if (!ccp) return null;

    const walletPath = path.join(__dirname, "../../network/wallet");
    if (!fs.existsSync(walletPath)) return null;

    const wallet = await Wallets.newFileSystemWallet(walletPath);
    const identityName = process.env.FABRIC_IDENTITY || "appUser";
    const identityExists = await wallet.get(identityName);
    if (!identityExists) return null;

    const fabricHost = process.env.FABRIC_HOST || "localhost";
    const isLocalhost = fabricHost === "localhost" && process.env.FABRIC_NETWORK_MODE !== "REMOTE";
    const asLocalhost = process.env.FABRIC_DISCOVERY_AS_LOCALHOST !== undefined
        ? process.env.FABRIC_DISCOVERY_AS_LOCALHOST === "true"
        : isLocalhost;

    const gateway = new Gateway();
    await gateway.connect(ccp, {
        wallet,
        identity: identityName,
        discovery: { enabled: process.env.FABRIC_DISCOVERY_ENABLED === "true", asLocalhost }
    });

    return gateway;
}

// Low-level helper to execute Fabric transactions (or fallback to local chaincode engine)
async function invokeChaincode(fnName, args = [], isQuery = false) {
    const isSDKEnabled = process.env.ENABLE_FABRIC_SDK === "true";
    let gateway;
    if (isSDKEnabled) {
        try {
            gateway = await getGateway();
            if (gateway) {
                const network = await gateway.getNetwork("assets");
                const contract = network.getContract("asset-management");
                let result;
                let txId = `tx-${Date.now()}`;

                if (isQuery) {
                    result = await contract.evaluateTransaction(fnName, ...args.map(String));
                } else {
                    const tx = contract.createTransaction(fnName);
                    result = await tx.submit(...args.map(String));
                    txId = tx.getTransactionId();
                }

                const rawStr = result ? result.toString() : '';
                let parsed = rawStr;
                try { parsed = JSON.parse(rawStr); } catch (e) {}
                return { success: true, transactionId: txId, result: parsed };
            }
        } catch (err) {
            // Fallback to local chaincode engine
        } finally {
            if (gateway) { try { gateway.disconnect(); } catch (e) {} }
        }
    }

    try {
        const rawRes = await executeChaincodeLocal(fnName, ...args.map(String));
        let parsed = rawRes;
        try { parsed = JSON.parse(rawRes); } catch (e) {}
        return {
            success: true,
            transactionId: `tx-local-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            result: parsed
        };
    } catch (localErr) {
        return { success: false, error: localErr.message };
    }
}

// Exported Fabric Ledger API Wrappers
module.exports = {
    // ASSET API
    createAssetOnFabric: async function(assetData) {
        const res = await invokeChaincode("CreateAsset", [
            assetData.assetId || "",
            assetData.department || "",
            assetData.category || "",
            assetData.name || "",
            assetData.purchaseDate || "",
            assetData.purchaseValue || 0,
            assetData.location || "",
            assetData.owner || "",
            assetData.warrantyExpiry || "",
            assetData.billHash || "",
            assetData.status || "Active"
        ]);
        return res;
    },

    updateAssetOnFabric: async function(assetId, updateData) {
        const field = updateData.field || 'status';
        const newValue = updateData.newValue || updateData.status || 'Active';
        return await invokeChaincode("UpdateAsset", [assetId, field, newValue]);
    },

    readAssetFromFabric: async function(assetId) {
        const res = await invokeChaincode("ReadAsset", [assetId], true);
        if (res.success) {
            return { success: true, asset: res.result };
        }
        return res;
    },

    getAllAssetsFromFabric: async function() {
        const res = await invokeChaincode("GetAllAssets", [], true);
        if (res.success) {
            return { success: true, assets: Array.isArray(res.result) ? res.result : [] };
        }
        return { success: false, assets: [], error: res.error };
    },

    getAssetHistoryFromFabric: async function(assetId) {
        const res = await invokeChaincode("GetAssetHistory", [assetId], true);
        if (res.success) {
            return { success: true, history: Array.isArray(res.result) ? res.result : [] };
        }
        return res;
    },

    deleteAssetFromFabric: async function(assetId) {
        return await invokeChaincode("DeleteAsset", [assetId]);
    },

    // USER API
    createUserOnFabric: async function(userData) {
        return await invokeChaincode("CreateUser", [
            userData.userId || `usr-${Date.now()}`,
            userData.name || "",
            userData.email || "",
            userData.password || "",
            userData.role || "DepartmentUser",
            userData.department || "IT",
            userData.departmentName || userData.department || "IT",
            userData.status || (userData.isApproved ? "Active" : "PendingApproval"),
            String(Boolean(userData.isApproved))
        ]);
    },

    readUserFromFabric: async function(emailOrId) {
        const res = await invokeChaincode("ReadUser", [emailOrId], true);
        if (res.success) {
            return { success: true, user: res.result };
        }
        return res;
    },

    updateUserOnFabric: async function(emailOrId, updates) {
        return await invokeChaincode("UpdateUser", [emailOrId, JSON.stringify(updates)]);
    },

    getAllUsersFromFabric: async function() {
        const res = await invokeChaincode("GetAllUsers", [], true);
        if (res.success) {
            return { success: true, users: Array.isArray(res.result) ? res.result : [] };
        }
        return { success: false, users: [], error: res.error };
    },

    // DEPARTMENT API
    createDepartmentOnFabric: async function(deptData) {
        return await invokeChaincode("CreateDepartment", [
            deptData.code || "",
            deptData.name || "",
            deptData.description || "",
            deptData.manager || "Admin"
        ]);
    },

    readDepartmentFromFabric: async function(code) {
        const res = await invokeChaincode("ReadDepartment", [code], true);
        if (res.success) {
            return { success: true, department: res.result };
        }
        return res;
    },

    updateDepartmentOnFabric: async function(code, updates) {
        return await invokeChaincode("UpdateDepartment", [code, JSON.stringify(updates)]);
    },

    getAllDepartmentsFromFabric: async function() {
        const res = await invokeChaincode("GetAllDepartments", [], true);
        if (res.success) {
            return { success: true, departments: Array.isArray(res.result) ? res.result : [] };
        }
        return { success: false, departments: [], error: res.error };
    },

    // BILL API
    createBillOnFabric: async function(billData) {
        return await invokeChaincode("CreateBill", [
            billData.billId || `BILL-${Date.now()}`,
            billData.assetId || "",
            billData.vendor || "",
            billData.invoiceNumber || "",
            billData.amount || 0,
            billData.documentHash || billData.billHash || "",
            billData.paymentStatus || "Paid"
        ]);
    },

    readBillFromFabric: async function(billId) {
        const res = await invokeChaincode("ReadBill", [billId], true);
        if (res.success) {
            return { success: true, bill: res.result };
        }
        return res;
    },

    getAllBillsFromFabric: async function() {
        const res = await invokeChaincode("GetAllBills", [], true);
        if (res.success) {
            return { success: true, bills: Array.isArray(res.result) ? res.result : [] };
        }
        return { success: false, bills: [], error: res.error };
    },

    verifyBillOnFabric: async function(billId, expectedHash) {
        const res = await invokeChaincode("VerifyBill", [billId, expectedHash], true);
        return res.success ? res.result : { verified: false, error: res.error };
    },

    // MAINTENANCE API
    addMaintenanceOnFabric: async function(assetId, maintenanceData) {
        return await invokeChaincode("AddMaintenanceRecord", [
            assetId,
            maintenanceData.technician || "",
            maintenanceData.maintenanceDate || new Date().toISOString().split('T')[0],
            maintenanceData.description || "",
            maintenanceData.cost || 0,
            maintenanceData.status || "Completed"
        ]);
    },

    getAllMaintenanceRecordsFromFabric: async function() {
        const res = await invokeChaincode("GetAllMaintenanceRecords", [], true);
        if (res.success) {
            return { success: true, records: Array.isArray(res.result) ? res.result : [] };
        }
        return { success: false, records: [], error: res.error };
    },

    // CONDEMNATION API
    requestCondemnationOnFabric: async function(assetId, reason, requestedBy) {
        return await invokeChaincode("RequestCondemnation", [assetId, reason || "", requestedBy || "User"]);
    },

    approveCondemnationOnFabric: async function(assetId, approvedBy) {
        return await invokeChaincode("ApproveCondemnation", [assetId, approvedBy || "Admin"]);
    },

    rejectCondemnationOnFabric: async function(assetId, rejectedBy) {
        return await invokeChaincode("RejectCondemnation", [assetId, rejectedBy || "Admin"]);
    },

    getAllCondemnationRecordsFromFabric: async function() {
        const res = await invokeChaincode("GetAllCondemnationRecords", [], true);
        if (res.success) {
            return { success: true, records: Array.isArray(res.result) ? res.result : [] };
        }
        return { success: false, records: [], error: res.error };
    },

    // VERIFICATION API
    createEquipmentVerificationOnFabric: async function(payload) {
        return await invokeChaincode("CreateEquipmentVerification", [JSON.stringify(payload)]);
    },

    getAllEquipmentVerificationsFromFabric: async function() {
        const res = await invokeChaincode("GetAllEquipmentVerifications", [], true);
        if (res.success) {
            return { success: true, records: Array.isArray(res.result) ? res.result : [] };
        }
        return { success: false, records: [], error: res.error };
    },

    createEquipmentCondemnationOnFabric: async function(payload) {
        return await invokeChaincode("CreateEquipmentCondemnation", [JSON.stringify(payload)]);
    },

    getAllEquipmentCondemnationsFromFabric: async function() {
        const res = await invokeChaincode("GetAllEquipmentCondemnations", [], true);
        if (res.success) {
            return { success: true, records: Array.isArray(res.result) ? res.result : [] };
        }
        return { success: false, records: [], error: res.error };
    },

    createConsumableVerificationOnFabric: async function(payload) {
        return await invokeChaincode("CreateConsumableVerification", [JSON.stringify(payload)]);
    },

    getAllConsumableVerificationsFromFabric: async function() {
        const res = await invokeChaincode("GetAllConsumableVerifications", [], true);
        if (res.success) {
            return { success: true, records: Array.isArray(res.result) ? res.result : [] };
        }
        return { success: false, records: [], error: res.error };
    },

    createConsumableCondemnationOnFabric: async function(payload) {
        return await invokeChaincode("CreateConsumableCondemnation", [JSON.stringify(payload)]);
    },

    getAllConsumableCondemnationsFromFabric: async function() {
        const res = await invokeChaincode("GetAllConsumableCondemnations", [], true);
        if (res.success) {
            return { success: true, records: Array.isArray(res.result) ? res.result : [] };
        }
        return { success: false, records: [], error: res.error };
    },

    // REPORT API
    generateYearlyReportOnFabric: async function(year) {
        const res = await invokeChaincode("GenerateYearlyReport", [year]);
        if (res.success) {
            return { success: true, result: res.result };
        }
        return res;
    }
};