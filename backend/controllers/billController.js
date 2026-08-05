const Bill = require("../models/Bill");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { verifyBillOnFabric } = require("../services/fabricService");
const { updateAssetOnFabric } = require("../services/fabricService");

async function uploadBill(req, res, next) {
  try {
    console.log('uploadBill incoming content-type:', req.headers['content-type']);
    console.log('uploadBill parsed body keys:', Object.keys(req.body || {}));
    console.log('uploadBill file present:', !!req.file);
    const { billId, assetId, vendor, invoiceNumber, invoiceDate, amount, 
            taxAmount, totalAmount, currency, paymentDueDate } = req.body;

    if (billId) {
      const existing = await Bill.findOne({ billId });
      if (existing) {
        return res.status(409).json({ ok: false, error: "Bill ID already exists" });
      }
    }

    if (req.file) {
      const uploadDir = path.join(__dirname, "../../../uploads/bills");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const documentPath = path.join(uploadDir, req.file.filename);
      const documentHash = crypto.createHash("sha256").update(fs.readFileSync(req.file.path)).digest("hex");

      const bill = await Bill.create({
        billId, assetId, vendor, invoiceNumber, invoiceDate, amount,
        taxAmount, totalAmount, currency, paymentDueDate,
        documentPath: documentPath, documentHash, billHash: documentHash
      });

      // If an assetId was provided, push the bill hash to the ledger under the asset
      if (assetId && documentHash) {
        try {
          const fabricResult = await updateAssetOnFabric(assetId, { field: 'billHash', newValue: documentHash });
          if (fabricResult && fabricResult.success && fabricResult.transactionId) {
            bill.blockchainTxHash = fabricResult.transactionId;
            await bill.save();
          }
        } catch (e) {
          console.warn('Failed to write billHash to ledger:', e.message || e);
        }
      }

      res.status(201).json({
        ok: true,
        data: bill
      });
    } else {
      const docHash = req.body.documentHash || req.body.billHash || null;
      const bill = await Bill.create({
        billId, assetId, vendor, invoiceNumber, invoiceDate, amount,
        taxAmount, totalAmount, currency, paymentDueDate,
        documentHash: docHash, billHash: docHash
      });

      if (assetId && docHash) {
        try {
          const fabricResult = await updateAssetOnFabric(assetId, { field: 'billHash', newValue: docHash });
          if (fabricResult && fabricResult.success && fabricResult.transactionId) {
            bill.blockchainTxHash = fabricResult.transactionId;
            await bill.save();
          }
        } catch (e) {
          console.warn('Failed to write billHash to ledger:', e.message || e);
        }
      }

      res.status(201).json({
        ok: true,
        data: bill
      });
    }
  } catch (error) {
    next(error);
  }
}

async function getBills(req, res, next) {
  try {
    const { assetId, paymentStatus, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (assetId) filter.assetId = assetId;
    if (paymentStatus) filter.paymentStatus = paymentStatus;

    const skip = (page - 1) * limit;
    const bills = await Bill.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await Bill.countDocuments(filter);

    res.json({
      ok: true,
      data: bills,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getBill(req, res, next) {
  try {
    const bill = await Bill.findOne({ billId: req.params.billId });
    if (!bill) {
      return res.status(404).json({ ok: false, error: "Bill not found" });
    }
    res.json({
      ok: true,
      data: bill
    });
  } catch (error) {
    next(error);
  }
}

async function verifyBill(req, res, next) {
  try {
    const { billId, documentHash } = req.body;

    const bill = await Bill.findOne({ billId });
    if (!bill) {
      return res.status(404).json({ ok: false, error: "Bill not found" });
    }

    let verified = false;
    let verifiedOnBlockchain = false;
    let blockchain = null;
    let statusLabel = "DOCUMENT MODIFIED / INVALID";

    if (!bill.documentHash) {
      statusLabel = "NO RECORDED BILL HASH";
    } else if (!documentHash) {
      statusLabel = "DOCUMENT HASH REQUIRED";
    } else {
      verified = documentHash === bill.documentHash;
    }

    if (!bill.assetId) {
      return res.status(400).json({ ok: false, error: "Bill must be linked to an asset for blockchain verification" });
    }

    const fabricKey = bill.assetId;
    try {
      blockchain = await verifyBillOnFabric(fabricKey, documentHash).catch((error) => ({ success: false, error: error.message }));
      verifiedOnBlockchain = blockchain?.verified === true || blockchain?.verified === 'true';
    } catch (e) {
      console.error("Blockchain verification error:", e);
      blockchain = { success: false, error: e.message };
    }

    const integrity = verified && verifiedOnBlockchain;
    if (integrity) {
      statusLabel = "VERIFIED";
    }

    try {
      bill.verified = integrity;
      bill.verifiedAt = new Date();
      bill.verifiedBy = (req.user && (req.user.email || req.user.name)) || req.body.verifiedBy || 'system';
      if (documentHash || bill.documentHash) bill.verificationHash = documentHash || bill.documentHash;
      if (blockchain && blockchain.transactionId) bill.blockchainTxHash = blockchain.transactionId;
      if (blockchain && blockchain.error) bill.blockchainError = blockchain.error;
      await bill.save();
    } catch (persistErr) {
      console.warn('Failed to persist bill verification metadata:', persistErr.message || persistErr);
    }

    res.json({
      ok: true,
      data: {
        bill,
        verified: integrity,
        verificationStatus: statusLabel,
        verifiedOnBlockchain,
        blockchain,
        integrity
      }
    });
  } catch (error) {
    next(error);
  }
}


async function updatePaymentStatus(req, res, next) {
  try {
    const bill = await Bill.findOneAndUpdate(
      { billId: req.params.billId },
      { $set: { paymentStatus: req.body.status, updatedAt: new Date() } },
      { new: true }
    );
    if (!bill) {
      return res.status(404).json({ ok: false, error: "Bill not found" });
    }
    res.json({
      ok: true,
      data: bill
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  uploadBill,
  getBills,
  getBill,
  verifyBill,
  updatePaymentStatus
};