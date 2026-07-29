const { Gateway, Wallets } = require("fabric-network");
const path = require("path");
const fs = require("fs");

const ccpPath = path.resolve(
  __dirname,
  "../../network/connections/connection-org1.json"
);
const ccp = JSON.parse(fs.readFileSync(ccpPath, "utf8"));

async function getGateway() {
  const walletPath = path.join(__dirname, "../../network/wallet");
  const wallet = await Wallets.newFileSystemWallet(walletPath);

  const gateway = new Gateway();
  await gateway.connect(ccp, {
    wallet,
    identity: "appUser",
    discovery: { enabled: true, asLocalhost: true }
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
      assetData.assetId,
      assetData.department,
      assetData.category,
      assetData.name,
      assetData.purchaseDate,
      String(assetData.purchaseValue),
      assetData.location,
      assetData.owner,
      assetData.warrantyExpiry || "",
      assetData.billHash || ""
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
  verifyBillOnFabric
};