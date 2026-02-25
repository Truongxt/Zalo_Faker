
const { dynamodb } = require("../utils/aws-helper");
const { v4: uuidv4 } = require("uuid");

const tableName = "User";

const UserModel = {
  createUser: async userData => {
    const userId = uuidv4();
    const params = {
      TableName: tableName,
      Item: {
        userId,
        avartarUrl: userData.avartarUrl,
        birthday: userData.birthday,
        createdAt: new Date().toISOString(),
        email: userData.email,
        gender: userData.gender,
        password: userData.password,
        phone: userData.phone,
        status: userData.status || "active",
        userName: userData.userName
      }
    };
    try {
      await dynamodb.put(params).promise();
      return { userId, ...userData };
    } catch (error) {
      console.error("Error creating user:", error);
      throw error;
    }
  },

  getUsers: async () => {
    const params = { TableName: tableName };
    try {
      const users = await dynamodb.scan(params).promise();
      return users.Items;
    } catch (error) {
      console.error("Error getting users:", error);
      throw error;
    }
  },

  updateUser: async (userId, userData) => {
    const updateFields = [];
    const ExpressionAttributeNames = {};
    const ExpressionAttributeValues = {};
    const allowedFields = ["avartarUrl", "birthday", "email", "gender", "password", "phone", "status", "userName"];
    allowedFields.forEach(field => {
      if (userData[field] !== undefined) {
        updateFields.push(`#${field} = :${field}`);
        ExpressionAttributeNames[`#${field}`] = field;
        ExpressionAttributeValues[`:${field}`] = userData[field];
      }
    });
    const params = {
      TableName: tableName,
      Key: { userId },
      UpdateExpression: `set ${updateFields.join(", ")}`,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ReturnValues: "ALL_NEW"
    };
    try {
      const updatedUser = await dynamodb.update(params).promise();
      return updatedUser.Attributes;
    } catch (error) {
      console.error("Error updating user:", error);
      throw error;
    }
  },

  deleteUser: async userId => {
    const params = {
      TableName: tableName,
      Key: { userId }
    };
    try {
      await dynamodb.delete(params).promise();
      return { userId };
    } catch (error) {
      console.error("Error deleting user:", error);
      throw error;
    }
  },

  getOneUser: async userId => {
    const params = {
      TableName: tableName,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: { ":userId": userId }
    };
    try {
      const data = await dynamodb.query(params).promise();
      return data.Items[0];
    } catch (error) {
      console.error("Error getting one user:", error);
      throw error;
    }
  }
};

module.exports = UserModel;
