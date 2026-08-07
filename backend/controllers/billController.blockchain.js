const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  createBillOnFabric,
  readBillFromFabric,
  getAllBillsFromFabric,
  verifyBillOnFabric
} = require('../services/fabricService');
const { generateDownloadToken, validateDownloadToken } = require('../services/fileService');
const { recordAuditLog } = require('../services/auditService');
const { uploadFile, USE_S3, getPresignedUrl } = require('../services/storageService');

async function uploadBill(req, res, next) {
  try {
    let { billId, assetId, vendor, invoiceNumber, amount, documentHash, paymentStatus } = req.body || {};

    let storageRes = null;
    if (req.file) {
        const tmpPath = req.file.path;
        const destName = `${billId || `BILL-${Date.now()}`}-${req.file.filename}`;
        try {
          storageRes = await uploadFile(tmpPath, destName);
          // If local storage, compute hash from file; if S3, read file buffer and compute
          let buf = null;
          if (storageRes.storage === 'local') {
            buf = fs.readFileSync(storageRes.key);
          } else {
            // For S3 we still compute hash from the uploaded temp file
            buf = fs.readFileSync(tmpPath);
          }
          documentHash = crypto.createHash('sha256').update(buf).digest('hex');
          billId = billId || `BILL-${Date.now()}`;
        } finally {
          try { fs.unlinkSync(tmpPath); } catch (e) {}
        }
    }

    if (!assetId || !documentHash) {
      return res.status(400).json({ ok: false, error: 'assetId and documentHash are required' });
    }

    billId = billId || `BILL-${Date.now()}`;
    const providedDocumentKey = (req.body && req.body.documentKey) || req.query && req.query.documentKey || req.get && req.get('X-Document-Key');

    const billData = {
      billId,
      assetId,
      vendor: vendor || 'Vendor',
      invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
      amount: Number(amount || 0),
      documentHash,
      paymentStatus: paymentStatus || 'Paid',
      documentKey: (storageRes && storageRes.key) || providedDocumentKey || ''
    };

    const fabricResult = await createBillOnFabric(billData);
    if (!fabricResult || !fabricResult.success) {
      return res.status(500).json({ ok: false, error: 'Failed to record bill on ledger', detail: fabricResult });
    }

    // Audit log
    try { await recordAuditLog({ actor: req.user && req.user.email, role: req.user && req.user.role, action: 'UPLOAD_BILL', resourceType: 'Bill', resourceId: billId, details: { assetId } }); } catch (e) {}

    res.status(201).json({ ok: true, data: billData, blockchain: fabricResult });
  } catch (err) {
    next(err);
  }
}

async function generateBillDownloadToken(req, res, next) {
  try {
    const billId = req.params.billId;
    const billRes = await readBillFromFabric(billId);
    if (!billRes.success || !billRes.bill) return res.status(404).json({ ok: false, error: 'Bill not found' });

    // If S3 is enabled, attempt to return a presigned S3 URL using stored naming convention.
    if (USE_S3) {
      // Read bill from ledger and use stored documentKey
      const billRes = await readBillFromFabric(billId);
      if (!billRes.success || !billRes.bill) return res.status(404).json({ ok: false, error: 'Bill not found' });
      const key = billRes.bill.documentKey || billRes.bill.key || null;
      if (!key) return res.status(404).json({ ok: false, error: 'Bill document key not found on ledger' });

      const presigned = await getPresignedUrl(key, Number(process.env.FILE_TOKEN_TTL || 300));
      if (!presigned) return res.status(500).json({ ok: false, error: 'Failed to generate download URL' });

      try { await recordAuditLog({ actor: req.user && req.user.email, role: req.user && req.user.role, action: 'GENERATE_BILL_PRESIGNED_URL', resourceType: 'Bill', resourceId: billId, details: { key } }); } catch (e) {}
      return res.json({ ok: true, data: { url: presigned, expiresIn: Number(process.env.FILE_TOKEN_TTL || 300) } });
    }

    // Fallback: local file token
    const uploadDir = require('path').join(__dirname, "../../uploads/bills");
    const filename = `${billId}.pdf`;
    const filePath = require('path').join(uploadDir, filename);
    if (!require('fs').existsSync(filePath)) return res.status(404).json({ ok: false, error: 'Bill document not found on server' });

    const token = generateDownloadToken(filePath, Number(process.env.FILE_TOKEN_TTL || 300));

    try { await recordAuditLog({ actor: req.user && req.user.email, role: req.user && req.user.role, action: 'GENERATE_BILL_DOWNLOAD_TOKEN', resourceType: 'Bill', resourceId: billId, details: { ttl: process.env.FILE_TOKEN_TTL || 300 } }); } catch (e) {}

    res.json({ ok: true, data: { token, expiresIn: Number(process.env.FILE_TOKEN_TTL || 300) } });
  } catch (err) {
    next(err);
  }
}

async function downloadBillByToken(req, res, next) {
  try {
    const token = req.query.token || req.body && req.body.token;
    if (!token) return res.status(400).json({ ok: false, error: 'token is required' });
    const filePath = validateDownloadToken(token);
    if (!filePath) return res.status(401).json({ ok: false, error: 'Invalid or expired token' });

    const fs = require('fs');
    if (!fs.existsSync(filePath)) return res.status(404).json({ ok: false, error: 'File not found' });

    try { await recordAuditLog({ actor: 'anonymous-token', role: 'system', action: 'DOWNLOAD_BILL', resourceType: 'Bill', resourceId: require('path').basename(filePath) }); } catch (e) {}

    res.sendFile(filePath);
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
    const reqUser = req.user;

    if (reqUser && reqUser.role === "DepartmentUser" && reqUser.department) {
      const userDept = String(reqUser.department).toUpperCase();
      bills = bills.filter(b => {
        const billAssetId = b.assetId;
        return billsRes.assets?.find(a => a.assetId === billAssetId)?.department?.toUpperCase() === userDept;
      });
    }

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

module.exports = { uploadBill, getBills, getBill, verifyBill, updatePaymentStatus, generateBillDownloadToken, downloadBillByToken };
