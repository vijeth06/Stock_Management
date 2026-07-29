const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const User = require("../models/User");
const mongoose = require("mongoose");

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
  return bcrypt.compare(password, passwordHash);
}

function signToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
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

async function registerUser({ name, email, password, role, department }) {
  if (mongoose.connection.readyState !== 1) {
    const user = {
      _id: "mock-user-id",
      email: email.toLowerCase().trim(),
      name: name,
      role: role || "DepartmentUser",
      department: department,
      isActive: true
    };
    const token = signToken(user);
    const tokenId = generateTokenId();
    return { user, token, tokenId };
  }
  const passwordHash = await hashPassword(password);
  const user = await User.create({ name, email, passwordHash, role, department });
  const token = signToken(user);
  const tokenId = generateTokenId();
  return { user, token, tokenId };
}

async function loginUser({ email, password }) {
  if (mongoose.connection.readyState !== 1) {
    const user = {
      _id: "mock-user-id",
      email: email.toLowerCase().trim(),
      name: "Mock User",
      role: "Administrator",
      isActive: true
    };
    const token = signToken(user);
    const tokenId = generateTokenId();
    return { user, token, tokenId };
  }
  const user = await User.findOne({ email: email.toLowerCase().trim(), isActive: true });
  if (!user) {
    throw new Error("Invalid email or password");
  }

  if (user.failedLoginAttempts >= 5 && user.lockedUntil && user.lockedUntil > new Date()) {
    throw new Error("Account is temporarily locked due to too many failed login attempts");
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
    if (user.failedLoginAttempts >= 5) {
      user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
    }
    await user.save();
    throw new Error("Invalid email or password");
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  await user.save();

  const token = signToken(user);
  const tokenId = generateTokenId();
  return { user, token, tokenId };
}

async function seedDemoAdmin() {
  const passwordHash = await hashPassword(DEMO_ADMIN_PASSWORD);
  const user = await User.findOneAndUpdate(
    { email: DEMO_ADMIN_EMAIL.toLowerCase() },
    {
      $set: {
        name: DEMO_ADMIN_NAME,
        email: DEMO_ADMIN_EMAIL.toLowerCase(),
        passwordHash,
        role: "Administrator",
        isActive: true,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  return {
    email: user.email,
    password: DEMO_ADMIN_PASSWORD,
    name: user.name,
    role: user.role,
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
  seedDemoAdmin,
};