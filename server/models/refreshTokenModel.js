const { dynamodb } = require("../utils/aws-helper");

const tableName = "RefreshToken";

const RefreshTokenModel = {

  // tạo refresh token
  create: async item => {
    await dynamodb.put({
      TableName: tableName,
      Item: item
    }).promise();
    return item;
  },

  // lấy refresh token
  get: async refreshToken => {
    const data = await dynamodb.get({
      TableName: tableName,
      Key: { refreshToken }
    }).promise();

    return data.Item;
  },

  // xoá refresh token (logout)
  delete: async refreshToken => {
    await dynamodb.delete({
      TableName: tableName,
      Key: { refreshToken }
    }).promise();

    return { refreshToken };
  },

  // xoá toàn bộ token của 1 user (logout all devices)
  deleteByUserId: async userId => {
    const data = await dynamodb.scan({
      TableName: tableName,
      FilterExpression: "userId = :uid",
      ExpressionAttributeValues: {
        ":uid": userId
      }
    }).promise();

    const deletes = data.Items.map(item =>
      dynamodb.delete({
        TableName: tableName,
        Key: { refreshToken: item.refreshToken }
      }).promise()
    );

    await Promise.all(deletes);
    return { deleted: deletes.length };
  }
};

module.exports = RefreshTokenModel;