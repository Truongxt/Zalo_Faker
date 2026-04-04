const { dynamodb } = require("../utils/aws-helper");

const TABLE_NAME = "MomentComment";

const MomentCommentRepository = {
  async create(comment) {
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: comment
    }).promise();

    return comment;
  },

  async getByMomentId(momentId) {
    const result = await dynamodb.query({
      TableName: TABLE_NAME,
      KeyConditionExpression: "momentId = :momentId",
      ExpressionAttributeValues: {
        ":momentId": momentId
      },
      ScanIndexForward: true
    }).promise();

    return result.Items || [];
  },

  async deleteByMomentId(momentId) {
    const comments = await this.getByMomentId(momentId);

    await Promise.all(
      comments.map((comment) =>
        dynamodb.delete({
          TableName: TABLE_NAME,
          Key: {
            momentId,
            commentId: comment.commentId
          }
        }).promise()
      )
    );

    return { deletedCount: comments.length };
  }
};

module.exports = MomentCommentRepository;
