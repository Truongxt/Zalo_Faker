const { dynamodb } = require("../utils/aws-helper");

const TABLE_NAME = "AIChatHistory";

const aiChatHistoryRepository = {
  upsertConversation: async ({ userId, conversationId, title, askedAt }) => {
    const now = new Date().toISOString();
    const item = {
      userId: String(userId),
      // Keep compatibility with current key schema (userId + chatId).
      chatId: String(conversationId),
      conversationId: String(conversationId),
      title: String(title || "Hoi thoai moi"),
      lastAskedAt: askedAt || now,
      updatedAt: now,
      createdAt: now,
      itemType: "conversation",
    };

    await dynamodb
      .put({
        TableName: TABLE_NAME,
        Item: item,
      })
      .promise();

    return item;
  },

  create: async (record) => {
    const params = {
      TableName: TABLE_NAME,
      Item: record,
    };

    await dynamodb.put(params).promise();
    return record;
  },

  getByUserId: async ({ userId, limit = 20, conversationId }) => {
    const parsedLimit = Number(limit);
    const safeLimit = Number.isFinite(parsedLimit)
      ? Math.min(Math.max(parsedLimit, 1), 100)
      : 20;

    const params = {
      TableName: TABLE_NAME,
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

    if (conversationId) {
      params.FilterExpression = "#conversationId = :conversationId";
      params.ExpressionAttributeNames["#conversationId"] = "conversationId";
      params.ExpressionAttributeValues[":conversationId"] = String(conversationId);
    }

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

  deleteByConversationId: async ({ userId, conversationId }) => {
    const itemsToDelete = [];
    let lastEvaluatedKey;

    try {
      do {
        const queryParams = {
          TableName: TABLE_NAME,
          KeyConditionExpression: "#userId = :userId",
          FilterExpression: "#conversationId = :conversationId",
          ProjectionExpression: "#userId, #chatId",
          ExpressionAttributeNames: {
            "#userId": "userId",
            "#chatId": "chatId",
            "#conversationId": "conversationId",
          },
          ExpressionAttributeValues: {
            ":userId": String(userId),
            ":conversationId": String(conversationId),
          },
          ExclusiveStartKey: lastEvaluatedKey,
        };

        const result = await dynamodb.query(queryParams).promise();
        const items = result.Items || [];
        itemsToDelete.push(...items);
        lastEvaluatedKey = result.LastEvaluatedKey;
      } while (lastEvaluatedKey);
    } catch (error) {
      const message = String(error?.message || "");
      const code = String(error?.code || "");

      if (code === "ResourceNotFoundException" || message.includes("Requested resource not found")) {
        return 0;
      }

      throw error;
    }

    for (const item of itemsToDelete) {
      await dynamodb
        .delete({
          TableName: TABLE_NAME,
          Key: {
            userId: item.userId,
            chatId: item.chatId,
          },
        })
        .promise();
    }

    return itemsToDelete.length;
  },

  deleteConversationMeta: async ({ userId, conversationId }) => {
    await dynamodb
      .delete({
        TableName: TABLE_NAME,
        Key: {
          userId: String(userId),
          chatId: String(conversationId),
        },
      })
      .promise();
  },
};

module.exports = aiChatHistoryRepository;