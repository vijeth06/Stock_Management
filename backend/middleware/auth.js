const jwt = require("jsonwebtoken");
const { hasRequiredRole } = require("../services/authService");

function authenticate(req, res, next) {
  const secret = process.env.JWT_SECRET || "change-me-in-development";
  const header = req.headers.authorization || req.headers.Authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : (req.query && req.query.token ? req.query.token : null);

  if (!token) {
    return res.status(401).json({ ok: false, error: "Authorization token is required" });
  }

  try {
    req.user = jwt.verify(token, secret);
    return next();
  } catch (error) {
    return res.status(401).json({ ok: false, error: "Invalid or expired token" });
  }
}

function authorize(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ ok: false, error: "Authentication required" });
    }

    if (!hasRequiredRole(req.user.role, allowedRoles)) {
      return res.status(403).json({ ok: false, error: "Forbidden" });
    }

    return next();
  };
}

function checkDepartmentAccess(user, targetDepartment) {
  if (!user) return false;
  if (user.role === "Administrator" || user.role === "AuditOfficer") {
    return true;
  }
  if (user.role === "DepartmentUser") {
    if (!user.department) return false;
    return user.department.toUpperCase() === (targetDepartment || "").toUpperCase();
  }
  return false;
}

module.exports = { authenticate, authorize, checkDepartmentAccess };
