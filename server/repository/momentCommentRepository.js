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

  async getById(momentId, commentId) {
    const result = await dynamodb.get({
      TableName: TABLE_NAME,
      Key: {
        momentId,
        commentId
      }
    }).promise();

    return result.Item || null;
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

  async update(comment) {
    await dynamodb.put({
      TableName: TABLE_NAME,
      Item: comment
    }).promise();

    return comment;
  },

  async delete(momentId, commentId) {
    await dynamodb.delete({
      TableName: TABLE_NAME,
      Key: {
        momentId,
        commentId
      }
    }).promise();

    return {
      momentId,
      commentId
    };
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
