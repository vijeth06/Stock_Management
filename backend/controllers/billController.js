const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const {
  createBillOnFabric,
  readBillFromFabric,
  getAllBillsFromFabric,
  verifyBillOnFabric,
  readAssetFromFabric
} = require("../services/fabricService");

async function uploadBill(req, res, next) {
  try {
    let { billId, assetId, vendor, invoiceNumber, amount, documentHash, paymentStatus } = req.body || {};

    if (req.file) {
      const uploadDir = path.join(__dirname, "../../../uploads/bills");
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }

      const destPath = path.join(uploadDir, req.file.filename);
      try {
        fs.renameSync(req.file.path, destPath);
      } catch (e) {
        fs.copyFileSync(req.file.path, destPath);
        try { fs.unlinkSync(req.file.path); } catch (e2) {}
      }

      const buf = fs.readFileSync(destPath);
      documentHash = crypto.createHash("sha256").update(buf).digest("hex");
      billId = billId || `BILL-${Date.now()}`;
    } else {
      documentHash = documentHash || req.body.billHash || `0x${crypto.randomBytes(16).toString("hex")}`;
      billId = billId || `BILL-${Date.now()}`;
    }

    const billData = {
      billId,
      assetId: assetId || "",
      vendor: vendor || "Vendor",
      invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
      amount: Number(amount || 0),
      documentHash,
      paymentStatus: paymentStatus || "Paid"
    };

    const fabricRes = await createBillOnFabric(billData);
    if (!fabricRes.success) {
      return res.status(500).json({ ok: false, error: fabricRes.error || "Failed to write bill to ledger" });
    }

    const bill = {
      _id: `bill-${Date.now()}`,
      ...billData,
      verified: true,
      createdAt: new Date().toISOString()
    };

    res.status(200).json({
      ok: true,
      data: bill,
      message: "Bill uploaded & verified on chain"
    });
  } catch (error) {
    next(error);
  }
}

async function getBills(req, res, next) {
  try {
    const { assetId, paymentStatus, page = 1, limit = 50 } = req.query;
    const billsRes = await getAllBillsFromFabric();
    let bills = billsRes.bills || [];

    if (assetId) {
      bills = bills.filter(b => b.assetId === assetId);
    }
    if (paymentStatus) {
      bills = bills.filter(b => b.paymentStatus === paymentStatus);
    }

    const total = bills.length;
    const skip = (Number(page) - 1) * Number(limit);
    const paginated = bills.slice(skip, skip + Number(limit));

    res.json({
      ok: true,
      data: paginated,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
}

async function getBill(req, res, next) {
  try {
    const billId = req.params.billId;
    const billRes = await readBillFromFabric(billId);
    if (!billRes.success || !billRes.bill) {
      return res.status(404).json({ ok: false, error: "Bill not found" });
    }
    res.json({
      ok: true,
      data: billRes.bill
    });
  } catch (error) {
    next(error);
  }
}

async function verifyBill(req, res, next) {
  try {
    const { billId, documentHash } = req.body;
    let bill = null;

    const billRes = await readBillFromFabric(billId);
    if (billRes.success && billRes.bill) {
      bill = billRes.bill;
    }

    if (!bill) {
      const assetRes = await readAssetFromFabric(billId);
      if (assetRes.success && assetRes.asset) {
        bill = {
          _id: `bill-${Date.now()}`,
          billId,
          assetId: assetId || billId,
          documentHash: assetRes.asset.billHash,
          verified: true
        };
      }
    }

    if (!bill) {
      return res.status(404).json({ ok: false, error: "Bill not found" });
    }

    const targetHash = documentHash || bill.documentHash || bill.billHash;
    const targetKey = bill.assetId || billId;
    const blockchainRes = await verifyBillOnFabric(targetKey, targetHash);

    const verified = Boolean(blockchainRes.verified || targetHash === bill.documentHash);
    const statusLabel = verified ? "VERIFIED" : "DOCUMENT MODIFIED / INVALID";

    bill.verified = verified;
    bill.verifiedAt = new Date().toISOString();

    res.json({
      ok: true,
      data: {
        bill,
        verified,
        verificationStatus: statusLabel,
        verifiedOnBlockchain: true,
        blockchain: blockchainRes,
        integrity: verified
      }
    });
  } catch (error) {
    next(error);
  }
}

async function updatePaymentStatus(req, res, next) {
  try {
    const billId = req.params.billId;
    const billRes = await readBillFromFabric(billId);
    if (!billRes.success || !billRes.bill) {
      return res.status(404).json({ ok: false, error: "Bill not found" });
    }

    const bill = billRes.bill;
    bill.paymentStatus = req.body.status || "Paid";
    await createBillOnFabric(bill);

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