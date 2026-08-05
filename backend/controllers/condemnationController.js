const CondemnationRecord = require("../models/CondemnationRecord");
const Asset = require("../models/Asset");
const { requestCondemnationOnFabric, approveCondemnationOnFabric } = require("../services/fabricService");
const { recordAuditLog } = require("../services/auditService");

async function requestCondemnation(req, res, next) {
  try {
    const { assetId, reason, requestedBy, disposalMethod, inspectionDetails } = req.body;

    const asset = await Asset.findOne({ assetId });
    if (!asset) {
      return res.status(404).json({ ok: false, error: "Asset not found" });
    }

    if (["Condemned", "Disposed", "Retired", "Condemnation Requested"].includes(asset.status)) {
      return res.status(400).json({ ok: false, error: "Asset is already condemned, retired, disposed, or pending condemnation" });
    }

    const recordId = `COND-${Date.now()}`;
    const record = await CondemnationRecord.create({
      recordId, assetId, reason, requestedBy, disposalMethod, inspectionDetails, status: "Pending"
    });

    asset.status = "Condemnation Requested";
    asset.condemnationRecord = record;
    await asset.save();

    await recordAuditLog({
      actor: requestedBy || (req.user && (req.user.email || req.user.name)) || "system",
      role: (req.user && req.user.role) || "DepartmentUser",
      action: "REQUEST_CONDEMNATION",
      resourceType: "CondemnationRecord",
      resourceId: recordId,
      details: { assetId, reason }
    }).catch(() => {});

    const blockchain = await requestCondemnationOnFabric(assetId, reason, requestedBy)
      .catch((error) => ({ success: false, error: error.message }));

    res.status(201).json({
      ok: true,
      data: record,
      blockchain
    });
  } catch (error) {
    next(error);
  }
}

async function getCondemnationRecords(req, res, next) {
  try {
    const { status, page = 1, limit = 20 } = req.query;

    const filter = status ? { status } : {};

    const skip = (page - 1) * limit;
    const records = await CondemnationRecord.find(filter)
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    const total = await CondemnationRecord.countDocuments(filter);

    res.json({
      ok: true,
      data: records,
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

async function getCondemnationRecord(req, res, next) {
  try {
    const record = await CondemnationRecord.findOne({ recordId: req.params.recordId });
    if (!record) {
      return res.status(404).json({ ok: false, error: "Condemnation record not found" });
    }
    res.json({
      ok: true,
      data: record
    });
  } catch (error) {
    next(error);
  }
}

async function approveCondemnation(req, res, next) {
  try {
    const { recordId } = req.params;
    const { approvedBy, disposalMethod } = req.body;

    const record = await CondemnationRecord.findOne({ recordId });
    if (!record) {
      return res.status(404).json({ ok: false, error: "Condemnation record not found" });
    }

    if (record.status !== "Pending" && record.status !== "Pending Approval") {
      return res.status(400).json({ ok: false, error: "Condemnation request is not pending" });
    }

    record.status = "Approved";
    record.approvedAt = new Date();
    record.approvedBy = approvedBy || (req.user && (req.user.email || req.user.name)) || "Administrator";
    if (disposalMethod) record.disposalMethod = disposalMethod;

    await record.save();

    const asset = await Asset.findOne({ assetId: record.assetId });
    if (asset) {
      asset.status = "Condemned";
      asset.condemnationRecord = record;
      await asset.save();
    }

    await recordAuditLog({
      actor: record.approvedBy,
      role: (req.user && req.user.role) || "Administrator",
      action: "APPROVE_CONDEMNATION",
      resourceType: "CondemnationRecord",
      resourceId: recordId,
      details: { assetId: record.assetId, disposalMethod: record.disposalMethod }
    }).catch(() => {});

    const blockchain = await approveCondemnationOnFabric(record.assetId, record.approvedBy)
      .catch((error) => ({ success: false, error: error.message }));

    res.json({
      ok: true,
      data: record,
      blockchain
    });
  } catch (error) {
    next(error);
  }
}

async function rejectCondemnation(req, res, next) {
  try {
    const { recordId } = req.params;
    const { rejectedBy, rejectionReason } = req.body;

    const record = await CondemnationRecord.findOne({ recordId });
    if (!record) {
      return res.status(404).json({ ok: false, error: "Condemnation record not found" });
    }

    if (record.status !== "Pending" && record.status !== "Pending Approval") {
      return res.status(400).json({ ok: false, error: "Condemnation request is not pending" });
    }

    record.status = "Rejected";
    record.rejectedAt = new Date();
    record.rejectedBy = rejectedBy || (req.user && (req.user.email || req.user.name)) || "Administrator";
    record.rejectionReason = rejectionReason || "Request declined by auditor";

    await record.save();

    const asset = await Asset.findOne({ assetId: record.assetId });
    if (asset && asset.status === "Condemnation Requested") {
      asset.status = "Active";
      await asset.save();
    }

    await recordAuditLog({
      actor: record.rejectedBy,
      role: (req.user && req.user.role) || "Administrator",
      action: "REJECT_CONDEMNATION",
      resourceType: "CondemnationRecord",
      resourceId: recordId,
      details: { assetId: record.assetId, rejectionReason: record.rejectionReason }
    }).catch(() => {});

    res.json({
      ok: true,
      data: record
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  requestCondemnation,
  getCondemnationRecords,
  getCondemnationRecord,
  approveCondemnation,
  rejectCondemnation
};