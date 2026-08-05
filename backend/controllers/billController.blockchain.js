const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { updateAssetOnFabric, verifyBillOnFabric } = require('../services/fabricService');

async function uploadBill(req, res, next) {
  try {
    let { billId, assetId, documentHash } = req.body || {};

    // If a multipart file was uploaded, compute its SHA256 hash and persist the file to uploads
    if (req.file) {
      const uploadDir = path.join(__dirname, "../../uploads/bills");
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

      const tmpPath = req.file.path;
      const destPath = path.join(uploadDir, req.file.filename);
      try {
        fs.renameSync(tmpPath, destPath);
      } catch (e) {
        // fallback: copy then unlink
        fs.copyFileSync(tmpPath, destPath);
        try { fs.unlinkSync(tmpPath); } catch (e2) {}
      }

      const buf = fs.readFileSync(destPath);
      documentHash = crypto.createHash('sha256').update(buf).digest('hex');
      billId = billId || `BILL-${Date.now()}`;
    }

    if (!assetId || !documentHash) {
      return res.status(400).json({ ok: false, error: 'assetId and documentHash are required' });
    }

    // Write bill hash to ledger under the asset (primary source)
    const fabricResult = await updateAssetOnFabric(assetId, { field: 'billHash', newValue: documentHash }).catch(e => ({ success: false, error: e.message }));
    if (!fabricResult || !fabricResult.success) {
      return res.status(500).json({ ok: false, error: 'Failed to write bill hash to ledger', detail: fabricResult });
    }

    // Return a ledger-centric bill representation (not persisted off-chain by default)
    const bill = {
      billId: billId || `BILL-${Date.now()}`,
      assetId,
      documentHash,
      blockchainTx: fabricResult.transactionId
    };

    res.status(201).json({ ok: true, data: bill, blockchain: fabricResult });
  } catch (err) {
    next(err);
  }
}

async function verifyBill(req, res, next) {
  try {
    const { billId, documentHash } = req.body || {};
    if (!billId || !documentHash) {
      return res.status(400).json({ ok: false, error: 'billId and documentHash are required' });
    }

    // In our chaincode, verification is performed against the asset's stored billHash.
    // The caller should provide the assetId as billId or the bill record should be looked up off-chain.
    const fabricKey = req.body.assetId || billId;
    const result = await verifyBillOnFabric(fabricKey, documentHash).catch(e => ({ verified: false, error: e.message }));

    res.json({ ok: true, data: { billId, verified: !!result.verified, blockchain: result } });
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadBill, verifyBill };
