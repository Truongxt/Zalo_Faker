const { dynamodb } = require("../utils/aws-helper");

const TABLE_NAME = "LoginHistory";

const loginHistoryRepository = {
  /**
   * Create a new login history record.
   */
  create: async (record) => {
    const params = {
      TableName: TABLE_NAME,
      Item: record,
    };
    await dynamodb.put(params).promise();
    return record;
  },

  /**
   * Get login history for a user, sorted by loginAt descending.
   * @param {string} userId
   * @param {number} limit - max number of records to return (default 20)
   */
  getByUserId: async (userId, limit = 20) => {
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: "#userId = :userId",
      ExpressionAttributeNames: {
        "#userId": "userId",
      },
      ExpressionAttributeValues: {
        ":userId": userId,
      },
      ScanIndexForward: false, // descending order (newest first)
      Limit: limit,
    };

    const result = await dynamodb.query(params).promise();
    return result.Items || [];
  },

  /**
   * Delete all login history records for a user.
   */
  deleteByUserId: async (userId) => {
    // First, query all records
    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: "#userId = :userId",
      ExpressionAttributeNames: {
        "#userId": "userId",
      },
      ExpressionAttributeValues: {
        ":userId": userId,
      },
      ProjectionExpression: "userId, loginId",
    };

    const result = await dynamodb.query(params).promise();
    const items = result.Items || [];

    // Delete each record
    for (const item of items) {
      await dynamodb
        .delete({
          TableName: TABLE_NAME,
          Key: {
            userId: item.userId,
            loginId: item.loginId,
          },
        })
        .promise();
    }
  },
};

module.exports = loginHistoryRepository;
