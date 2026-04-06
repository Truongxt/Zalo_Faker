
const { generateId } = require("../utils/idGenerator");
const bcrypt = require("bcryptjs");
const {
  signAccessToken,
  signRefreshToken
} = require("../utils/jwt");
const { s3 } = require("../utils/aws-helper");
const { v4: uuidv4 } = require("uuid");

const userRepository = require("../repository/userRepository");
const refreshTokenRepository = require("../repository/RefreshTokenRepository");
const { redisClient } = require("../utils/redisClient");
const { sendOTPEmail } = require("../utils/sendEmail");
const tableName = "User";

const FORGOT_OTP_TTL_SECONDS = 300;
const FORGOT_VERIFY_TTL_SECONDS = 600;
const FORGOT_RESEND_LIMIT_SECONDS = 60;

const normalizeEmail = (email) => String(email || "").trim().toLowerCase();

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

    const {avartarUrl, birthday, email, gender, password, phone, status, userName} = userData;

    if (!email || !password || !userName||!gender||!phone||!status||!avartarUrl||!birthday) {
      throw new Error("Email, password, and userName are required");
    }
    const existingUser = await userRepository.getByEmail(email);
    if (existingUser) {
      throw new Error("Email already exists");
    }

     const hashedPassword = await bcrypt.hash(password+"nhan123@@", 10);

    const user = {
      userId: await generateId("user"),
      avartarUrl: avartarUrl || null,
      birthday: birthday || null,
      createdAt: new Date().toISOString(),
      email: userData.email,
      gender: userData.gender,
      password: hashedPassword,
      phone: userData.phone,
      status: userData.status || "active",
      userName: userData.userName
    };

    return await userRepository.register(user);
  },

  getUsers: async () => {
    return await userRepository.getAll();
  },
updateUser: async (userId, userData, avatarFile) => {

    if (avatarFile) {
      const avatarUrl = await uploadAvatarToS3(userId, avatarFile);
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
      "status",
      "userName"
    ];

    for (const field of allowedFields) {
      if (userData[field] !== undefined) {

        let value = userData[field];

        // 👉 nếu update password thì hash
        if (field === "password") {
          value = await bcrypt.hash(value+"nhan123@@", 10);
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

 

 login: async (email, password) => {

  const users = await userRepository.getAll();
  const user = users.find(u => u.email === email);
  if (!user) throw new Error("User not found");

  const isMatch = await bcrypt.compare(password+"nhan123@@", user.password);
  if (!isMatch) throw new Error("Invalid password");

  const payload = {
    userId: user.userId,
    email: user.email
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  await refreshTokenRepository.deleteByUserId(user.userId);
  await refreshTokenRepository.create({
    refreshToken,
    userId: user.userId,
    createdAt: new Date().toISOString()
  });

  const { password: _, ...safeUser } = user;

  return {
    user: safeUser,
    accessToken,
    refreshToken
  };
},
logout: async refreshToken => {
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

  // 3. Tạo access token mới
  const payload = { userId: decoded.userId, email: decoded.email };
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
  const isLimited = await redisClient.get(limitKey);
  if (isLimited) {
    throw new Error("Please wait before requesting a new OTP");
  }

  const otp = generateOtp();
  const otpKey = `forgot:otp:${normalizedEmail}`;

  await redisClient.set(otpKey, otp, { EX: FORGOT_OTP_TTL_SECONDS });
  await redisClient.set(limitKey, "1", { EX: FORGOT_RESEND_LIMIT_SECONDS });

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
  const savedOtp = await redisClient.get(otpKey);

  if (!savedOtp) {
    throw new Error("OTP expired or not found");
  }

  if (savedOtp !== normalizedOtp) {
    throw new Error("Invalid OTP");
  }

  const verifiedKey = `forgot:verified:${normalizedEmail}`;
  await redisClient.del(otpKey);
  await redisClient.set(verifiedKey, "1", { EX: FORGOT_VERIFY_TTL_SECONDS });

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
  const isVerified = await redisClient.get(verifiedKey);
  if (!isVerified) {
    throw new Error("OTP verification required");
  }

  await UserService.updateUser(user.userId, { password });
  await redisClient.del(verifiedKey);

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
}

};

module.exports = UserService;