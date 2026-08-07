const {
  requestCondemnationOnFabric,
  approveCondemnationOnFabric,
  rejectCondemnationOnFabric,
  readAssetFromFabric,
  getAllCondemnationRecordsFromFabric,
  getAllAssetsFromFabric
} = require("../services/fabricService");

async function requestCondemnation(req, res, next) {
  try {
    const { assetId, reason, requestedBy, disposalMethod } = req.body;

    const assetRes = await readAssetFromFabric(assetId);
    if (!assetRes.success || !assetRes.asset) {
      return res.status(404).json({ ok: false, error: "Asset not found" });
    }

    const asset = assetRes.asset;
    if (["Condemned", "Disposed", "Retired", "Condemnation Requested"].includes(asset.status)) {
      return res.status(400).json({ ok: false, error: "Asset is already condemned, retired, disposed, or pending condemnation" });
    }

    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      const userDept = String(req.user.department).toUpperCase();
      if (asset.department && asset.department.toUpperCase() !== userDept) {
        return res.status(403).json({ ok: false, error: "Cannot request condemnation for another department's asset" });
      }
    }

    const reqUser = requestedBy || (req.user && (req.user.email || req.user.name)) || "DepartmentUser";
    const condRes = await requestCondemnationOnFabric(assetId, reason || "Asset obsolete/damaged", reqUser);

    if (!condRes.success) {
      return res.status(500).json({ ok: false, error: condRes.error || "Failed to submit condemnation on ledger" });
    }

    const record = condRes.result || {
      recordId: `COND-${Date.now()}`,
      assetId,
      reason: reason || "Asset obsolete/damaged",
      requestedBy: reqUser,
      disposalMethod: disposalMethod || "Scrap",
      status: "Pending",
      requestedAt: new Date().toISOString()
    };

    res.status(201).json({
      ok: true,
      data: record,
      blockchain: condRes
    });
  } catch (error) {
    next(error);
  }
}

async function getCondemnationRecords(req, res, next) {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const recordsRes = await getAllCondemnationRecordsFromFabric();
    const assetsRes = await getAllAssetsFromFabric();
    let records = recordsRes.records || [];
    const assets = (assetsRes.success ? assetsRes.assets || [] : []);

    const reqUser = req.user;
    if (reqUser && reqUser.role === "DepartmentUser" && reqUser.department) {
      const userDept = String(reqUser.department).toUpperCase();
      records = records.filter(r => {
        const condAssetId = r.assetId;
        const recAsset = assets.find(a => a.assetId === condAssetId);
        return recAsset?.department?.toUpperCase() === userDept;
      });
    }

    if (status) {
      records = records.filter(r => r.status === status);
    }

    const total = records.length;
    const skip = (Number(page) - 1) * Number(limit);
    const paginated = records.slice(skip, skip + Number(limit));

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

async function getCondemnationRecord(req, res, next) {
  try {
    const recordId = req.params.recordId;
    const recordsRes = await getAllCondemnationRecordsFromFabric();
    const assetsRes = await getAllAssetsFromFabric();
    const records = recordsRes.records || [];
    const assets = (assetsRes.success ? assetsRes.assets || [] : []);
    const record = records.find(r => r.recordId === recordId || r._id === recordId);

    if (!record) {
      return res.status(404).json({ ok: false, error: "Condemnation record not found" });
    }

    if (req.user && req.user.role === "DepartmentUser" && req.user.department) {
      const userDept = String(req.user.department).toUpperCase();
      const condAssetId = record.assetId;
      const recAsset = assets.find(a => a.assetId === condAssetId);
      if (recAsset?.department?.toUpperCase() !== userDept) {
        return res.status(403).json({ ok: false, error: "Access denied" });
      }
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
    const recordsRes = await getAllCondemnationRecordsFromFabric();
    const records = recordsRes.records || [];
    const record = records.find(r => r.recordId === recordId || r._id === recordId);

    if (!record) {
      return res.status(404).json({ ok: false, error: "Condemnation record not found" });
    }

    if (record.status !== "Pending" && record.status !== "Pending Approval") {
      return res.status(400).json({ ok: false, error: "Condemnation request is not pending" });
    }

    const approver = req.body.approvedBy || (req.user && (req.user.email || req.user.name)) || "Administrator";
    const condRes = await approveCondemnationOnFabric(record.assetId, approver);

    record.status = "Approved";
    record.approvedBy = approver;
    record.approvedAt = new Date().toISOString();

    res.json({
      ok: true,
      data: record,
      blockchain: condRes
    });
  } catch (error) {
    next(error);
  }
}

async function rejectCondemnation(req, res, next) {
  try {
    const { recordId } = req.params;
    const recordsRes = await getAllCondemnationRecordsFromFabric();
    const records = recordsRes.records || [];
    const record = records.find(r => r.recordId === recordId || r._id === recordId);

    if (!record) {
      return res.status(404).json({ ok: false, error: "Condemnation record not found" });
    }

    if (record.status !== "Pending" && record.status !== "Pending Approval") {
      return res.status(400).json({ ok: false, error: "Condemnation request is not pending" });
    }

    const rejector = req.body.rejectedBy || (req.user && (req.user.email || req.user.name)) || "Administrator";
    const condRes = await rejectCondemnationOnFabric(record.assetId, rejector);

    record.status = "Rejected";
    record.rejectedBy = rejector;
    record.rejectedAt = new Date().toISOString();

    res.json({
      ok: true,
      data: record,
      blockchain: condRes
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