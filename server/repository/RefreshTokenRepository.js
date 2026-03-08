const {dynamoDB} = require("../utils/aws-helper");

const tableName = "RefreshToken";

const refreshTokenRepository = {

  create: async (token) => {
    const params = {
      TableName: tableName,
      Item: token
    };

    await dynamoDB.put(params).promise();
    return token;
  },

  findByToken: async (refreshToken) => {
    const params = {
      TableName: tableName,
      Key: {
        refreshToken
      }
    };

    const result = await dynamoDB.get(params).promise();
    return result.Item;
  },

  delete: async (refreshToken) => {
    const params = {
      TableName: tableName,
      Key: {
        refreshToken
      }
    };

    await dynamoDB.delete(params).promise();
  }

};

module.exports = refreshTokenRepository;