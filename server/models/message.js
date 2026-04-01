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
        replyTo: messageData.replyTo || null,
        reactions: messageData.reactions || [], // Array of Reaction
        readBy: messageData.readBy || [], // Array of ReadReceipt
        isDeleted: messageData.isDeleted || false,
        createdAt
      }
    };
    try {
      await dynamodb.put(params).promise();
      return { _id: messageId, ...messageData, createdAt };
    } catch (error) {
      console.error("Error creating message:", error);
      throw error;
    }
  },

  getMessages: async () => {
    const params = { TableName: tableName };
    try {
      const messages = await dynamodb.scan(params).promise();
      return messages.Items;
    } catch (error) {
      console.error("Error getting messages:", error);
      throw error;
    }
  },

  updateMessage: async (messageId, messageData) => {
    const updateFields = [];
    const ExpressionAttributeNames = {};
    const ExpressionAttributeValues = {};
    const allowedFields = ["conversationId", "senderId", "type", "content", "replyTo", "reactions", "readBy", "isDeleted"];
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
    const params = {
      TableName: tableName,
      FilterExpression: "conversationId = :conversationId",
      ExpressionAttributeValues: { ":conversationId": conversationId }
    };
    try {
      const data = await dynamodb.scan(params).promise();
      // Sắp xếp theo thời gian tạo (cũ → mới)
      return data.Items.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    } catch (error) {
      console.error("Error getting messages by conversation id:", error);
      throw error;
    }
  },

  deleteMessagesByConversationId: async (conversationId) => {
    const messages = await MessageModel.getMessagesByConversationId(conversationId);

    if (!messages.length) {
      return { deletedCount: 0 };
    }

    for (const message of messages) {
      await dynamodb.delete({
        TableName: tableName,
        Key: { _id: message._id }
      }).promise();
    }

    return { deletedCount: messages.length };
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
