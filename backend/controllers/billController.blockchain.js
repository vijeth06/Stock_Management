const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  createBillOnFabric,
  readBillFromFabric,
  getAllBillsFromFabric,
  verifyBillOnFabric,
  readAssetFromFabric
} = require('../services/fabricService');
const { generateDownloadToken, validateDownloadToken } = require('../services/fileService');
const { recordAuditLog } = require('../services/auditService');
const { uploadFile, USE_S3, getPresignedUrl } = require('../services/storageService');

async function uploadBill(req, res, next) {
  try {
    let { billId, assetId, vendor, invoiceNumber, amount, documentHash, paymentStatus } = req.body || {};

    let billDepartment = null;
    let userDept = null;

    const assetRes = await readAssetFromFabric(assetId);
    if (assetRes.success && assetRes.asset && assetRes.asset.department) {
      billDepartment = assetRes.asset.department;
    }

    if (req.user && req.user.department) {
      userDept = String(req.user.department).toUpperCase();
    }

    if (req.user && req.user.role === "DepartmentUser" && userDept) {
      if (assetRes.success && assetRes.asset && assetRes.asset.department) {
        const assetDept = String(assetRes.asset.department).toUpperCase();
        if (assetDept !== userDept) {
          return res.status(403).json({ ok: false, error: 'Cannot upload bill for another department\'s asset' });
        }
      }
    }

    let storageRes = null;
    let documentContent = null;
    let documentMimeType = null;
    let documentName = null;
    if (req.file) {
      const buf = req.file.buffer;
      documentHash = crypto.createHash('sha256').update(buf).digest('hex');
      billId = billId || `BILL-${Date.now()}`;
      documentContent = buf.toString('base64');
      documentMimeType = req.file.mimetype || 'application/octet-stream';
      documentName = req.file.originalname || `${billId}.bin`;
      // NOTE: no local disk write; storing document bytes on-chain via CreateBill
    }

    if (!assetId || !documentHash) {
      return res.status(400).json({ ok: false, error: 'assetId and documentHash are required' });
    }

    billId = billId || `BILL-${Date.now()}`;
    const providedDocumentKey = (req.body && req.body.documentKey) || (req.query && req.query && req.query.documentKey) || (req.get && req.get('X-Document-Key'));

    const billData = {
      billId,
      assetId,
      department: billDepartment,
      vendor: vendor || 'Vendor',
      invoiceNumber: invoiceNumber || `INV-${Date.now()}`,
      amount: Number(amount || 0),
      documentHash,
      paymentStatus: paymentStatus || 'Paid',
      documentKey: (storageRes && storageRes.key) || providedDocumentKey || '',
      documentContent,
      documentMimeType,
      documentName
    };

    const fabricResult = await createBillOnFabric(billData);
    if (!fabricResult || !fabricResult.success) {
      return res.status(500).json({ ok: false, error: 'Failed to record bill on ledger', detail: fabricResult });
    }

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

    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      const userDept = String(req.user.department).toUpperCase();
      if (billRes.bill.department) {
        const billDept = String(billRes.bill.department).toUpperCase();
        if (billDept !== userDept) {
          return res.status(403).json({ ok: false, error: 'Access denied' });
        }
      }
    }

    // If S3 is enabled, attempt to return a presigned S3 URL using stored naming convention.
    if (USE_S3) {
      // Read bill from ledger and use stored documentKey
      const key = billRes.bill.documentKey || billRes.bill.key || null;
      if (!key) return res.status(404).json({ ok: false, error: 'Bill document key not found on ledger' });

      const presigned = await getPresignedUrl(key, Number(process.env.FILE_TOKEN_TTL || 300));
      if (!presigned) return res.status(500).json({ ok: false, error: 'Failed to generate download URL' });

      try { await recordAuditLog({ actor: req.user && req.user.email, role: req.user && req.user.role, action: 'GENERATE_BILL_PRESIGNED_URL', resourceType: 'Bill', resourceId: billId, details: { key } }); } catch (e) {}
      return res.json({ ok: true, data: { url: presigned, expiresIn: Number(process.env.FILE_TOKEN_TTL || 300) } });
    }

    // Non-S3 flow: generate a token that references the billId (ledger-backed)
    const token = generateDownloadToken(billId, Number(process.env.FILE_TOKEN_TTL || 300));

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
    const info = validateDownloadToken(token);
    if (!info) return res.status(401).json({ ok: false, error: 'Invalid or expired token' });

    // If token references a ledger billId, read and return bytes from Fabric
    if (info.billId) {
      const billRes = await readBillFromFabric(info.billId);
      if (!billRes.success || !billRes.bill || !billRes.bill.documentContent) return res.status(404).json({ ok: false, error: 'Bill document not found' });
      const buf = Buffer.from(billRes.bill.documentContent, 'base64');
      try { await recordAuditLog({ actor: 'anonymous-token', role: 'system', action: 'DOWNLOAD_BILL', resourceType: 'Bill', resourceId: info.billId }); } catch (e) {}
      res.setHeader('Content-Type', billRes.bill.documentMimeType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${billRes.bill.documentName || info.billId}"`);
      return res.send(buf);
    }

    // Legacy file path token
    const filePath = info.filePath || null;
    if (!filePath) return res.status(404).json({ ok: false, error: 'File not found' });
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
      bills = bills.filter(b => (b.department || "").toUpperCase() === userDept);
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
    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      const userDept = String(req.user.department).toUpperCase();
      const billDept = String(billRes.bill.department || "").toUpperCase();
      if (billDept && billDept !== userDept) {
        return res.status(403).json({ ok: false, error: 'Access denied' });
      }
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

    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      const billRes = await readBillFromFabric(billId);
      if (billRes.success && billRes.bill && billRes.bill.department) {
        const userDept = String(req.user.department).toUpperCase();
        const billDept = String(billRes.bill.department).toUpperCase();
        if (billDept !== userDept) {
          return res.status(403).json({ ok: false, error: 'Access denied' });
        }
      }
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

    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      const userDept = String(req.user.department).toUpperCase();
      if (billRes.bill.department) {
        const billDept = String(billRes.bill.department).toUpperCase();
        if (billDept !== userDept) {
          return res.status(403).json({ ok: false, error: 'Access denied' });
        }
      }
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
