const Department = require("../models/Department");
const User = require("../models/User");
const { recordAuditLog } = require("../services/auditService");

async function createDepartment(req, res, next) {
  try {
    const { name, code, description, manager } = req.body;

    const existing = await Department.findOne({ code });
    if (existing) {
      return res.status(409).json({ ok: false, error: "Department code already exists" });
    }

    const department = await Department.create({
      name,
      code,
      description,
      manager
    });

    await recordAuditLog({
      actor: (req.user && (req.user.email || req.user.name)) || "system",
      role: (req.user && req.user.role) || "Administrator",
      action: "CREATE_DEPARTMENT",
      resourceType: "Department",
      resourceId: code,
      details: { name, code }
    }).catch(() => {});

    res.status(201).json({
      ok: true,
      data: department
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ ok: false, error: "Department with this name or code already exists" });
    }
    next(error);
  }
}

async function getDepartments(req, res, next) {
  try {
    const departments = await Department.find({});
    res.json({
      ok: true,
      data: departments
    });
  } catch (error) {
    next(error);
  }
}

async function getDepartment(req, res, next) {
  try {
    const department = await Department.findById(req.params.id) || await Department.findOne({ code: req.params.id });
    if (!department) {
      return res.status(404).json({ ok: false, error: "Department not found" });
    }
    res.json({
      ok: true,
      data: department
    });
  } catch (error) {
    next(error);
  }
}

async function updateDepartment(req, res, next) {
  try {
    let department = await Department.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!department) {
      department = await Department.findOneAndUpdate(
        { code: req.params.id },
        { $set: req.body },
        { new: true, runValidators: true }
      );
    }
    if (!department) {
      return res.status(404).json({ ok: false, error: "Department not found" });
    }
    res.json({
      ok: true,
      data: department
    });
  } catch (error) {
    next(error);
  }
}

async function deleteDepartment(req, res, next) {
  try {
    let department = await Department.findByIdAndDelete(req.params.id);
    if (!department) {
      department = await Department.findOneAndDelete({ code: req.params.id });
    }
    if (!department) {
      return res.status(404).json({ ok: false, error: "Department not found" });
    }
    await recordAuditLog({
      actor: (req.user && (req.user.email || req.user.name)) || "system",
      role: (req.user && req.user.role) || "Administrator",
      action: "DELETE_DEPARTMENT",
      resourceType: "Department",
      resourceId: department.code,
      details: { name: department.name, code: department.code }
    }).catch(() => {});

    res.json({
      ok: true,
      data: { message: "Department deleted successfully", department }
    });
  } catch (error) {
    next(error);
  }
}

async function getDepartmentSummary(req, res, next) {
  try {
    const department = await Department.findById(req.params.id);
    if (!department) {
      return res.status(404).json({ ok: false, error: "Department not found" });
    }

    const Asset = require("../models/Asset");
    const departmentKey = department.code || department.name;
    const stats = await Asset.aggregate([
      { $match: { department: departmentKey } },
      {
        $group: {
          _id: null,
          totalAssets: { $sum: 1 },
          totalValue: { $sum: "$purchaseValue" },
          activeAssets: {
            $sum: { $cond: [{ $eq: ["$status", "Active"] }, 1, 0] }
          },
          maintenanceAssets: {
            $sum: { $cond: [{ $eq: ["$status", "Maintenance"] }, 1, 0] }
          },
          condemnedAssets: {
            $sum: { $cond: [{ $eq: ["$status", "Condemned"] }, 1, 0] }
          }
        }
      }
    ]);

    res.json({
      ok: true,
      data: {
        department,
        stats: stats[0] || {
          totalAssets: 0,
          totalValue: 0,
          activeAssets: 0,
          maintenanceAssets: 0,
          condemnedAssets: 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createDepartment,
  getDepartments,
  getDepartment,
  updateDepartment,
  deleteDepartment,
  getDepartmentSummary
};