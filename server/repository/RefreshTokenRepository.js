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
  },

  deleteByUserId: async (userId) => {
    const params = {
      TableName: tableName,
      FilterExpression: "#userId = :userId",
      ExpressionAttributeNames: {
        "#userId": "userId"
      },
      ExpressionAttributeValues: {
        ":userId": userId
      },
      ProjectionExpression: "refreshToken"
    };

    const result = await dynamodb.scan(params).promise();
    const items = result.Items || [];

    for (const item of items) {
      await dynamodb.delete({
        TableName: tableName,
        Key: {
          refreshToken: item.refreshToken
        }
      }).promise();
    }
  },

  deleteByUserIdAndPlatform: async (userId, platform) => {
    const normalizedPlatform = String(platform || "unknown");
    const isUnknownPlatform = normalizedPlatform === "unknown";

    const params = {
      TableName: tableName,
      FilterExpression: isUnknownPlatform
        ? "#userId = :userId AND (#platform = :platform OR attribute_not_exists(#platform))"
        : "#userId = :userId AND #platform = :platform",
      ExpressionAttributeNames: {
        "#userId": "userId",
        "#platform": "platform"
      },
      ExpressionAttributeValues: {
        ":userId": userId,
        ":platform": normalizedPlatform
      },
      ProjectionExpression: "refreshToken"
    };

    const result = await dynamodb.scan(params).promise();
    const items = result.Items || [];

    for (const item of items) {
      await dynamodb.delete({
        TableName: tableName,
        Key: {
          refreshToken: item.refreshToken
        }
      }).promise();
    }
  }

};

module.exports = refreshTokenRepository;