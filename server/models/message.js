const { dynamodb } = require("../utils/aws-helper");
const { v4: uuidv4 } = require("uuid");

const tableName = "Message";

const MessageModel = {
  createMessage: async messageData => {
    const messageId = uuidv4();
    const createdAt = new Date().toISOString();
    const params = {
      TableName: tableName,
      Item: {
        _id: messageId,
        conversationId: messageData.conversationId,
        senderId: messageData.senderId,
        type: messageData.type, // 'text' | 'image' | 'video' | 'file'
        content: messageData.content,
        attachments: messageData.attachments || null,
        metadata: messageData.metadata || null,
        replyTo: messageData.replyTo || null,
        reactions: messageData.reactions || [], // Array of Reaction
        readBy: messageData.readBy || [], // Array of ReadReceipt
        isDeleted: messageData.isDeleted || false,
        createdAt
      }
    };
    try {
      await dynamodb.put(params).promise();
      return params.Item;
    } catch (error) {
    }
  },

  getMessages: async () => {
    try {
      let items = [];
      let ExclusiveStartKey;

      do {
        const page = await dynamodb.scan({
          TableName: tableName,
          ConsistentRead: true,
          ExclusiveStartKey
        }).promise();

        items = items.concat(page.Items || []);
        ExclusiveStartKey = page.LastEvaluatedKey;
      } while (ExclusiveStartKey);

      return items;
    } catch (error) {
      console.error("Error getting messages:", error);
      throw error;
    }
  },

  updateMessage: async (messageId, messageData) => {
    const updateFields = [];
    const ExpressionAttributeNames = {};
    const ExpressionAttributeValues = {};
    const allowedFields = ["conversationId", "senderId", "type", "content", "attachments", "metadata", "replyTo", "reactions", "readBy", "isDeleted"];
    allowedFields.forEach(field => {
      if (messageData[field] !== undefined) {
        updateFields.push(`#${field} = :${field}`);
        ExpressionAttributeNames[`#${field}`] = field;
        ExpressionAttributeValues[`:${field}`] = messageData[field];
      }
    });
    const params = {
      TableName: tableName,
      Key: { _id: messageId },
      UpdateExpression: `set ${updateFields.join(", ")}`,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ReturnValues: "ALL_NEW"
    };
    try {
      const updatedMessage = await dynamodb.update(params).promise();
      return updatedMessage.Attributes;
    } catch (error) {
      console.error("Error updating message:", error);
      throw error;
    }
  },

  deleteMessage: async messageId => {
    const params = {
      TableName: tableName,
      Key: { _id: messageId }
    };
    try {
      await dynamodb.delete(params).promise();
      return { _id: messageId };
    } catch (error) {
      console.error("Error deleting message:", error);
      throw error;
    }
  },

  // getOneMessage: async messageId => {
  //   const params = {
  //     TableName: tableName,
  //     KeyConditionExpression: "_id = :id",
  //     ExpressionAttributeValues: { ":id": messageId }
  //   };
  //   try {
  //     const data = await dynamodb.query(params).promise();
  //     return data.Items[0];
  //   } catch (error) {
  //     console.error("Error getting one message:", error);
  //     throw error;
  //   }
  // },

  getOneMessage: async messageId => {
    const params = {
      TableName: tableName,
      Key: { _id: messageId }
    };
    try {
      const data = await dynamodb.get(params).promise();
      return data.Item;
    } catch (error) {
      console.error("Error getting one message:", error);
      throw error;
    }
  },

  getMessagesByConversationId: async (conversationId) => {
    // conversationId không phải Partition Key → không dùng query() được
    // Phải dùng scan() + FilterExpression (hoặc tạo GSI để tối ưu sau)
    try {
      let items = [];
      let ExclusiveStartKey;

      do {
        const page = await dynamodb.scan({
          TableName: tableName,
          ConsistentRead: true,
          FilterExpression: "conversationId = :conversationId",
          ExpressionAttributeValues: { ":conversationId": conversationId },
          ExclusiveStartKey
        }).promise();

        items = items.concat(page.Items || []);
        ExclusiveStartKey = page.LastEvaluatedKey;
      } while (ExclusiveStartKey);

      // Sắp xếp theo thời gian tạo (cũ → mới)
      return items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } catch (error) {
      console.error("Error getting messages by conversation id:", error);
      throw error;
    }
  },

  deleteMessagesByConversationId: async (conversationId) => {
    const params = {
      TableName: tableName,
      FilterExpression: "conversationId = :conversationId",
      ExpressionAttributeValues: { ":conversationId": conversationId }
    };
    try {
      const data = await dynamodb.scan(params).promise();
      const messagesToDelete = data.Items;
      
      for (const msg of messagesToDelete) {
        await dynamodb.delete({
          TableName: tableName,
          Key: { _id: msg._id }
        }).promise();
      }
      return { deletedCount: messagesToDelete.length };
    } catch (error) {
      console.error("Error deleting messages by conversation id:", error);
      throw error;
    }
  },

  // Methods for reactions and read receipts
  addReaction: async (messageId, userId, emoji) => {
    // Add a reaction to the message
    // ...existing code...
  },

  removeReaction: async (messageId, userId, emoji) => {
    // Remove a reaction from the message
    // ...existing code...
  },

  markAsRead: async (messageId, userId) => {
    // Mark message as read by user
    // ...existing code...
  }
};

module.exports = MessageModel;
