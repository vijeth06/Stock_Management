const { registerUser, loginUser, signToken } = require("../services/authService");
const {
  getAllUsersFromFabric,
  readUserFromFabric,
  updateUserOnFabric,
  createUserOnFabric
} = require("../services/fabricService");

async function register(req, res, next) {
  try {
    const { name, email, password, role, department } = req.body;
    const result = await registerUser({ name, email, password, role, department });
    res.status(201).json({
      ok: true,
      message: result.message || "Registration submitted successfully",
      data: {
        user: {
          id: result.user._id || result.user.userId,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          department: result.user.department,
          isApproved: result.user.isApproved,
          status: result.user.status
        }
      }
    });
  } catch (error) {
    res.status(400).json({ ok: false, error: error.message });
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await loginUser({ email, password });
    res.json({
      ok: true,
      data: {
        user: {
          id: result.user._id || result.user.userId,
          name: result.user.name,
          email: result.user.email,
          role: result.user.role,
          department: result.user.department,
          isApproved: result.user.isApproved
        },
        token: result.token
      }
    });
  } catch (error) {
    if (error.message.includes("pending Admin approval") || error.message.includes("rejected")) {
      return res.status(403).json({ ok: false, error: error.message });
    }
    if (error.message === "Invalid email or password") {
      return res.status(401).json({ ok: false, error: error.message });
    }
    res.status(500).json({ ok: false, error: error.message });
  }
}

async function getPendingUsers(req, res, next) {
  try {
    const usersRes = await getAllUsersFromFabric();
    const users = usersRes.users || [];
    const pendingUsers = users.filter(u => u.status === "PendingApproval" || !u.isApproved);
    res.json({ ok: true, data: pendingUsers });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}

async function approveUser(req, res, next) {
  try {
    const userId = req.params.id;
    const userRes = await readUserFromFabric(userId);
    if (!userRes.success || !userRes.user) {
      return res.status(404).json({ ok: false, error: "User not found on ledger" });
    }
    const user = userRes.user;
    user.isApproved = true;
    user.status = "Approved";

    await updateUserOnFabric(user.email, user);
    res.json({ ok: true, message: `User ${user.email} approved successfully`, data: user });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}

async function rejectUser(req, res, next) {
  try {
    const userId = req.params.id;
    const userRes = await readUserFromFabric(userId);
    if (!userRes.success || !userRes.user) {
      return res.status(404).json({ ok: false, error: "User not found on ledger" });
    }
    const user = userRes.user;
    user.isApproved = false;
    user.status = "Rejected";

    await updateUserOnFabric(user.email, user);
    res.json({ ok: true, message: `User ${user.email} registration rejected`, data: user });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}

async function gmailAuth(req, res, next) {
  try {
    const { email, name, department, departmentName } = req.body;
    if (!email || !email.includes("@")) {
      return res.status(400).json({ ok: false, error: "Valid Gmail address is required" });
    }

    const emailLower = email.toLowerCase().trim();
    const existingRes = await readUserFromFabric(emailLower);

    if (existingRes.success && existingRes.user) {
      const user = existingRes.user;
      if (!user.isApproved) {
        if (user.status === "Rejected") {
          return res.status(403).json({ ok: false, error: "Your Gmail registration request was rejected by Admin." });
        }
        return res.status(403).json({ ok: false, error: "Your Gmail account registration is pending Admin approval." });
      }
      const token = signToken(user);
      return res.json({ ok: true, message: "Logged in via Gmail!", data: { user, token } });
    }

    const result = await registerUser({
      name: name || emailLower.split("@")[0],
      email: emailLower,
      password: "gmail_authenticated",
      role: "DepartmentUser",
      department: department || "IT",
      departmentName: departmentName || "Information Technology"
    });

    res.status(201).json({
      ok: true,
      message: result.message || `Gmail registration submitted for ${email}`,
      data: { user: result.user }
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}

module.exports = { register, login, getPendingUsers, approveUser, rejectUser, gmailAuth };
