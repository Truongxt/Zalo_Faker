const { dynamodb } = require("../utils/aws-helper");

const TABLE_NAME = "AIChatMessages";
const USER_INDEX = "userId-askedAt-index";

const aiChatMessageRepository = {
  create: async (record) => {
    await dynamodb
      .put({
        TableName: TABLE_NAME,
        Item: record,
      })
      .promise();

    return record;
  },

  getByConversationId: async ({ conversationId, userId, limit = 50 }) => {
    const parsedLimit = Number(limit);
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 200)
      : 50;

    const params = {
      TableName: TABLE_NAME,
      KeyConditionExpression: "#conversationId = :conversationId",
      ExpressionAttributeNames: {
        "#conversationId": "conversationId",
      },
      ExpressionAttributeValues: {
        ":conversationId": String(conversationId),
      },
      ScanIndexForward: false,
      Limit: safeLimit,
    };

    let items = [];
    try {
      const result = await dynamodb.query(params).promise();
      items = result.Items || [];
    } catch (error) {
      const message = String(error?.message || "");
      const code = String(error?.code || "");
      if (code === "ResourceNotFoundException" || message.includes("Requested resource not found")) {
        return [];
      }
      throw error;
    }

    if (!userId) {
      return items;
    }

    return items.filter((item) => String(item.userId) === String(userId));
  },

  getByUserId: async ({ userId, limit = 50 }) => {
    const parsedLimit = Number(limit);
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 200)
      : 50;

    const params = {
      TableName: TABLE_NAME,
      IndexName: USER_INDEX,
      KeyConditionExpression: "#userId = :userId",
      ExpressionAttributeNames: {
        "#userId": "userId",
      },
      ExpressionAttributeValues: {
        ":userId": String(userId),
      },
      ScanIndexForward: false,
      Limit: safeLimit,
    };

    try {
      const result = await dynamodb.query(params).promise();
      return result.Items || [];
    } catch (error) {
      const message = String(error?.message || "");
      const code = String(error?.code || "");
      if (code === "ResourceNotFoundException" || message.includes("Requested resource not found")) {
        return [];
      }
      throw error;
    }
  },

  deleteByConversationId: async ({ conversationId, userId }) => {
    const items = await aiChatMessageRepository.getByConversationId({
      conversationId,
      userId,
      limit: 1000,
    });

    try {
      for (const item of items) {
        await dynamodb
          .delete({
            TableName: TABLE_NAME,
            Key: {
              conversationId: item.conversationId,
              chatId: item.chatId,
            },
          })
          .promise();
      }
    } catch (error) {
      const message = String(error?.message || "");
      const code = String(error?.code || "");
      if (code === "ResourceNotFoundException" || message.includes("Requested resource not found")) {
        return 0;
      }
      throw error;
    }

    return items.length;
  },
};

module.exports = aiChatMessageRepository;