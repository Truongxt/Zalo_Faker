
const { generateId } = require("../utils/idGenerator");
const bcrypt = require("bcryptjs");
const {
  signAccessToken,
  signRefreshToken
} = require("../utils/jwt");

const userRepository = require("../repository/userRepository");
const refreshTokenRepository = require("../repository/RefreshTokenRepository");
const loginHistoryRepository = require("../repository/loginHistoryRepository");
const { safeGet, safeSet, safeDel } = require("../utils/redisClient");
const { sendOTPEmail } = require("../utils/sendEmail");
const { validateRegistrationEmail } = require("../utils/emailValidation");
const { uploadFile } = require("./file.service");
const tableName = "User";

const FORGOT_OTP_TTL_SECONDS = 300;
const FORGOT_VERIFY_TTL_SECONDS = 600;
const FORGOT_RESEND_LIMIT_SECONDS = 60;
const PERMANENT_LOCK_OTP_TTL_SECONDS = 300;
const PERMANENT_LOCK_RESEND_LIMIT_SECONDS = 60;

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();
const normalizePhone = (phone) => String(phone || "").trim().replace(/[\s().-]/g, "");
const normalizePlatform = (platform) => {
  const normalized = String(platform || "").trim().toLowerCase();

  if (normalized === "mobile" || normalized === "android" || normalized === "ios") {
    return "mobile";
  }

  if (normalized === "web" || normalized === "browser") {
    return "web";
  }

  return "unknown";
};

const buildSessionKey = (userId, platform = "unknown") =>
  `auth:session:${String(userId)}:${normalizePlatform(platform)}`;

const buildLegacySessionKey = (userId) => `auth:session:${String(userId)}`;
const generateSessionId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

const resolveSessionKey = async ({ userId, sessionId, platform }) => {
  const normalizedUserId = String(userId || "");
  const expectedSessionId = String(sessionId || "");
  const normalizedPlatform = normalizePlatform(platform);

  const scopedKey = buildSessionKey(normalizedUserId, normalizedPlatform);
  const scopedSessionId = await safeGet(scopedKey);
  if (scopedSessionId && scopedSessionId === expectedSessionId) {
    return {
      key: scopedKey,
      platform: normalizedPlatform,
    };
  }

  const legacyKey = buildLegacySessionKey(normalizedUserId);
  const legacySessionId = await safeGet(legacyKey);
  if (legacySessionId && legacySessionId === expectedSessionId) {
    return {
      key: legacyKey,
      platform: normalizedPlatform,
    };
  }

  return null;
};

const generateOtp = () => String(Math.floor(100000 + Math.random() * 900000));

const sanitizePathSegment = (value, fallback) => {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return fallback;
  }

  return normalized.replace(/[^a-zA-Z0-9-_]/g, "_");
};

const uploadAvatarToS3 = async (userId, file) => {
  const safeUserId = sanitizePathSegment(userId, "anonymous");
  const originalName = file.originalname || "avatar.jpg";
  const extension = originalName.includes(".")
    ? originalName.split(".").pop()
    : "jpg";
  const fileName = `${uuidv4()}.${extension}`;

  const params = {
    Bucket: process.env.BUCKET_NAME,
    Key: `avatars/${safeUserId}/${fileName}`,
    Body: file.buffer,
    ContentType: file.mimetype,

  };

  const data = await s3.upload(params).promise();
  return data.Location;
};

const UserService = {

  register: async userData => {

    const { avartarUrl, birthday, email, gender, password, phone, status, accountStatus, userName } = userData;

    if (!email || !password || !userName || !gender || !phone || !avartarUrl || !birthday) {
      throw new Error("Email, password, and userName are required");
    }
    const existingUserEmail = await userRepository.getByEmail(email);
    if (existingUserEmail) {
      throw new Error("Email already exists");
    }
    const existingUserPhone = await userRepository.getByPhone(phone);
    if (existingUserPhone) {
      throw new Error("Phone number already exists");
    }

    const hashedPassword = await bcrypt.hash(password + "nhan123@@", 10);

    const createdAt = new Date().toISOString();
    const resolvedAccountStatus = accountStatus || status || "active";

    const user = {
      userId: await generateId("user"),
      avartarUrl: avartarUrl || null,
      birthday: birthday || null,
      createdAt,
      email: userData.email,
      gender: userData.gender,
      password: hashedPassword,
      phone: userData.phone,
      accountStatus: resolvedAccountStatus,
      status: resolvedAccountStatus,
      presenceStatus: "offline",
      lastActiveAt: createdAt,
      userName: userData.userName
    };

    const createdUser = await userRepository.register(user);
    const { password: _, ...safeUser } = createdUser;
    return safeUser;
  },

  getUsers: async () => {
    return await userRepository.getAll();
  },
  updateUser: async (userId, userData, avatarFile) => {

    if (avatarFile) {
      const avatarUrl = await uploadFile(avatarFile, {
        folder: "users",
        subfolder: `${userId}/avatars`
      });
      userData.avartarUrl = avatarUrl;
    }

    const updateFields = [];
    const ExpressionAttributeNames = {};
    const ExpressionAttributeValues = {};

    const allowedFields = [
      "avartarUrl",
      "birthday",
      "email",
      "gender",
      "password",
      "phone",
      "accountStatus",
      "status",
      "presenceStatus",
      "lastActiveAt",
      "userName"
    ];

    for (const field of allowedFields) {
      if (userData[field] !== undefined) {

        let value = userData[field];

        // 👉 nếu update password thì hash
        if (field === "password") {
          value = await bcrypt.hash(value + "nhan123@@", 10);
        }

        updateFields.push(`#${field} = :${field}`);
        ExpressionAttributeNames[`#${field}`] = field;
        ExpressionAttributeValues[`:${field}`] = value;
      }
    }

    if (!updateFields.length) {
      throw new Error("No fields to update");
    }

    const params = {
      TableName: tableName,
      Key: { userId },
      UpdateExpression: `set ${updateFields.join(", ")}`,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ReturnValues: "ALL_NEW"
    };

    return await userRepository.update(params);
  },

  deleteUser: async (userId) => {
    if (!userId) {
      throw new Error("userId is required");
    }

    const user = await userRepository.getById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const accountStatus = user.accountStatus || user.status || "active";
    if (accountStatus === "deleted") {
      throw new Error("Account is already deleted");
    }

    await Promise.all([
      safeDel(buildSessionKey(userId, "web")),
      safeDel(buildSessionKey(userId, "mobile")),
      safeDel(buildSessionKey(userId, "unknown")),
      safeDel(buildLegacySessionKey(userId)),
      refreshTokenRepository.deleteByUserId(userId),
    ]);

    const now = new Date().toISOString();
    const params = {
      TableName: tableName,
      Key: { userId },
      UpdateExpression:
        "set accountStatus = :accountStatus, #status = :status, presenceStatus = :presenceStatus, lastActiveAt = :lastActiveAt",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":accountStatus": "deleted",
        ":status": "deleted",
        ":presenceStatus": "offline",
        ":lastActiveAt": now,
      },
      ReturnValues: "ALL_NEW",
    };

    const result = await userRepository.update(params);
    const { password: _, ...safeUser } = result;

    return {
      message: "Account deleted successfully",
      user: safeUser,
    };
  },



  login: async (identifier, password, loginMeta = {}) => {
    const normalizedIdentifier = String(identifier || "").trim();
    const normalizedPassword = String(password || "");

    if (!normalizedIdentifier || !normalizedPassword) {
      throw new Error("Email/phone and password are required");
    }

    const normalizedIdentifierEmail = normalizeEmail(normalizedIdentifier);
    const normalizedIdentifierPhone = normalizePhone(normalizedIdentifier);

    const users = await userRepository.getAll();
    const user = users.find((u) => {
      const emailMatched = normalizeEmail(u.email) === normalizedIdentifierEmail;
      const phoneMatched = normalizePhone(u.phone) === normalizedIdentifierPhone;
      return emailMatched || phoneMatched;
    });
    if (!user) throw new Error("User not found");

    const accountStatus = user.accountStatus || user.status || "active";
    if (accountStatus === "locked") {
      throw new Error("Account is locked");
    }
    if (accountStatus === "deleted") {
      throw new Error("Account is deleted");
    }

    const isMatch = await bcrypt.compare(normalizedPassword + "nhan123@@", user.password);
    if (!isMatch) throw new Error("Invalid password");

    const sessionId = generateSessionId();
    const sessionPlatform = normalizePlatform(loginMeta.platform);
    const payload = {
      userId: user.userId,
      email: user.email,
      accountStatus,
      sessionId,
      platform: sessionPlatform,
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    await safeSet(buildSessionKey(user.userId, sessionPlatform), sessionId);
    await safeDel(buildLegacySessionKey(user.userId));

    await refreshTokenRepository.deleteByUserIdAndPlatform(user.userId, sessionPlatform);
    await refreshTokenRepository.create({
      refreshToken,
      userId: user.userId,
      platform: sessionPlatform,
      createdAt: new Date().toISOString()
    });

    // ── Record login history ──────────────────────────────────
    try {
      await loginHistoryRepository.create({
        userId: user.userId,
        loginId: `${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        loginAt: new Date().toISOString(),
        platform: sessionPlatform,
        deviceInfo: loginMeta.deviceInfo || "Unknown",
        ipAddress: loginMeta.ipAddress || "Unknown",
      });
    } catch (err) {
      console.warn("Failed to record login history:", err?.message || err);
    }

    const { password: _, ...safeUser } = user;

    return {
      user: safeUser,
      accessToken,
      refreshToken
    };
  },
  logout: async refreshToken => {
    try {
      const { verifyRefreshToken } = require("../utils/jwt");
      const decoded = verifyRefreshToken(refreshToken);
      const userId = decoded?.userId;
      const sessionId = decoded?.sessionId;
      const sessionPlatform = normalizePlatform(decoded?.platform);

      if (userId && sessionId) {
        const matchedSession = await resolveSessionKey({
          userId,
          sessionId,
          platform: sessionPlatform,
        });

        if (matchedSession?.key) {
          await safeDel(matchedSession.key);
        }
      }
    } catch (_err) {
      // Ignore invalid refresh token at this step; token cleanup still runs below.
    }

    await refreshTokenRepository.delete(refreshToken);
    return { message: "Logged out" };
  },
  getByPhone: async phone => {
    return await userRepository.getByPhone(phone);
  },
  getById: async userId => {
    return await userRepository.getById(userId);
  },

  refreshToken: async (refreshToken) => {
    // 1. Kiểm tra refresh token có trong DB không
    const stored = await refreshTokenRepository.findByToken(refreshToken);
    if (!stored) throw new Error("Invalid refresh token");

    // 2. Verify refresh token còn hạn không
    const decoded = require("../utils/jwt").verifyRefreshToken(refreshToken);

    // 2.1. Check latest account status before issuing new access token
    const user = await userRepository.getById(decoded.userId);
    if (!user) throw new Error("User not found");

    const accountStatus = user.accountStatus || user.status || "active";
    if (accountStatus === "locked") throw new Error("Account is locked");
    if (accountStatus === "deleted") throw new Error("Account is deleted");

    // 3. Tạo access token mới
    const sessionId = decoded.sessionId;
    if (!sessionId) throw new Error("Session expired");

    const sessionPlatform = normalizePlatform(decoded?.platform || stored?.platform);

    const matchedSession = await resolveSessionKey({
      userId: decoded.userId,
      sessionId,
      platform: sessionPlatform,
    });

    if (!matchedSession) {
      throw new Error("Session expired");
    }

    const payload = {
      userId: decoded.userId,
      email: decoded.email,
      accountStatus,
      sessionId,
      platform: sessionPlatform,
    };
    const newAccessToken = signAccessToken(payload);

    return { accessToken: newAccessToken };
  },

  forgotPasswordRequestOtp: async (email) => {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
      throw new Error("Email is required");
    }

    const user = await userRepository.getByEmail(normalizedEmail);
    if (!user) {
      throw new Error("Email not found");
    }

    const limitKey = `forgot:limit:${normalizedEmail}`;
    const isLimited = await safeGet(limitKey);
    if (isLimited) {
      throw new Error("Please wait before requesting a new OTP");
    }

    const otp = generateOtp();
    const otpKey = `forgot:otp:${normalizedEmail}`;

    await safeSet(otpKey, otp, { EX: FORGOT_OTP_TTL_SECONDS });
    await safeSet(limitKey, "1", { EX: FORGOT_RESEND_LIMIT_SECONDS });

    await sendOTPEmail({
      to: normalizedEmail,
      otp,
    });

    return { message: "OTP sent", expiresIn: FORGOT_OTP_TTL_SECONDS };
  },

  forgotPasswordVerifyOtp: async (email, otp) => {
    const normalizedEmail = normalizeEmail(email);
    const normalizedOtp = String(otp || "").trim();

    if (!normalizedEmail || !normalizedOtp) {
      throw new Error("Email and OTP are required");
    }

    const otpKey = `forgot:otp:${normalizedEmail}`;
    const savedOtp = await safeGet(otpKey);

    if (!savedOtp) {
      throw new Error("OTP expired or not found");
    }

    if (savedOtp !== normalizedOtp) {
      throw new Error("Invalid OTP");
    }

    const verifiedKey = `forgot:verified:${normalizedEmail}`;
    await safeDel(otpKey);
    await safeSet(verifiedKey, "1", { EX: FORGOT_VERIFY_TTL_SECONDS });

    return { message: "OTP verified", expiresIn: FORGOT_VERIFY_TTL_SECONDS };
  },

  forgotPasswordReset: async (email, newPassword) => {
    const normalizedEmail = normalizeEmail(email);
    const password = String(newPassword || "");

    if (!normalizedEmail || !password) {
      throw new Error("Email and newPassword are required");
    }

    const user = await userRepository.getByEmail(normalizedEmail);
    if (!user) {
      throw new Error("Email not found");
    }

    const verifiedKey = `forgot:verified:${normalizedEmail}`;
    const isVerified = await safeGet(verifiedKey);
    if (!isVerified) {
      throw new Error("OTP verification required");
    }

    await UserService.updateUser(user.userId, { password });
    await safeDel(verifiedKey);

    return { message: "Password reset successful" };
  },

  uploadAvatar: async (userId, file) => {
    if (!file) {
      throw new Error("No file uploaded");
    }

    const fileUrl = await uploadAvatarToS3(userId, file);

    return {
      url: fileUrl,
      fileName: file.originalname,
      fileSize: file.size,
      mimetype: file.mimetype
    };
  },

  changePassword: async (userId, oldPassword, newPassword) => {
    if (!userId || !oldPassword || !newPassword) {
      throw new Error("userId, oldPassword, and newPassword are required");
    }

    // 1. Lấy user từ database
    const user = await userRepository.getById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // 2. Xác thực mật khẩu cũ
    const isMatch = await bcrypt.compare(oldPassword + "nhan123@@", user.password);
    if (!isMatch) {
      throw new Error("Old password is incorrect");
    }

    // 3. Hash mật khẩu mới
    const hashedNewPassword = await bcrypt.hash(newPassword + "nhan123@@", 10);

    // 4. Update password
    const params = {
      TableName: tableName,
      Key: { userId },
      UpdateExpression: "set password = :password",
      ExpressionAttributeValues: {
        ":password": hashedNewPassword
      },
      ReturnValues: "ALL_NEW"
    };

    const result = await userRepository.update(params);
    const { password: _, ...safeUser } = result;

    return {
      message: "Password changed successfully",
      user: safeUser
    };
  },

  lockAccount: async (userId, currentPassword) => {
    if (!userId || !currentPassword) {
      throw new Error("userId and currentPassword are required");
    }

    const user = await userRepository.getById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const isMatch = await bcrypt.compare(currentPassword + "nhan123@@", user.password);
    if (!isMatch) {
      throw new Error("Current password is incorrect");
    }

    const now = new Date().toISOString();
    const params = {
      TableName: tableName,
      Key: { userId },
      UpdateExpression: "set accountStatus = :accountStatus, #status = :status, presenceStatus = :presenceStatus, lastActiveAt = :lastActiveAt",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":accountStatus": "locked",
        ":status": "locked",
        ":presenceStatus": "offline",
        ":lastActiveAt": now,
      },
      ReturnValues: "ALL_NEW"
    };

    const result = await userRepository.update(params);
    const { password: _, ...safeUser } = result;

    return {
      message: "Account locked successfully",
      user: safeUser,
    };
  },

  requestPermanentLockOtp: async (userId) => {
    if (!userId) {
      throw new Error("userId is required");
    }

    const user = await userRepository.getById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const accountStatus = user.accountStatus || user.status || "active";
    if (accountStatus === "deleted") {
      throw new Error("Account is already permanently locked");
    }

    if (!user.email) {
      throw new Error("User email is required for OTP verification");
    }

    const limitKey = `lock:limit:${userId}`;
    const isLimited = await safeGet(limitKey);
    if (isLimited) {
      throw new Error("Please wait before requesting a new OTP");
    }

    const otp = generateOtp();
    const otpKey = `lock:otp:${userId}`;

    await safeSet(otpKey, otp, { EX: PERMANENT_LOCK_OTP_TTL_SECONDS });
    await safeSet(limitKey, "1", { EX: PERMANENT_LOCK_RESEND_LIMIT_SECONDS });

    await sendOTPEmail({
      to: user.email,
      otp,
    });

    return { message: "OTP sent", expiresIn: PERMANENT_LOCK_OTP_TTL_SECONDS };
  },

  permanentLockAccount: async (userId, password, otp, confirmIrreversible) => {
    const currentPassword = String(password || "");
    const normalizedOtp = String(otp || "").trim();

    if (!userId || !currentPassword || !normalizedOtp) {
      throw new Error("userId, password, and otp are required");
    }

    if (confirmIrreversible !== true) {
      throw new Error("You must confirm irreversible account lock");
    }

    const user = await userRepository.getById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const accountStatus = user.accountStatus || user.status || "active";
    if (accountStatus === "deleted") {
      throw new Error("Account is already permanently locked");
    }

    const isMatch = await bcrypt.compare(currentPassword + "nhan123@@", user.password);
    if (!isMatch) {
      throw new Error("Password is incorrect");
    }

    const otpKey = `lock:otp:${userId}`;
    const savedOtp = await safeGet(otpKey);
    if (!savedOtp) {
      throw new Error("OTP expired or not found");
    }

    if (savedOtp !== normalizedOtp) {
      throw new Error("Invalid OTP");
    }

    await safeDel(otpKey);
    await refreshTokenRepository.deleteByUserId(userId);

    const now = new Date().toISOString();
    const params = {
      TableName: tableName,
      Key: { userId },
      UpdateExpression: "set accountStatus = :accountStatus, #status = :status, presenceStatus = :presenceStatus, lastActiveAt = :lastActiveAt",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":accountStatus": "deleted",
        ":status": "deleted",
        ":presenceStatus": "offline",
        ":lastActiveAt": now,
      },
      ReturnValues: "ALL_NEW"
    };

    const result = await userRepository.update(params);
    const { password: _, ...safeUser } = result;

    return {
      message: "Account permanently locked. This action cannot be undone",
      user: safeUser,
    };
  },

  unlockAccount: async (email, password) => {
    const normalizedEmail = normalizeEmail(email);
    const currentPassword = String(password || "");

    if (!normalizedEmail || !currentPassword) {
      throw new Error("email and password are required");
    }

    const user = await userRepository.getByEmail(normalizedEmail);
    if (!user) {
      throw new Error("User not found");
    }

    const accountStatus = user.accountStatus || user.status || "active";
    if (accountStatus !== "locked") {
      throw new Error("Account is not locked");
    }

    const isMatch = await bcrypt.compare(currentPassword + "nhan123@@", user.password);
    if (!isMatch) {
      throw new Error("Password is incorrect");
    }

    const params = {
      TableName: tableName,
      Key: { userId: user.userId },
      UpdateExpression: "set accountStatus = :accountStatus, #status = :status",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":accountStatus": "active",
        ":status": "active",
      },
      ReturnValues: "ALL_NEW"
    };

    const result = await userRepository.update(params);
    const { password: _, ...safeUser } = result;

    return {
      message: "Account unlocked successfully",
      user: safeUser,
    };
  },

  // ===== REGISTRATION WITH OTP =====
  registerRequestOtp: async (email) => {
    const validation = await validateRegistrationEmail(email);
    if (!validation.isAllowed) {
      throw new Error(validation.message || "Email is invalid");
    }
    const normalizedEmail = validation.normalizedEmail;

    const existingUserEmail = await userRepository.getByEmail(normalizedEmail);
    if (existingUserEmail) {
      throw new Error("Email already exists");
    }

    const limitKey = `register:limit:${normalizedEmail}`;
    const isLimited = await safeGet(limitKey);
    if (isLimited) {
      throw new Error("Please wait before requesting a new OTP");
    }

    const otp = generateOtp();
    const otpKey = `register:otp:${normalizedEmail}`;
    await safeSet(otpKey, otp, { EX: FORGOT_OTP_TTL_SECONDS });
    await safeSet(limitKey, "1", { EX: FORGOT_RESEND_LIMIT_SECONDS });

    await sendOTPEmail({
      to: normalizedEmail,
      otp,
    });

    return { message: "OTP sent to email", expiresIn: FORGOT_OTP_TTL_SECONDS };
  },

  registerVerifyOtp: async (email, otp) => {
    const normalizedEmail = normalizeEmail(email);
    const normalizedOtp = String(otp || "").trim();

    if (!normalizedEmail || !normalizedOtp) {
      throw new Error("Email and OTP are required");
    }

    const otpKey = `register:otp:${normalizedEmail}`;
    const savedOtp = await safeGet(otpKey);

    if (!savedOtp) {
      throw new Error("OTP expired or not found");
    }

    if (savedOtp !== normalizedOtp) {
      throw new Error("Invalid OTP");
    }

    const verifiedKey = `register:verified:${normalizedEmail}`;
    await safeDel(otpKey);
    await safeSet(verifiedKey, "1", { EX: FORGOT_VERIFY_TTL_SECONDS });

    return { message: "OTP verified", expiresIn: FORGOT_VERIFY_TTL_SECONDS };
  },

  // ===== LOGIN HISTORY =====
  getLoginHistory: async (userId, limit = 20) => {
    if (!userId) throw new Error("userId is required");
    return await loginHistoryRepository.getByUserId(userId, limit);
  },

  registerComplete: async (registerData) => {
    const { avartarUrl, birthday, email, gender, password, phone, status, accountStatus, userName } = registerData || {};

    if (!email || !password || !userName || !gender || !phone || !avartarUrl || !birthday) {
      throw new Error("All fields are required");
    }

    const normalizedEmail = normalizeEmail(email);
    const verifiedKey = `register:verified:${normalizedEmail}`;
    const isVerified = await safeGet(verifiedKey);
    if (!isVerified) {
      throw new Error("Email verification required");
    }

    const existingUserEmail = await userRepository.getByEmail(normalizedEmail);
    if (existingUserEmail) {
      throw new Error("Email already exists");
    }

    const existingUserPhone = await userRepository.getByPhone(phone);
    if (existingUserPhone) {
      throw new Error("Phone number already exists");
    }

    const hashedPassword = await bcrypt.hash(password + "nhan123@@", 10);
    const createdAt = new Date().toISOString();
    const resolvedAccountStatus = accountStatus || status || "active";

    const user = {
      userId: await generateId("user"),
      avartarUrl,
      birthday,
      createdAt,
      email: normalizedEmail,
      gender,
      password: hashedPassword,
      phone,
      accountStatus: resolvedAccountStatus,
      status: resolvedAccountStatus,
      presenceStatus: "offline",
      lastActiveAt: createdAt,
      userName,
    };

    const createdUser = await userRepository.register(user);
    const { password: _, ...safeUser } = createdUser;
    await safeDel(verifiedKey);

    return { message: "Registration completed", user: safeUser };
  }

};

module.exports = UserService;

