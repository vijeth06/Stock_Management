const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  createBillOnFabric,
  readBillFromFabric,
  getAllBillsFromFabric,
  verifyBillOnFabric
} = require('../services/fabricService');

async function uploadBill(req, res, next) {
  try {
    let { billId, assetId, vendor, invoiceNumber, amount, documentHash, paymentStatus } = req.body || {};

    if (req.file) {
      const uploadDir = path.join(__dirname, "../../uploads/bills");
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

      const tmpPath = req.file.path;
      const destPath = path.join(uploadDir, req.file.filename);
      try {
        fs.renameSync(tmpPath, destPath);
      } catch (e) {
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

    billId = billId || `BILL-${Date.now()}`;
    const billData = {
      billId,
      assetId,
      vendor: vendor || 'Vendor',
      invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
      amount: Number(amount || 0),
      documentHash,
      paymentStatus: paymentStatus || 'Paid'
    };

    const fabricResult = await createBillOnFabric(billData);
    if (!fabricResult || !fabricResult.success) {
      return res.status(500).json({ ok: false, error: 'Failed to record bill on ledger', detail: fabricResult });
    }

    res.status(201).json({ ok: true, data: billData, blockchain: fabricResult });
  } catch (err) {
    next(err);
  }
}

async function getBills(req, res, next) {
  try {
    const { assetId, paymentStatus, page = 1, limit = 50 } = req.query;
    const billsRes = await getAllBillsFromFabric();
    if (!billsRes.success) {
      return res.status(500).json({ ok: false, error: billsRes.error });
    }

    let bills = billsRes.bills || [];
    if (assetId) bills = bills.filter(b => b.assetId === assetId);
    if (paymentStatus) bills = bills.filter(b => b.paymentStatus === paymentStatus);

    const total = bills.length;
    const skip = (Number(page) - 1) * Number(limit);
    const paginated = bills.slice(skip, skip + Number(limit));

    res.json({ ok: true, data: paginated, pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) } });
  } catch (err) {
    next(err);
  }
}

async function getBill(req, res, next) {
  try {
    const billId = req.params.billId;
    const billRes = await readBillFromFabric(billId);
    if (!billRes.success || !billRes.bill) {
      return res.status(404).json({ ok: false, error: 'Bill not found' });
    }
    res.json({ ok: true, data: billRes.bill });
  } catch (err) {
    next(err);
  }
}

async function verifyBill(req, res, next) {
  try {
    const { billId, documentHash, assetId } = req.body || {};
    if (!billId || !documentHash) {
      return res.status(400).json({ ok: false, error: 'billId and documentHash are required' });
    }

    const fabricKey = assetId || billId;
    const result = await verifyBillOnFabric(fabricKey, documentHash).catch(e => ({ verified: false, error: e.message }));
    res.json({ ok: true, data: { billId, verified: !!result.verified, blockchain: result } });
  } catch (err) {
    next(err);
  }
}

async function updatePaymentStatus(req, res, next) {
  try {
    const billId = req.params.billId;
    const { status } = req.body || {};
    if (!billId || !status) {
      return res.status(400).json({ ok: false, error: 'billId and status are required' });
    }

    const billRes = await readBillFromFabric(billId);
    if (!billRes.success || !billRes.bill) {
      return res.status(404).json({ ok: false, error: 'Bill not found' });
    }

    const bill = { ...billRes.bill, paymentStatus: status };
    const updateRes = await createBillOnFabric(bill);
    if (!updateRes || !updateRes.success) {
      return res.status(500).json({ ok: false, error: 'Failed to update bill status', detail: updateRes });
    }

    res.json({ ok: true, data: bill, blockchain: updateRes });
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadBill, getBills, getBill, verifyBill, updatePaymentStatus };
