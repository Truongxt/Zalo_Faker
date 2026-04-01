const { dynamodb } = require("../utils/aws-helper");

const TABLE_NAME = "MomentReaction";
const MOMENT_INDEX = "MomentIdUpdatedAtIndex";

const MomentReactionRepository = {
  async createOrUpdate(reaction) {
    const item = {
      ...reaction,
      userId: String(reaction.userId),
      momentId: String(reaction.momentId)
    };

    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: item
    }).promise();

    return item;
  },

  async getByUserAndMoment(userId, momentId) {
    const result = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: {
        userId: String(userId),
        momentId: String(momentId)
      }
    }).promise();

    return result.Item || null;
  },

  async getByUserId(userId) {
    const result = await dynamodb.query({
      TableName: TABLE_NAME,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": String(userId)
      },
      ScanIndexForward: false
    }).promise();

    return result.Items || [];
  },

  async getByMomentId(momentId) {
    const result = await dynamodb.query({
      TableName: TABLE_NAME,
      IndexName: MOMENT_INDEX,
      KeyConditionExpression: "momentId = :momentId",
      ExpressionAttributeValues: {
        ":momentId": momentId
      },
      ScanIndexForward: false
    }).promise();

    return result.Items || [];
  },

  async delete(userId, momentId) {
    await dynamodb.delete({
      TableName: TABLE_NAME,
      Key: {
        userId: String(userId),
        momentId: String(momentId)
      }
    }).promise();
  },

  async deleteByMomentId(momentId) {
    const reactions = await this.getByMomentId(momentId);

    await Promise.all(
      reactions.map((reaction) => this.delete(reaction.userId, reaction.momentId))
    );

    return { deletedCount: reactions.length };
  }
};

module.exports = MomentReactionRepository;
