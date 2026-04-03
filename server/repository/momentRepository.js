const { dynamodb } = require("../utils/aws-helper");

const TABLE_NAME = "Moment";
const AUTHOR_INDEX = "AuthorIdCreatedAtIndex";

const MomentRepository = {
  async create(moment) {
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: moment
    }).promise();

    return moment;
  },

  async getById(momentId) {
    const result = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: { momentId }
    }).promise();

    return result.Item || null;
  },

  async getByIds(momentIds = []) {
    if (!momentIds.length) {
      return [];
    }

    const uniqueIds = [...new Set(momentIds)];
    const results = await Promise.all(uniqueIds.map((momentId) => this.getById(momentId)));
    return results.filter(Boolean);
  },

  async getByAuthorId(authorId) {
    const result = await dynamodb.query({
      TableName: TABLE_NAME,
      IndexName: AUTHOR_INDEX,
      KeyConditionExpression: "authorId = :authorId",
      ExpressionAttributeValues: {
        ":authorId": String(authorId)
      },
      ScanIndexForward: false
    }).promise();

    return result.Items || [];
  },

  async update(momentId, updates) {
    const updateFields = [];
    const ExpressionAttributeNames = {};
    const ExpressionAttributeValues = {};
    const allowedFields = [
      "content",
      "mediaUrls",
      "type",
      "originalMomentId",
      "originalMomentSnapshot",
      "reactionCount",
      "commentCount",
      "shareCount",
      "updatedAt"
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateFields.push(`#${field} = :${field}`);
        ExpressionAttributeNames[`#${field}`] = field;
        ExpressionAttributeValues[`:${field}`] = updates[field];
      }
    }

    const result = await dynamodb.update({
      TableName: TABLE_NAME,
      Key: { momentId },
      UpdateExpression: `set ${updateFields.join(", ")}`,
      ExpressionAttributeNames,
      ExpressionAttributeValues,
      ReturnValues: "ALL_NEW"
    }).promise();

    return result.Attributes;
  },

  async delete(momentId) {
    await dynamodb.delete({
      TableName: TABLE_NAME,
      Key: { momentId }
    }).promise();

    return { momentId };
  }
};

module.exports = MomentRepository;
