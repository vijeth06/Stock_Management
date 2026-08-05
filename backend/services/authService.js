const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const {
  createUserOnFabric,
  readUserFromFabric,
  updateUserOnFabric,
  getAllUsersFromFabric
} = require("./fabricService");

const JWT_SECRET = process.env.JWT_SECRET || "change-me-in-development";
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";
const DEMO_ADMIN_EMAIL = process.env.ADMIN_EMAIL || "admin@assetmgmt.local";
const DEMO_ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Admin@12345!";
const DEMO_ADMIN_NAME = process.env.ADMIN_NAME || "Demo Administrator";

const ROLE_HIERARCHY = {
  Administrator: ["Administrator"],
  DepartmentUser: ["DepartmentUser", "Administrator"],
  AuditOfficer: ["AuditOfficer", "Administrator"]
};

async function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

async function comparePassword(password, passwordHash) {
  if (!password || !passwordHash) return false;
  return bcrypt.compare(password, passwordHash);
}

function signToken(user) {
  return jwt.sign(
    {
      sub: String(user._id || user.userId),
      email: user.email,
      role: user.role,
      name: user.name,
      department: user.department
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function generateTokenId() {
  return crypto.randomBytes(16).toString("hex");
}

async function registerUser({ name, email, password, role, department, departmentName }) {
  const emailLower = (email || '').toLowerCase().trim();
  const existingRes = await readUserFromFabric(emailLower);

  if (existingRes.success && existingRes.user) {
    throw new Error("User with this email already exists");
  }

  const userRole = role || "DepartmentUser";
  const isApproved = userRole === "Administrator";
  const status = isApproved ? "Active" : "PendingApproval";
  const passwordHash = await hashPassword(password);
  const userId = `usr-${Date.now()}`;

  const fabricRes = await createUserOnFabric({
    userId,
    name,
    email: emailLower,
    password: passwordHash,
    role: userRole,
    department: (department || "IT").toUpperCase(),
    departmentName: departmentName || department || "IT",
    status,
    isApproved
  });

  if (!fabricRes.success) {
    throw new Error(`Failed to store user on ledger: ${fabricRes.error}`);
  }

  const user = {
    _id: userId,
    userId,
    name,
    email: emailLower,
    role: userRole,
    department: (department || "IT").toUpperCase(),
    departmentName: departmentName || department || "IT",
    isActive: true,
    isApproved,
    status
  };

  return {
    user,
    message: isApproved
      ? "User registered successfully"
      : "Registration submitted successfully. Pending Admin approval."
  };
}

async function loginUser({ email, password }) {
  const emailLower = (email || '').toLowerCase().trim();
  let userRes = await readUserFromFabric(emailLower);

  // Auto seed demo admin if missing
  if ((!userRes.success || !userRes.user) && emailLower === DEMO_ADMIN_EMAIL.toLowerCase()) {
    await seedDemoAdmin();
    userRes = await readUserFromFabric(emailLower);
  }

  if (!userRes.success || !userRes.user) {
    throw new Error("Invalid email or password");
  }

  const user = userRes.user;

  if (user.role !== "Administrator" && !user.isApproved) {
    if (user.status === "Rejected") {
      throw new Error("Your registration request was rejected by the Admin");
    }
    throw new Error("Your account is pending Admin approval. Please wait for an administrator to approve your account.");
  }

  if (user.failedLoginAttempts >= 5 && user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    throw new Error("Account is temporarily locked due to too many failed login attempts");
  }

  const valid = await comparePassword(password, user.password);
  if (!valid) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= 5) {
      user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    }
    await updateUserOnFabric(emailLower, user);
    throw new Error("Invalid email or password");
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date().toISOString();
  await updateUserOnFabric(emailLower, user);

  const token = signToken(user);
  const tokenId = generateTokenId();
  return { user, token, tokenId };
}

async function seedDemoAdmin() {
  const emailLower = DEMO_ADMIN_EMAIL.toLowerCase();
  const passwordHash = await hashPassword(DEMO_ADMIN_PASSWORD);

  await createUserOnFabric({
    userId: "usr-demo-admin",
    name: DEMO_ADMIN_NAME,
    email: emailLower,
    password: passwordHash,
    role: "Administrator",
    department: "IT",
    departmentName: "Information Technology",
    status: "Active",
    isApproved: true
  });

  return {
    email: emailLower,
    password: DEMO_ADMIN_PASSWORD,
    name: DEMO_ADMIN_NAME,
    role: "Administrator"
  };
}

function hasRequiredRole(userRole, allowedRoles) {
  const effectiveRoles = ROLE_HIERARCHY[userRole] || [userRole];
  return allowedRoles.some((role) => effectiveRoles.includes(role));
}

module.exports = {
  registerUser,
  loginUser,
  hasRequiredRole,
  signToken,
  seedDemoAdmin
};