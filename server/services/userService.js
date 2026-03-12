
const { generateId } = require("../utils/idGenerator");
const bcrypt = require("bcryptjs");
const {
  signAccessToken,
  signRefreshToken
} = require("../utils/jwt");

const userRepository = require("../repository/userRepository");
const refreshTokenRepository = require("../repository/RefreshTokenRepository");
const tableName = "User";

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

     const hashedPassword = await bcrypt.hash(password, 10);

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
updateUser: async (userId, userData) => {

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
          value = await bcrypt.hash(value, 10);
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

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) throw new Error("Invalid password");

  const payload = {
    userId: user.userId,
    email: user.email
  };

  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // 👉 lưu refresh token DB
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
}

};

module.exports = UserService;