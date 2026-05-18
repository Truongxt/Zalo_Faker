const { dynamodb } = require("../utils/aws-helper");

const TABLE_NAME = "Notification";
const RECIPIENT_INDEX = "RecipientIdCreatedAtIndex";
const isMissingRecipientIndexError = (error) =>
  error?.code === "ValidationException"
  && String(error?.message || "").includes(RECIPIENT_INDEX);

const NotificationRepository = {
  async create(notification) {
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: notification,
    }).promise();

    return notification;
  },

  async getById(notificationId) {
    const result = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: { notificationId: String(notificationId) },
    }).promise();

    return result.Item || null;
  },

  async listByRecipient(recipientId, limit = 50) {
    const normalizedRecipientId = String(recipientId);
    const normalizedLimit = Math.max(1, Math.min(100, Number(limit) || 50));

    try {
      const result = await dynamodb.query({
        TableName: TABLE_NAME,
        IndexName: RECIPIENT_INDEX,
        KeyConditionExpression: "recipientId = :recipientId",
        ExpressionAttributeValues: {
          ":recipientId": normalizedRecipientId,
        },
        ScanIndexForward: false,
        Limit: normalizedLimit,
      }).promise();

      return result.Items || [];
    } catch (error) {
      if (!isMissingRecipientIndexError(error)) {
        throw error;
      }

      const fallback = await dynamodb.scan({
        TableName: TABLE_NAME,
        FilterExpression: "recipientId = :recipientId",
        ExpressionAttributeValues: {
          ":recipientId": normalizedRecipientId,
        },
      }).promise();

      return (fallback.Items || [])
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, normalizedLimit);
    }
  },

  async listAllByRecipient(recipientId) {
    const normalizedRecipientId = String(recipientId);

    try {
      const result = await dynamodb.query({
        TableName: TABLE_NAME,
        IndexName: RECIPIENT_INDEX,
        KeyConditionExpression: "recipientId = :recipientId",
        ExpressionAttributeValues: {
          ":recipientId": normalizedRecipientId,
        },
        ScanIndexForward: false,
      }).promise();

      return result.Items || [];
    } catch (error) {
      if (!isMissingRecipientIndexError(error)) {
        throw error;
      }

      const fallback = await dynamodb.scan({
        TableName: TABLE_NAME,
        FilterExpression: "recipientId = :recipientId",
        ExpressionAttributeValues: {
          ":recipientId": normalizedRecipientId,
        },
      }).promise();

      return (fallback.Items || []).sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
      );
    }
  },

  async update(notificationId, updates = {}) {
    const existing = await this.getById(notificationId);
    if (!existing) {
      return null;
    }

    const nextItem = {
      ...existing,
      ...updates,
      notificationId: existing.notificationId,
      updatedAt: updates.updatedAt || new Date().toISOString(),
    };

    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: nextItem,
    }).promise();

    return nextItem;
  },
};

module.exports = NotificationRepository;
