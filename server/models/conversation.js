const { dynamodb } = require("../utils/aws-helper");
const { v4: uuidv4 } = require("uuid");

const tableName = "Conversation";

const ConversationModel = {
  createConversation: async conversationData => {
    const conversationId = uuidv4();
    const params = {
      TableName: tableName,
      Item: {
        _id: conversationId,
        type: conversationData.type, // 'private' | 'group'
        name: conversationData.name,
        avatar: conversationData.avatar,
        participants: conversationData.participants || [], // Array of Participant
        lastMessage: conversationData.lastMessage || null, // LastMessage object
        createdBy: conversationData.createdBy,
        createdAt: new Date().toISOString()
      }
    };
    try {
      await dynamodb.put(params).promise();
      return { _id: conversationId, ...conversationData };
    } catch (error) {
      console.error("Error creating conversation:", error);
      throw error;
    }
  },

  getConversations: async () => {
    const params = { TableName: tableName };
    try {
      const conversations = await dynamodb.scan(params).promise();
      return conversations.Items;
    } catch (error) {
      console.error("Error getting conversations:", error);
      throw error;
    }
  },

  updateConversation: async (conversationId, conversationData) => {
    const updateFields = [];
    const ExpressionAttributeNames = {};
    const ExpressionAttributeValues = {};
    const allowedFields = ["type", "name", "avatar", "participants", "lastMessage", "createdBy"];
    allowedFields.forEach(field => {
      if (conversationData[field] !== undefined) {
        updateFields.push(`#${field} = :${field}`);
        ExpressionAttributeNames[`#${field}`] = field;
        ExpressionAttributeValues[`:${field}`] = conversationData[field];
      }
    });
    const params = {
      TableName: tableName,
      Key: { _id: conversationId },
      UpdateExpression: `set ${updateFields.join(", ")}`,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ReturnValues: "ALL_NEW"
    };
    try {
      const updatedConversation = await dynamodb.update(params).promise();
      return updatedConversation.Attributes;
    } catch (error) {
      console.error("Error updating conversation:", error);
      throw error;
    }
  },

  deleteConversation: async conversationId => {
    const params = {
      TableName: tableName,
      Key: { _id: conversationId }
    };
    try {
      await dynamodb.delete(params).promise();
      return { _id: conversationId };
    } catch (error) {
      console.error("Error deleting conversation:", error);
      throw error;
    }
  },

  getOneConversation: async conversationId => {
    const params = {
      TableName: tableName,
      KeyConditionExpression: "_id = :id",
      ExpressionAttributeValues: { ":id": conversationId }
    };
    try {
      const data = await dynamodb.query(params).promise();
      return data.Items[0];
    } catch (error) {
      console.error("Error getting one conversation:", error);
      throw error;
    }
  }
};

module.exports = ConversationModel;
