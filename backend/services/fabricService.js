const { Gateway, Wallets } = require("fabric-network");
const path = require("path");
const fs = require("fs");

const ccpPath = path.resolve(
  __dirname,
  "../../network/connections/connection-org1.json"
);

function getCCP() {
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
}

async function getGateway() {
  const walletPath = path.join(__dirname, "../../network/wallet");
  const wallet = await Wallets.newFileSystemWallet(walletPath);
  const ccp = getCCP();

  const identityName = process.env.FABRIC_IDENTITY || "appUser";
  const identityExists = await wallet.get(identityName);
  
  const selectedIdentity = identityExists ? identityName : "appUser";

  const fabricHost = process.env.FABRIC_HOST || "localhost";
  const isLocalhost = fabricHost === "localhost" && process.env.FABRIC_NETWORK_MODE !== "REMOTE";
  const asLocalhost = process.env.FABRIC_DISCOVERY_AS_LOCALHOST !== undefined 
    ? process.env.FABRIC_DISCOVERY_AS_LOCALHOST === "true"
    : isLocalhost;
  const discoveryEnabled = process.env.FABRIC_DISCOVERY_ENABLED === "true";

  const gateway = new Gateway();
  await gateway.connect(ccp, {
    wallet,
    identity: selectedIdentity,
    discovery: { enabled: discoveryEnabled, asLocalhost }
  });

  return gateway;
}

async function createAssetOnFabric(assetData) {
  const gateway = await getGateway();
  try {
    const network = await gateway.getNetwork("assets");
    const contract = network.getContract("asset-management");
    const tx = contract.createTransaction("CreateAsset");
    const result = await tx.submit(
      String(assetData.assetId || ""),
      String(assetData.department || ""),
      String(assetData.category || ""),
      String(assetData.name || ""),
      String(assetData.purchaseDate || ""),
      String(assetData.purchaseValue || 0),
      String(assetData.location || ""),
      String(assetData.owner || ""),
      String(assetData.warrantyExpiry || ""),
      String(assetData.billHash || "")
    );

    return {
      success: true,
      transactionId: tx.getTransactionId(),
      result: (result && result.length > 0) ? JSON.parse(result.toString()) : { assetId: assetData.assetId }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  } finally {
    gateway.disconnect();
  }
}

async function updateAssetOnFabric(assetId, updateData) {
  const gateway = await getGateway();
  try {
    const network = await gateway.getNetwork("assets");
    const contract = network.getContract("asset-management");

    // Use UpdateAsset(assetId, field, newValue)
    const field = updateData.field || 'status';
    const newValue = updateData.newValue || (updateData.status || 'Active');
    const tx = contract.createTransaction('UpdateAsset');
    const result = await tx.submit(assetId, field, String(newValue));

    return {
      success: true,
      transactionId: tx.getTransactionId(),
      result: JSON.parse(result.toString())
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  } finally {
    gateway.disconnect();
  }
}

async function addMaintenanceOnFabric(assetId, maintenanceData) {
  const gateway = await getGateway();
  try {
    const network = await gateway.getNetwork("assets");
    const contract = network.getContract("asset-management");
    const tx = contract.createTransaction('AddMaintenanceRecord');
    const result = await tx.submit(
      assetId,
      maintenanceData.technician,
      maintenanceData.maintenanceDate,
      maintenanceData.description,
      String(maintenanceData.cost),
      maintenanceData.status || 'Completed'
    );

    return {
      success: true,
      transactionId: tx.getTransactionId(),
      result: JSON.parse(result.toString())
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  } finally {
    gateway.disconnect();
  }
}

async function requestCondemnationOnFabric(assetId, reason, requestedBy) {
  const gateway = await getGateway();
  try {
    const network = await gateway.getNetwork("assets");
    const contract = network.getContract("asset-management");
    const tx = contract.createTransaction('RequestCondemnation');
    const result = await tx.submit(assetId, reason, requestedBy);
    return {
      success: true,
      transactionId: tx.getTransactionId(),
      result: JSON.parse(result.toString())
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  } finally {
    gateway.disconnect();
  }
}

async function approveCondemnationOnFabric(assetId, approvedBy) {
  const gateway = await getGateway();
  try {
    const network = await gateway.getNetwork("assets");
    const contract = network.getContract("asset-management");
    const tx = contract.createTransaction('ApproveCondemnation');
    const result = await tx.submit(assetId, approvedBy);
    return {
      success: true,
      transactionId: tx.getTransactionId(),
      result: JSON.parse(result.toString())
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  } finally {
    gateway.disconnect();
  }
}

async function generateYearlyReportOnFabric(year) {
  const gateway = await getGateway();
  try {
    const network = await gateway.getNetwork("assets");
    const contract = network.getContract("asset-management");
    const tx = contract.createTransaction('GenerateYearlyReport');
    const result = await tx.submit(String(year));
    return {
      success: true,
      transactionId: tx.getTransactionId(),
      result: JSON.parse(result.toString())
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  } finally {
    gateway.disconnect();
  }
}

async function verifyBillOnFabric(billId, expectedHash) {
  const gateway = await getGateway();
  try {
    const network = await gateway.getNetwork("assets");
    const contract = network.getContract("asset-management");

    // Chaincode exposes VerifyBill (case-sensitive)
    const result = await contract.evaluateTransaction(
      "VerifyBill",
      billId,
      expectedHash
    );

    return JSON.parse(result.toString());
  } catch (error) {
    return { verified: false, error: error.message };
  } finally {
    try { gateway.disconnect(); } catch (e) { /* ignore */ }
  }
}

module.exports = {
  createAssetOnFabric,
  updateAssetOnFabric,
  addMaintenanceOnFabric,
  requestCondemnationOnFabric,
  approveCondemnationOnFabric,
  generateYearlyReportOnFabric,
  verifyBillOnFabric,
  // Read helpers
  readAssetFromFabric: async function(assetId) {
    const gateway = await getGateway();
    try {
      const network = await gateway.getNetwork("assets");
      const contract = network.getContract("asset-management");
      const result = await contract.evaluateTransaction('ReadAsset', String(assetId));
      return { success: true, asset: JSON.parse(result.toString()) };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      try { gateway.disconnect(); } catch (e) {}
    }
  },
  getAllAssetsFromFabric: async function() {
    const gateway = await getGateway();
    try {
      const network = await gateway.getNetwork("assets");
      const contract = network.getContract("asset-management");
      const result = await contract.evaluateTransaction('GetAllAssets');
      return { success: true, assets: JSON.parse(result.toString()) };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      try { gateway.disconnect(); } catch (e) {}
    }
  },
  getAssetHistoryFromFabric: async function(assetId) {
    const gateway = await getGateway();
    try {
      const network = await gateway.getNetwork("assets");
      const contract = network.getContract("asset-management");
      const result = await contract.evaluateTransaction('GetAssetHistory', String(assetId));
      return { success: true, history: JSON.parse(result.toString()) };
    } catch (error) {
      return { success: false, error: error.message };
    } finally {
      try { gateway.disconnect(); } catch (e) {}
    }
  }
};