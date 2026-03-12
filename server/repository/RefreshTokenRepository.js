const {dynamodb} = require("../utils/aws-helper");

const tableName = "RefreshToken";

const refreshTokenRepository = {

  create: async (token) => {
    const params = {
      TableName: tableName,
      Item: token
    };

    await dynamodb.put(params).promise();
    return token;
  },

  findByToken: async (refreshToken) => {
    const params = {
      TableName: tableName,
      Key: {
        refreshToken
      }
    };

    const result = await dynamodb .get(params).promise();
    return result.Item;
  },

  delete: async (refreshToken) => {
    const params = {
      TableName: tableName,
      Key: {
        refreshToken
      }
    };

    await dynamodb.delete(params).promise();
  }

};

module.exports = refreshTokenRepository;