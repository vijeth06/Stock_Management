const {
  createDepartmentOnFabric,
  readDepartmentFromFabric,
  updateDepartmentOnFabric,
  getAllDepartmentsFromFabric,
  getAllAssetsFromFabric
} = require("../services/fabricService");

async function createDepartment(req, res, next) {
  try {
    const { name, code, description, manager } = req.body;
    if (!code || !name) {
      return res.status(400).json({ ok: false, error: "Department code and name are required" });
    }

    const codeUpper = String(code).trim().toUpperCase();
    const existingRes = await readDepartmentFromFabric(codeUpper);
    if (existingRes.success && existingRes.department) {
      return res.status(409).json({ ok: false, error: "Department code already exists" });
    }

    const deptRes = await createDepartmentOnFabric({
      code: codeUpper,
      name,
      description: description || "",
      manager: manager || "Admin"
    });

    if (!deptRes.success) {
      return res.status(500).json({ ok: false, error: deptRes.error || "Failed to create department on ledger" });
    }

    const department = {
      _id: `dept-${Date.now()}`,
      code: codeUpper,
      name,
      description: description || "",
      manager: manager || "Admin",
      isActive: true,
      createdAt: new Date().toISOString()
    };

    res.status(201).json({
      ok: true,
      data: department
    });
  } catch (error) {
    next(error);
  }
}

async function getDepartments(req, res, next) {
  try {
    const deptsRes = await getAllDepartmentsFromFabric();
    let departments = deptsRes.departments || [];

    // Always ensure default IT department exists
    if (!departments.some(d => (d.code || '').toUpperCase() === 'IT')) {
      departments.unshift({
        _id: 'dept-it',
        code: 'IT',
        name: 'Information Technology',
        description: 'IT Services & Asset Support',
        manager: 'Admin',
        isActive: true
      });
    }

    // Calculate asset counts for each department
    try {
      const assetsRes = await getAllAssetsFromFabric();
      const assets = (assetsRes.success ? assetsRes.assets || [] : []);
      const deptAssetCounts = {};
      assets.forEach(a => {
        const dept = (a.department || '').toUpperCase();
        deptAssetCounts[dept] = (deptAssetCounts[dept] || 0) + 1;
      });
      departments = departments.map(d => ({
        ...d,
        assetCount: deptAssetCounts[(d.code || '').toUpperCase()] || deptAssetCounts[d.name?.toUpperCase()] || 0
      }));
    } catch (e) {
      departments = departments.map(d => ({ ...d, assetCount: 0 }));
    }

    res.json({
      ok: true,
      data: departments
    });
  } catch (error) {
    next(error);
  }
}

function findDepartmentById(departments, id) {
  if (!id) return null;
  const idStr = String(id);
  const idUpper = idStr.toUpperCase();
  // Try exact _id match first
  let dept = departments.find(d => d._id === idStr || d.id === idStr);
  if (dept) return dept;
  // Try by code match
  dept = departments.find(d => (d.code || '').toUpperCase() === idUpper);
  return dept;
}

function getDeptsWithDefault() {
  return getAllDepartmentsFromFabric().then(res => {
    let depts = res.departments || [];
    if (!depts.some(d => (d.code || '').toUpperCase() === 'IT')) {
      depts.unshift({
        _id: 'dept-it',
        code: 'IT',
        name: 'Information Technology',
        description: 'IT Services & Asset Support',
        manager: 'Admin',
        isActive: true
      });
    }
    return depts;
  });
}

async function getDepartment(req, res, next) {
  try {
    const id = req.params.id;
    const depts = await getDeptsWithDefault();
    const department = findDepartmentById(depts, id);

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
    const id = req.params.id;
    const depts = await getDeptsWithDefault();
    const department = findDepartmentById(depts, id);

    if (!department) {
      return res.status(404).json({ ok: false, error: "Department not found" });
    }

    const updated = {
      ...department,
      ...req.body,
      updatedAt: new Date().toISOString()
    };

    // If the department is the default IT and doesn't exist on Fabric, create it
    const existsRes = await readDepartmentFromFabric(department.code);
    if (!existsRes.success || !existsRes.department) {
      await createDepartmentOnFabric({
        code: department.code,
        name: updated.name || department.name,
        description: updated.description || '',
        manager: updated.manager || department.manager
      });
    } else {
      await updateDepartmentOnFabric(department.code, updated);
    }
    res.json({
      ok: true,
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

async function deleteDepartment(req, res, next) {
  try {
    const id = req.params.id;
    const depts = await getDeptsWithDefault();
    const department = findDepartmentById(depts, id);

    if (!department) {
      return res.status(404).json({ ok: false, error: "Department not found" });
    }

    await updateDepartmentOnFabric(department.code, { isActive: false });
    res.json({
      ok: true,
      data: { message: "Department deactivated successfully", department }
    });
  } catch (error) {
    next(error);
  }
}

async function getDepartmentSummary(req, res, next) {
  try {
    const id = req.params.id;
    const depts = await getDeptsWithDefault();
    const department = findDepartmentById(depts, id);

    if (!department) {
      return res.status(404).json({ ok: false, error: "Department not found" });
    }

    const assetsRes = await getAllAssetsFromFabric();
    const assets = (assetsRes.assets || []).filter(a => (a.department || '').toUpperCase() === (department.code || '').toUpperCase());

    const stats = {
      totalAssets: assets.length,
      totalValue: assets.reduce((sum, a) => sum + (a.purchaseValue || 0), 0),
      activeAssets: assets.filter(a => a.status === 'Active').length,
      maintenanceAssets: assets.filter(a => a.status === 'Maintenance').length,
      condemnedAssets: assets.filter(a => a.status === 'Condemned').length
    };

    res.json({
      ok: true,
      data: {
        department,
        stats
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